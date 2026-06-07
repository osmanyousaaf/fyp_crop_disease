from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import base64
from io import BytesIO
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import numpy as np
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import os
from fyp_plant_model import load_fyp_bundle, preprocess_image_bytes, predict_proba
from agricore_keras import load_agricore_keras_bundle, predict_keras_probs
from prediction_enrichment import enrich_prediction_context

try:
    from pytorch_cam import load_torch_predictor, torch_predict_with_overlay
except Exception as _torch_e:
    print(f"PyTorch Grad-CAM import failed: {_torch_e}")

    def load_torch_predictor(_path):  # type: ignore
        return False

    def torch_predict_with_overlay(*_a, **_kw):  # type: ignore
        return None


import requests
import json
from datetime import timedelta
from typing import Dict, Any, Optional
import threading
# For email sending
from flask_mail import Mail, Message
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import random
app = Flask(__name__)

# --- Configuration ---
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'your-super-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:///crops.db"
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
app.config["TF_ENABLE_ONEDNN_OPTS"] = os.environ.get("TF_ENABLE_ONEDNN_OPTS", "0")

# Flask-Mail Configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('EMAIL_USER')
app.config['MAIL_PASSWORD'] = os.environ.get('EMAIL_PASS')

# Google OAuth
app.config['GOOGLE_WEB_CLIENT_ID'] = os.environ.get('GOOGLE_WEB_CLIENT_ID')
app.config['GOOGLE_WEB_CLIENT_SECRET'] = os.environ.get('GOOGLE_WEB_CLIENT_SECRET')

CORS(app)


# --- Extensions ---
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)
mail = Mail(app)

# --- Database Model ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name=db.Column(db.String(120),nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=True)
    is_verified = db.Column(db.Boolean, default=False)
    verification_code = db.Column(db.String(6), nullable=True)
    google_id = db.Column(db.String(200), unique=True, nullable=True)
    
    def __repr__(self):
        return f"User('{self.email}', '{self.is_verified}')"

# Create DB
with app.app_context():
    db.create_all()

# --- Email Helper ---
def send_email(to, subject, body):
    msg = Message(subject, sender='noreply@yourdomain.com', recipients=[to])
    msg.body = body
    try:
        mail.send(msg)
    except Exception as e:
        print(f"Email failed: {e}")

# === Dual-sector model bundles ===
# orchard_canopy: fruits & vegetables (PlantVillage-style multi-label model)
# field_core: staple crops — Corn, Potato, Rice, Wheat, Sugarcane
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
_DEFAULT_GARDEN_DIR = os.path.join(_PROJECT_ROOT, "FYP_PlantDisease")
# Default AgriCore artifacts: Keras model + class_labels.json (see agricore_keras.py)
_DEFAULT_STAPLE_DIR = os.path.join(_PROJECT_ROOT, "crop leaves  2nd models saved")

GARDEN_DIR = os.environ.get("FYP_MODEL_DIR_GARDEN", os.environ.get("FYP_MODEL_DIR", _DEFAULT_GARDEN_DIR))
STAPLE_DIR = os.environ.get("FYP_MODEL_DIR_STAPLE", _DEFAULT_STAPLE_DIR)

SECTOR_LABELS = {
    "orchard_canopy": {
        "sector_title": "Canopy Lab",
        "sector_tagline": "Fruits & garden crops",
    },
    "field_core": {
        "sector_title": "AgriCore",
        "sector_tagline": "Staple field crops",
    },
}


def _build_bundle(artifact_dir: str) -> Dict[str, Any]:
    session, class_labels, reverse_labels, img_size, mean, std = load_fyp_bundle(artifact_dir)
    torch_ok = bool(load_torch_predictor(artifact_dir))
    onnx_ok = session is not None
    return {
        "dir": artifact_dir,
        "session": session,
        "class_labels": class_labels,
        "reverse_labels": reverse_labels,
        "image_size": img_size,
        "mean": mean,
        "std": std,
        "torch_ok": torch_ok,
        "onnx_ok": onnx_ok,
        "keras_model": None,
        "ready": onnx_ok or torch_ok,
    }


def _build_field_core_bundle(artifact_dir: str) -> Dict[str, Any]:
    """Prefer ONNX/PyTorch bundle if present; otherwise load Keras five-crops model."""
    b = _build_bundle(artifact_dir)
    if b["ready"]:
        return b
    k = load_agricore_keras_bundle(artifact_dir)
    if k.get("keras_model") is not None and k.get("ready"):
        return k
    return b


