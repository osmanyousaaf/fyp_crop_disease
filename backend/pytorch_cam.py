"""Predict + Grad-CAM overlay using plant_disease_model.pth (same weights as ONNX)."""
from __future__ import annotations

import base64
import io
import os
from typing import Optional, Tuple

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

from plant_cnn import PlantCNN


def _pil_from_bytes(raw: bytes) -> Image.Image:
    return Image.open(io.BytesIO(raw)).convert("RGB")


def _to_tensor(pil_img: Image.Image, size: int, mean: np.ndarray, std: np.ndarray) -> torch.Tensor:
    pil_img = pil_img.resize((size, size), Image.LANCZOS)
    arr = np.asarray(pil_img, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    t = torch.from_numpy(arr).unsqueeze(0)
    m = torch.from_numpy(mean.reshape(3, 1, 1))
    s = torch.from_numpy(std.reshape(3, 1, 1))
    s = torch.where(s == 0, torch.ones_like(s), s)
    t = (t - m) / s
    return t


def grad_cam_on_conv(model: PlantCNN, inp: torch.Tensor, target_class: int) -> np.ndarray:
    """Returns CAM map spatial same as last conv (before classifier), shape Hc x Wc."""
    conv_layer = model.features[16]  # final Conv2d (512 ch)
    activations: list[torch.Tensor] = []
    gradients: list[torch.Tensor] = []

    def fwd_hook(_m, _inp, out):
        activations.append(out.detach())

    def full_bwd_hook(_m, _gi, go):
        gradients.append(go[0].detach())

    h1 = conv_layer.register_forward_hook(fwd_hook)
    h2 = conv_layer.register_full_backward_hook(full_bwd_hook)

    model.zero_grad(set_to_none=True)
    try:
        with torch.enable_grad():
            inp = inp.clone().detach().requires_grad_(True)
            out = model(inp)
            score = out[0, target_class]
            score.backward()
    finally:
        h1.remove()
        h2.remove()

    act = activations[0]
    grad = gradients[0]
    weights = grad.mean(dim=(2, 3), keepdim=True)
    cam = (weights * act).sum(dim=1, keepdim=True)
    cam = F.relu(cam)
    cam = cam.squeeze().cpu().numpy()
    if cam.max() > cam.min():
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
    else:
        cam = np.zeros_like(cam)
    return cam


def _upsample_cam(cam_small: np.ndarray, out_hw: Tuple[int, int]) -> np.ndarray:
    h, w = out_hw
    t = torch.from_numpy(cam_small).float().unsqueeze(0).unsqueeze(0)
    up = F.interpolate(t, size=(h, w), mode="bilinear", align_corners=False)
    return up.squeeze().numpy()


def _blend_overlay(pil_rgb: Image.Image, cam01: np.ndarray, alpha: float = 0.45) -> Image.Image:
    """Jet-like heatmap over original."""
    orig = np.asarray(pil_rgb.resize(cam01.shape[::-1]), dtype=np.float32) / 255.0
    cm = np.stack(
        [
            np.clip(1.5 * cam01 - 0.2, 0, 1),
            np.clip(2 * cam01 - 0.5, 0, 1),
            np.clip(2.2 * (1 - cam01), 0, 1),
        ],
        axis=-1,
    )
    blended = (1 - alpha) * orig + alpha * cm
    blended = (np.clip(blended, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(blended)


def _dir_key(fyp_dir: str) -> str:
    return os.path.abspath(fyp_dir)


_torch_models: dict[str, PlantCNN] = {}


def load_torch_predictor(fyp_dir: str) -> bool:
    """Load PlantCNN for this artifact directory if plant_disease_model.pth exists (multi-dir)."""
    key = _dir_key(fyp_dir)
    if key in _torch_models:
        return True
    pth = os.path.join(fyp_dir, "plant_disease_model.pth")
    if not os.path.isfile(pth):
        return False
    try:
        ckpt = torch.load(pth, map_location="cpu", weights_only=False)
        nc = int(ckpt.get("num_classes", 38))
        model = PlantCNN(num_classes=nc)
        model.load_state_dict(ckpt["model_state_dict"], strict=True)
        model.eval()
        _torch_models[key] = model
        print(f"PyTorch PlantCNN loaded for Grad-CAM: {pth}")
        return True
    except Exception as e:
        print(f"PyTorch model load failed ({fyp_dir}): {e}")
        return False


def torch_predict_with_overlay(
    raw_bytes: bytes,
    mean: np.ndarray,
    std: np.ndarray,
    image_size: int,
    fyp_dir: str,
) -> Optional[Tuple[np.ndarray, str]]:
    """
    Returns (probs_np shape [num_classes], overlay_png_base64_no_prefix) or None if torch unavailable.
    """
    key = _dir_key(fyp_dir)
    model = _torch_models.get(key)
    if model is None:
        return None
    pil_full = _pil_from_bytes(raw_bytes)
    inp = _to_tensor(pil_full, image_size, mean, std)

    with torch.no_grad():
        logits = model(inp)
    probs = torch.softmax(logits[0], dim=0).cpu().numpy()
    pred_cls = int(np.argmax(probs))

    inp_grad = _to_tensor(pil_full, image_size, mean, std)
    cam_small = grad_cam_on_conv(model, inp_grad, pred_cls)
    cam_big = _upsample_cam(cam_small, (image_size, image_size))
    overlay_img = _blend_overlay(pil_full, cam_big)
    buf = io.BytesIO()
    overlay_img.save(buf, format="PNG")
    b64 = base64.standard_b64encode(buf.getvalue()).decode("ascii")
    return probs, b64
