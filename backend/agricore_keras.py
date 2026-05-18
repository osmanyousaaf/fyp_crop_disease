"""Keras / TF inference for AgriCore five-crops model (MobileNetV2 head, 128×128)."""
from __future__ import annotations

import json
import os
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image

from fyp_plant_model import label_to_plant_disease


def staple_label_to_plant_disease(class_name: str) -> dict[str, str]:
    """Map flattened folder names (with or without ___) to plant + disease."""
    if "___" in class_name:
        return label_to_plant_disease(class_name)
    # Sugarcane classes in the flattened dataset (no plant prefix)
    sugar = {"Bacterial Blight", "Red Rot", "Healthy"}
    if class_name in sugar:
        dis = "Healthy" if class_name == "Healthy" else class_name
        return {"plant_type": "Sugarcane", "disease": dis}
    return {"plant_type": "Crop", "disease": class_name}


def load_agricore_keras_bundle(artifact_dir: str) -> dict[str, Any]:
    """
    Loads crops_disease_predication.keras (or .h5) + class_labels.json from artifact_dir.
    Returns bundle dict compatible with predict route (keras branch).
    """
    labels_path = os.path.join(artifact_dir, "class_labels.json")
    # Typo in shipped filename: predication
    keras_candidates = [
        os.path.join(artifact_dir, "crops_disease_predication.keras"),
        os.path.join(artifact_dir, "crops_disease_prediction.keras"),
        os.path.join(artifact_dir, "model.keras"),
    ]
    keras_path = next((p for p in keras_candidates if os.path.isfile(p)), None)

    out: dict[str, Any] = {
        "dir": artifact_dir,
        "keras_model": None,
        "class_labels": {},
        "reverse_labels": {},
        "image_size": 128,
        "ready": False,
        "onnx_ok": False,
        "torch_ok": False,
        "session": None,
        "mean": np.zeros((3, 1, 1), dtype=np.float32),
        "std": np.ones((3, 1, 1), dtype=np.float32),
    }

    if not os.path.isfile(labels_path):
        print(f"AgriCore: missing class_labels.json at {labels_path}")
        return out

    with open(labels_path, encoding="utf-8") as f:
        cfg = json.load(f)

    classes: list[str] = cfg["classes"]
    image_size = int(cfg.get("image_size", 128))
    out["image_size"] = image_size
    out["class_labels"] = {i: name for i, name in enumerate(classes)}
    out["reverse_labels"] = {i: staple_label_to_plant_disease(name) for i, name in enumerate(classes)}

    if not keras_path:
        print(f"AgriCore: no .keras model found in {artifact_dir}")
        return out

    try:
        import tensorflow as tf  # noqa: PLC0415 — heavy import

        model = tf.keras.models.load_model(keras_path, compile=False)
        out["keras_model"] = model
        out["ready"] = True
        print(f"AgriCore Keras model loaded: {keras_path}")
    except Exception as e:
        print(f"AgriCore Keras load failed: {e}")
        out["keras_model"] = None

    return out


def predict_keras_probs(model: Any, raw_bytes: bytes, image_size: int) -> np.ndarray:
    import tensorflow as tf  # noqa: PLC0415

    img = Image.open(BytesIO(raw_bytes)).convert("RGB").resize((image_size, image_size), Image.LANCZOS)
    arr = np.asarray(img, dtype=np.float32)
    batch = np.expand_dims(arr, axis=0)
    x = tf.keras.applications.mobilenet_v2.preprocess_input(batch)
    preds = model.predict(x, verbose=0)
    return np.asarray(preds, dtype=np.float64).reshape(-1)