SECTOR_IDS = frozenset({"orchard_canopy", "field_core"})

_bundle_lock = threading.Lock()
_bundles: Optional[Dict[str, Dict[str, Any]]] = None
_bundle_load_error: Optional[str] = None
_models_ready = threading.Event()


def _warm_models_worker() -> None:
    """Load heavy ML bundles after Gunicorn binds so /api/health can respond immediately."""
    global _bundles, _bundle_load_error
    try:
        loaded = {
            "orchard_canopy": _build_bundle(GARDEN_DIR),
            "field_core": _build_field_core_bundle(STAPLE_DIR),
        }
        with _bundle_lock:
            _bundles = loaded
            _bundle_load_error = None
    except Exception as e:
        print(f"Model warmup failed: {e}")
        with _bundle_lock:
            _bundle_load_error = str(e)
    finally:
        _models_ready.set()


def get_sector_bundles() -> Dict[str, Dict[str, Any]]:
    """Used by /api/predict; blocks until background warmup finishes or fails."""
    if not _models_ready.wait(timeout=900):
        raise RuntimeError("Model loading timed out after 900s")
    with _bundle_lock:
        if _bundle_load_error:
            raise RuntimeError(_bundle_load_error)
        if _bundles is None:
            raise RuntimeError("Model loading did not produce bundles")
        return _bundles


def _decode_base64_image_field(img_field: Any) -> bytes:
    if img_field is None or not isinstance(img_field, str):
        raise ValueError("image must be a non-empty string")
    s = img_field.strip()
    if not s:
        raise ValueError("image string is empty")
    # Accept raw base64 or data URL
    if "," in s:
        s = s.split(",", 1)[1]
    # JSON / transports sometimes strip padding; Python requires length multiple of 4
    s = "".join(s.split())  # drop whitespace / newlines
    # URL-safe base64 from some clients
    s = s.replace("-", "+").replace("_", "/")
    pad = len(s) % 4
    if pad:
        s += "=" * (4 - pad)
    return base64.b64decode(s, validate=False)


def normalize_sector(raw: Any) -> str:
    if raw is None:
        return "orchard_canopy"
    s = str(raw).strip().lower().replace("-", "_")
    aliases = {
        "garden": "orchard_canopy",
        "fruit": "orchard_canopy",
        "orchard": "orchard_canopy",
        "plant_village": "orchard_canopy",
        "canopy": "orchard_canopy",
        "staple": "field_core",
        "field": "field_core",
        "cereal": "field_core",
        "grain": "field_core",
        "agricore": "field_core",
    }
    if s in aliases:
        return aliases[s]
    if s in SECTOR_IDS:
        return s
    return "orchard_canopy"


def format_output(
    idx: int,
    conf: float,
    class_labels: Dict[int, str],
    reverse_labels: Dict[int, Dict[str, str]],
    sector_id: str,
    used_grad_cam: bool,
):
    """Classifier-only JSON (no LLM). conf is top probability in [0, 1]. Chart fields use 0–100 %."""
    info = reverse_labels.get(idx, {"plant_type": "Unknown", "disease": "Unknown"})
    plant = info["plant_type"]
    disease = info["disease"]
    conf_frac = float(conf)
    conf_pct = round(conf_frac * 100, 2)

    raw_label = class_labels.get(idx, "")
    is_healthy = "healthy" in disease.lower()

    cam_note = (
        " Regions highlighted on the heatmap show where the CNN attends (Grad-CAM)."
        if used_grad_cam
        else ""
    )

    if is_healthy:
        description = (
            f"{plant} predicted healthy ({conf_pct}% confidence). "
            f"Training label: {raw_label or disease}."
        )
        not_affected_f = conf_frac * 0.95
        remaining = 1.0 - not_affected_f
        slightly_affected_f = round(remaining * 0.8, 6)
        affected_f = round(remaining * 0.2, 6)
    else:
        description = (
            f"Classifier top class: {raw_label or (plant + ' — ' + disease)} "
            f"({conf_pct}% probability).{cam_note}"
        )
        affected_f = conf_frac
        remaining = 1.0 - conf_frac
        slightly_affected_f = round(remaining * 0.7, 6)
        not_affected_f = round(remaining * 0.3, 6)
        total = affected_f + slightly_affected_f + not_affected_f
        if abs(total - 1.0) > 1e-6:
            not_affected_f = round(not_affected_f + (1.0 - total), 6)

    affected_pct = round(affected_f * 100, 2)
    slightly_pct = round(slightly_affected_f * 100, 2)
    not_pct = round(not_affected_f * 100, 2)

    enrich = enrich_prediction_context(
        plant=plant,
        disease=disease,
        raw_label=raw_label,
        conf_pct=conf_pct,
        affected_pct=affected_pct,
        slightly_pct=slightly_pct,
        not_affected_pct=not_pct,
        sector_id=sector_id,
        is_healthy=is_healthy,
    )
    desc_suffix = enrich.get("description_suffix", "").strip()
    if desc_suffix:
        description = f"{description.rstrip()} {desc_suffix}"

    meta = SECTOR_LABELS.get(sector_id, SECTOR_LABELS["orchard_canopy"])
    return {
        "disease_name": disease,
        "plant_type": plant,
        "confidence_score": conf_pct,
        "not_affected": not_pct,
        "slightly_affected": slightly_pct,
        "affected": affected_pct,
        "treatment": enrich["treatment"],
        "prevention_tips": enrich["prevention_tips"],
        "causes": enrich["causes"],
        "description": description,
        "sector": sector_id,
        "sector_title": meta["sector_title"],
        "sector_tagline": meta["sector_tagline"],
        "grad_cam": used_grad_cam,
    }

