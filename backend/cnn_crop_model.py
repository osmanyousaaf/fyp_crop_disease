"""Keras / TF inference for CropVision CNN model (20K Multi-Class Crop Disease, 128×128)."""
from __future__ import annotations

import json
import os
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image

from agricore_keras import staple_label_to_plant_disease


def load_cnn_crop_bundle(artifact_dir: str) -> dict[str, Any]:
    """
    Loads CNN_best_model.keras + class_labels.json from artifact_dir.
    Returns bundle dict compatible with predict route (keras branch).
    """
    labels_path = os.path.join(artifact_dir, "class_labels.json")
    keras_candidates = [
        os.path.join(artifact_dir, "CNN_best_model.keras"),
        os.path.join(artifact_dir, "cnn_best_model.keras"),
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
        print(f"CropVision: missing class_labels.json at {labels_path}")
        return out

    with open(labels_path, encoding="utf-8") as f:
        cfg = json.load(f)

    classes: list[str] = cfg["classes"]
    image_size = int(cfg.get("image_size", 128))
    out["image_size"] = image_size
    out["class_labels"] = {i: name for i, name in enumerate(classes)}
    out["reverse_labels"] = {i: staple_label_to_plant_disease(name) for i, name in enumerate(classes)}

    if not keras_path:
        print(f"CropVision: no .keras model found in {artifact_dir}")
        return out

    try:
        import tensorflow as tf  # noqa: PLC0415 — heavy import

        model = tf.keras.models.load_model(keras_path, compile=False)
        out["keras_model"] = model
        out["ready"] = True
        print(f"CropVision CNN model loaded: {keras_path}")
    except Exception as e:
        print(f"CropVision Keras load failed: {e}")
        out["keras_model"] = None

    return out


def predict_cnn_crop_probs(model: Any, raw_bytes: bytes, image_size: int) -> np.ndarray:
    """Run inference on the CropVision CNN model. Uses MobileNetV2 preprocessing."""
    import tensorflow as tf  # noqa: PLC0415

    img = Image.open(BytesIO(raw_bytes)).convert("RGB").resize((image_size, image_size), Image.LANCZOS)
    arr = np.asarray(img, dtype=np.float32)
    batch = np.expand_dims(arr, axis=0)
    x = tf.keras.applications.mobilenet_v2.preprocess_input(batch)
    preds = model.predict(x, verbose=0)
    return np.asarray(preds, dtype=np.float64).reshape(-1)
