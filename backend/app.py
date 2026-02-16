from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import base64
from io import BytesIO
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import numpy as np
import tensorflow as tf
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import os
import requests
import json
import base64  # Added for base64 encoding
from datetime import timedelta
from typing import Dict, Any
# For email sending
from flask_mail import Mail, Message
from pydantic import BaseModel
import PIL
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import random
app = Flask(__name__)

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from langchain_community.cache import InMemoryCache
import langchain

# Enable in-memory cache
langchain.cache = InMemoryCache()

# --- Configuration ---
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'your-super-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:///crops.db"
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
app.config["TF_ENABLE_ONEDNN_OPTS"] = os.environ.get('TF_ENABLE_ONEDNN_OPTS`', 0)

# Flask-Mail Configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('EMAIL_USER')
app.config['MAIL_PASSWORD'] = os.environ.get('EMAIL_PASS')

# Google OAuth
app.config['GOOGLE_WEB_CLIENT_ID'] = os.environ.get('GOOGLE_WEB_CLIENT_ID')
app.config['GOOGLE_WEB_CLIENT_SECRET'] = os.environ.get('GOOGLE_WEB_CLIENT_SECRET')

# === Pydantic Schema for Gemini Output ===
class DiseaseResponse(BaseModel):
    disease_name: str
    plant:str
    confidence_score: float
    description: str
    cure_recommendation: list[str]
    prevention_tips: list[str]
    causes:list[str]
    not_affected: float
    slightly_affected: float
    affected: float

# === GEMINI SETUP ===
os.environ['GOOGLE_API_KEY']=os.environ.get('GOOGLE_GEMINI_API_KEY','AIzaSyBaacuG525Ivbyf5TclyR80Diu7V3KGe4U')
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1)
parser = JsonOutputParser(pydantic_object=DiseaseResponse)  # Fixed: Use pydantic schema

# Define this constant outside the function
GEMINI_LLM_STRING = "gemini-2.5-flash_temp0.1"



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

# === LOAD MODEL ===
model_path = "crops_disease_predication.keras"
try:
    model = tf.keras.models.load_model(model_path)
    print("Model loaded")
except Exception as e:
    print(f"Model failed: {e}")
    model = None

# === LABELS ===
CLASS_LABELS = {
    0: 'sugarcane_Bacterial Blight', 1: 'Corn___Common_Rust', 2: 'Corn___Gray_Leaf_Spot',
    3: 'Corn___Healthy', 4: 'Corn___Northern_Leaf_Blight', 5: 'sugarcane_Healthy',
    6: 'Potato___Early_Blight', 7: 'Potato___Healthy', 8: 'Potato___Late_Blight',
    9: 'sugarcane_Red_Rot', 10: 'Rice___Brown_Spot', 11: 'Rice___Healthy',
    12: 'Rice___Leaf_Blast', 13: 'Rice___Neck_Blast', 14: 'Wheat___Brown_Rust',
    15: 'Wheat___Healthy', 16: 'Wheat___Yellow_Rust'
}

REVERSE_LABELS = {}
for idx, label in CLASS_LABELS.items():
    if "___" in label:
        plant_raw, disease_raw = label.split("___")
    else:
        parts = label.split("_")
        plant_raw = parts[0]
        disease_raw = " ".join(parts[1:])
    
    plant_map = {"corn": "Corn", "sugarcane": "Sugarcane", "potato": "Potato", "rice": "Rice", "wheat": "Wheat"}
    plant = next((v for k, v in plant_map.items() if k in plant_raw.lower()), plant_raw.title())
    disease = disease_raw.replace("_", " ").strip()
    if "healthy" in disease.lower():
        disease = "Healthy"
    REVERSE_LABELS[idx] = {"plant_type": plant, "disease": disease}


def gemini_enrich(plant: str, disease: str) -> dict:
    prompt_text = f"""
    Plant: {plant}
    Disease: {disease}
    Return JSON with: description, cure_recommendation (list), prevention_tips (list),causes (list).
    {parser.get_format_instructions()}
    """
    

    cache_key_string = prompt_text # Use the full text as the prompt key

    llm_messages = (HumanMessage(content=prompt_text),)


    cached_result = langchain.cache.lookup(
        prompt=cache_key_string, 
        llm_string=GEMINI_LLM_STRING 
    )
    
    if cached_result:
        try:
            # cached_result is a list of BaseMessage objects
            return parser.parse(cached_result[0].content)
        except Exception as e:
            print(f"Error parsing cached Gemini result: {e}. Recalculating.")
            pass

    # If not in cache, run the LLM
    try:
        # 3. Run LLM using the list/tuple of message objects
        raw_llm_response = llm.invoke(llm_messages)
        

        langchain.cache.update(
            cache_key_string, 
            GEMINI_LLM_STRING, 
            (raw_llm_response,)
        )
        
        # 5. Return parsed result
        return parser.parse(raw_llm_response.content)

    except Exception as e:
        print(f"Gemini enrichment failed: {e}")
        return {
            "description": f"{disease} on {plant}.",
            "cure_recommendation": ["Consult expert"],
            "prevention_tips": ["Maintain hygiene"]
        }