# --- AUTH ROUTES ---
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    name=data.get('name')
    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "User already exists"}), 409

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    new_user = User(email=email, password=hashed_password, name=name,is_verified=True)
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({"msg": "User Have Been Registered Successfully.", "email": email}), 201
    

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email).first()
    if user and bcrypt.check_password_hash(user.password, password):
        if not user.is_verified:
            return jsonify({"msg": "Verify email first."}), 403
        token = create_access_token(identity=user.id)
        return jsonify(access_token=token), 200
    return jsonify({"msg": "Invalid credentials"}), 401

@app.route('/api/auth/verify', methods=['POST'])
def verify_email():
    data = request.get_json()
    email = data.get('email')
    code = data.get('code')
    user = User.query.filter_by(email=email).first()

    if user and user.verification_code == code:
        user.is_verified = True
        user.verification_code = None
        db.session.commit()
        token = create_access_token(identity=user.id)
        return jsonify({"msg": "Verified!", "access_token": token}), 200
    return jsonify({"msg": "Invalid code"}), 400

@app.route('/api/forget-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    user = User.query.filter_by(email=email).first()
    if user:
        import random
        code = str(random.randint(100000, 999999))
        user.verification_code = code
        db.session.commit()
        send_email(email, 'Reset Code', f'Code: {code}')
        return jsonify({"msg": "Code sent",'code':code}), 200
    return jsonify({"msg": "User not found"}), 404

@app.route('/api/auth/reset', methods=['POST'])
def reset_password():
    data = request.get_json()
    email = data.get('email')
    code = data.get('code')
    new_password = data.get('new_password')
    user = User.query.filter_by(email=email).first()

    if user and user.verification_code == code:
        user.password = bcrypt.generate_password_hash(new_password).decode('utf-8')
        user.verification_code = None
        db.session.commit()
        return jsonify({"msg": "Password reset"}), 200
    return jsonify({"msg": "Invalid code"}), 400

@app.route('/api/auth/google', methods=['POST'])
def google_callback():
    try:
        data = request.get_json()
        token = data.get('token')
        
        # Verify Google Token
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            app.config['GOOGLE_WEB_CLIENT_ID']
        )

        email = idinfo['email']
        name = idinfo.get('name')
        google_id = idinfo['sub']

        user = User.query.filter_by(email=email).first()
        
        if not user:
            # Create new user for Google login
            user = User(
                email=email, 
                name=name, 
                google_id=google_id, 
                is_verified=True # Google users are pre-verified
            )
            db.session.add(user)
            db.session.commit()
        elif not user.google_id:
            # Link existing email user with Google
            user.google_id = google_id
            user.is_verified = True
            db.session.commit()

        access_token = create_access_token(identity=user.id)
        return jsonify(access_token=access_token), 200
        
    except ValueError as e:
        # Invalid token
        return jsonify({"error": "Invalid Google token", "details": str(e)}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/")
@app.route("/api/health")
def health():
    if not _models_ready.is_set():
        return jsonify({
            "ok": True,
            "service": "crop-disease-api",
            "model_loaded": False,
            "status": "loading_models",
            "sectors": {},
        }), 200

    with _bundle_lock:
        err = _bundle_load_error
        bundles = _bundles

    if err:
        return jsonify({
            "ok": False,
            "service": "crop-disease-api",
            "model_loaded": False,
            "status": "model_load_failed",
            "error": err,
            "sectors": {},
        }), 503

    assert bundles is not None
    sectors_out = {}
    any_ready = False
    for sid, b in bundles.items():
        sectors_out[sid] = {
            "artifact_dir": b["dir"],
            "onnx": b["onnx_ok"],
            "keras": b.get("keras_model") is not None,
            "grad_cam": b["torch_ok"],
            "ready": b["ready"],
            **SECTOR_LABELS.get(sid, {}),
        }
        any_ready = any_ready or b["ready"]
    return jsonify({
        "ok": True,
        "service": "crop-disease-api",
        "model_loaded": any_ready,
        "sectors": sectors_out,
    }), 200

# === PREDICT ROUTE ===
@app.route('/api/predict', methods=['POST'])
def predict():
    file = request.get_json(silent=True)
    if not file or "image" not in file:
        return jsonify({"error": "Missing JSON body or 'image' field"}), 400

    sector_id = normalize_sector(file.get("sector"))
    try:
        bundles = get_sector_bundles()
    except RuntimeError as e:
        return jsonify({"error": str(e), "sector": sector_id}), 503

    bundle = bundles.get(sector_id)
    if not bundle:
        return jsonify({"error": "Unknown sector", "sector": sector_id}), 400

    if not bundle["ready"]:
        return jsonify({
            "error": f"Model for sector '{sector_id}' is not deployed yet",
            "sector": sector_id,
            "hint": "Canopy Lab: FYP_PlantDisease with plant_disease_model.onnx. "
            "AgriCore: crop leaves  2nd models saved with crops_disease_predication.keras + class_labels.json "
            "(see /api/health for paths).",
        }), 503

    try:
        raw_bytes = _decode_base64_image_field(file.get("image"))

        img_sz = int(bundle["image_size"])
        mean_np = bundle["mean"]
        std_np = bundle["std"]
        mean_vec = np.asarray(mean_np, dtype=np.float32).reshape(3)
        std_vec = np.asarray(std_np, dtype=np.float32).reshape(3)

        overlay_b64: Optional[str] = None
        bundle_infer = None
        used_grad_cam = False
        try:
            if bundle["torch_ok"]:
                bundle_infer = torch_predict_with_overlay(
                    raw_bytes, mean_vec, std_vec, img_sz, bundle["dir"]
                )
                if bundle_infer:
                    used_grad_cam = True
        except Exception as cam_err:
            print(f"Grad-CAM / PyTorch predict failed ({sector_id}): {cam_err}")
            bundle_infer = None

        session = bundle["session"]
        class_labels = bundle["class_labels"]
        reverse_labels = bundle["reverse_labels"]
        keras_model = bundle.get("keras_model")

        if bundle_infer:
            probs, overlay_b64 = bundle_infer
            idx = int(np.argmax(probs))
            conf = float(probs[idx])
        elif keras_model is not None:
            probs = predict_keras_probs(
                keras_model,
                raw_bytes,
                img_sz,
                num_classes=len(class_labels),
            )
            idx = int(np.argmax(probs))
            conf = float(probs[idx])
        elif session:
            image_data = BytesIO(raw_bytes)
            batch = preprocess_image_bytes(image_data, img_sz, mean_np, std_np)
            probs = predict_proba(session, batch)[0]
            idx = int(np.argmax(probs))
            conf = float(probs[idx])
        else:
            return jsonify({"error": "No inference backend available for this sector"}), 503

        result = format_output(idx, conf, class_labels, reverse_labels, sector_id, used_grad_cam)
        if overlay_b64:
            result["heatmap_png_base64"] = overlay_b64
        return jsonify(result)
    except Exception as e:
        print(f"Prediction failed: {e}")
        return jsonify({"error": str(e)}), 500

threading.Thread(target=_warm_models_worker, name="model-warmup", daemon=True).start()

# --- RUN APP ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() in ('1', 'true', 'yes')
    app.run(host='0.0.0.0', debug=debug, port=port)