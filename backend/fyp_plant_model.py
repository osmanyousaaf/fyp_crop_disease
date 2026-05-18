"""ONNX inference for FYP_PlantDisease (input NCHW float32, 256×256)."""
from __future__ import annotations

import json
import os
from io import BytesIO
from typing import Any

import numpy as np
import onnxruntime as ort
from PIL import Image


def _softmax_rows(logits: np.ndarray) -> np.ndarray:
    m = np.max(logits, axis=1, keepdims=True)
    ex = np.exp(logits - m)
    return ex / np.sum(ex, axis=1, keepdims=True)


def label_to_plant_disease(class_name: str) -> Dict[str, str]:
    if "___" in class_name:
        plant_raw, disease_raw = class_name.split("___", 1)
    else:
        plant_raw, disease_raw = class_name, ""
    plant = " ".join(plant_raw.replace("_", " ").split())
    disease = " ".join(disease_raw.replace("_", " ").split())
    if disease.lower() == "healthy":
        disease = "Healthy"
    return {"plant_type": plant, "disease": disease}


def load_fyp_bundle(fyp_dir: str) -> tuple[
    Any | None,
    dict[int, str],
    dict[int, dict[str, str]],
    int,
    np.ndarray,
    np.ndarray,
]:
    labels_path = os.path.join(fyp_dir, "class_labels.json")
    onnx_path = os.path.join(fyp_dir, "plant_disease_model.onnx")

    if not os.path.isfile(labels_path):
        print(f"FYP: missing class_labels.json at {labels_path}")
        return None, {}, {}, 256, np.zeros((3, 1, 1), dtype=np.float32), np.ones((3, 1, 1), dtype=np.float32)

    with open(labels_path, encoding="utf-8") as f:
        cfg = json.load(f)

    classes: list[str] = cfg["classes"]
    class_labels = {i: name for i, name in enumerate(classes)}
    reverse_labels = {i: label_to_plant_disease(name) for i, name in enumerate(classes)}
    image_size = int(cfg.get("image_size", 256))
    mean = np.array(cfg.get("mean", [0.0, 0.0, 0.0]), dtype=np.float32).reshape(3, 1, 1)
    std = np.array(cfg.get("std", [1.0, 1.0, 1.0]), dtype=np.float32).reshape(3, 1, 1)
    std = np.where(std == 0, 1.0, std)

    session = None
    if os.path.isfile(onnx_path):
        try:
            session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
            print(f"FYP plant disease ONNX loaded: {onnx_path}")
        except Exception as e:
            print(f"FYP ONNX load failed: {e}")
    else:
        print(f"FYP: plant_disease_model.onnx not found at {onnx_path}")

    return session, class_labels, reverse_labels, image_size, mean, std


def preprocess_image_bytes(raw_stream: BytesIO, image_size: int, mean: np.ndarray, std: np.ndarray) -> np.ndarray:
    img = Image.open(raw_stream).convert("RGB").resize((image_size, image_size), Image.LANCZOS)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    arr = np.expand_dims(arr, axis=0)
    arr = (arr - mean) / std
    return arr


def predict_proba(session: ort.InferenceSession, batch_nchw: np.ndarray) -> np.ndarray:
    input_name = session.get_inputs()[0].name
    logits = session.run(None, {input_name: batch_nchw})[0]
    return _softmax_rows(logits)