def vision_fallback(image_file):
    # 4. Build the prompt with format instructions
    prompt = (
        "Analyze the plant image and return **only** valid JSON that follows this schema:\n"
        f"{parser.get_format_instructions()}"
    )

    message = HumanMessage(
        content=[
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": f"data:image/jpeg;base64,{image_file}"},
        ]
    )

    # 5. Call Gemini → parse JSON
    try:
        chain = llm | parser                     # llm is your ChatGoogleGenerativeAI instance
        raw = chain.invoke([message])
        
        # LangChain already returns a dict when using JsonOutputParser
        return {
            "disease_name": raw.get("disease_name", "Unknown"),
            'plant_type':raw.get('plant','unknown'),
            "confidence_score": float(raw.get("confidence_score", 0.0)),

            "description": raw.get("description", ""),
            "treatment": raw.get("cure_recommendation", []),
            "prevention_tips": raw.get("prevention_tips", []),
            'causes':raw.get('causes',[]),

            "not_affected": float(raw.get('not_affected',0.0)),
            "slightly_affected": float(raw.get('not_affected',0.0)),
            "affected": float(raw.get('affected',0.0)),
        }
    except Exception as e:
        print(f"[VISION FALLBACK ERROR] {e}")
        return {
            "disease_name": "Analysis failed",
            "confidence_score": 0.0,
            "description": "Gemini could not process the image.",
            "cure_recommendation": ["Retry with a clearer photo"],
            "prevention_tips": [],
        }

def format_output(idx: int, conf: float):
    info = REVERSE_LABELS.get(idx, {"plant_type": "Unknown", "disease": "Unknown"})
    plant = info["plant_type"]
    disease = info["disease"]
    conf = round(conf, 3)
    
    # Define default values
    treatment_list = []
    causes_list = []
    description = f"Prediction: {disease} on {plant} with confidence {conf}."
    
    if "healthy" in disease.lower():
        # HEALTHY CASE: Confidence is high for the Healthy class
        treatment = "No action needed."
        description = f"{plant} is healthy! Continue good farming practices."
        
        not_affected = conf * 0.95  # Use prediction confidence as a base for high certainty
        remaining = 1.0 - not_affected
        slightly_affected = round(remaining * 0.8, 3)
        affected = round(remaining * 0.2, 3)
        
    else:
        
        # Dynamic Scores for DISEASED: 'affected' is directly linked to disease confidence
        affected = conf
        remaining = 1.0 - conf
        
        slightly_affected = round(remaining * 0.7, 3)  # 70% of the remainder goes here
        not_affected = round(remaining * 0.3, 3)       # 30% of the remainder goes here
        
        # Ensure scores sum to 1.0 (with minor rounding adjustments)
        total = affected + slightly_affected + not_affected
        if total != 1.0:
             # Adjust the smallest category to ensure sum is 1.0
             not_affected = round(not_affected + (1.0 - total), 3)

        gemini_info = None
        # Re-run or run Gemini if needed for full information
        gemini_info = gemini_enrich(plant, disease)
        description = gemini_info.get("description", description)
        causes_list = gemini_info.get("causes", causes_list)
        treatment_list = gemini_info.get("cure_recommendation", treatment_list)
        # treatment = ", ".join(treatment_list)


    # --- UNIFIED RETURN STRUCTURE ---
    return {
        "disease_name": disease,
        "plant_type": plant,
        "confidence_score": conf,
        
        # Dynamic Severity Scores
        "not_affected": not_affected,
        "slightly_affected": slightly_affected,
        "affected": affected,
        
        "treatment": treatment_list,
        "prevention_tips":gemini_info.get('prevention_tips',[]),
        'causes':causes_list,
        "description": description
    }
    # return gemini_info

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

# === PREDICT ROUTE ===
@app.route('/api/predict', methods=['POST'])
def predict():
    if not model:
        return jsonify({"error": "Model not loaded"}), 503

    file = request.get_json(silent=True)
    if not 'image' in file:
        return jsonify({'error':'image not loaded or Empty','data':file}),404

    try:
        file = file.get('image') 
        file = file.split(',')[1]
        raw_base64 = base64.b64decode(file)
        image_data = BytesIO(raw_base64) # <--- This is the object Keras needs!

        img = tf.keras.preprocessing.image.load_img(image_data, target_size=(128, 128))
        
        # Continue with prediction
        arr = np.expand_dims(tf.keras.preprocessing.image.img_to_array(img) / 255.0, axis=0)
        pred = model.predict(arr, axis=1)[0]
        idx = int(np.argmax(pred))
        conf = float(pred[idx])

        if conf < 0.9:
            print(f"Low confidence {conf:.2f} -> Using Gemini Vision")
            # vision_fallback correctly handles the FileStorage object's stream
            result = vision_fallback(file) 
        else:
            result = format_output(idx, conf)
        return jsonify(result)
    except Exception as e:
        print(f"Prediction failed: {e}")
        return jsonify({"error": str(e)}), 500   

# --- RUN APP ---
if __name__ == '__main__':
    app.run(host='0.0.0.0',debug=True)