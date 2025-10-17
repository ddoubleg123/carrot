import base64, io, os
from typing import Optional
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image
import numpy as np
import torch

# For now, disable the problematic imports
REALESRGAN_AVAILABLE = False
CODEFORMER_AVAILABLE = False
print("Note: Enhancement features disabled due to dependency issues")

app = FastAPI(title="Enhancer API")

# ---- Lazy globals ----
_g_esr_cache = {}
_g_codeformer = None

def load_codeformer():
    if not CODEFORMER_AVAILABLE:
        raise ImportError("CodeFormer not available")
    global _g_codeformer
    if _g_codeformer is None:
        _g_codeformer = CodeFormer(
            dim_embd=512, codebook_size=1024, n_head=8, n_layers=9,
            connect_list=['32','64','128','256']
        ).eval().cuda()
    return _g_codeformer

def get_esrgan(scale: int):
    if not REALESRGAN_AVAILABLE:
        raise ImportError("RealESRGAN not available")
    global _g_esr_cache
    if scale not in _g_esr_cache:
        model = RealESRGAN('cuda', scale=scale)
        # ensure weights exist at ./weights/
        model.load_weights(f"./weights/RealESRGAN_x{scale}plus.pth")
        _g_esr_cache[scale] = model
    return _g_esr_cache[scale]

class EnhanceReq(BaseModel):
    image_base64: str
    face_restore: bool = True
    codeformer_weight: float = 0.6
    upscale: int = 0  # 0, 2, or 4

def b64_to_image(b64: str) -> Image.Image:
    raw = base64.b64decode(b64)
    return Image.open(io.BytesIO(raw)).convert("RGB")

def image_to_b64(img: Image.Image, fmt="PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()

def restore_faces(image: Image.Image, weight: float = 0.6) -> Image.Image:
    if not CODEFORMER_AVAILABLE:
        print("CodeFormer not available, returning original image")
        return image
    
    model = load_codeformer()
    helper = FaceRestoreHelper(
        upscale_factor=1, device='cuda', det_model='retinaface_resnet50'
    )
    helper.read_image(np.array(image))
    helper.get_face_landmarks_5()
    helper.align_warp_face()

    # If no faces detected, return original
    if not helper.cropped_faces:
        return image

    with torch.no_grad():
        for cropped in helper.cropped_faces:
            restored = model(cropped.cuda(), w=weight, adain=False)[0]
            helper.add_restored_face(restored)

    final = helper.get_final_image()
    return Image.fromarray(final)

def upscale_image(image: Image.Image, scale: int) -> Image.Image:
    if not REALESRGAN_AVAILABLE:
        print("RealESRGAN not available, returning original image")
        return image
    
    model = get_esrgan(scale)
    return model.predict(image)

@app.post("/enhance")
def enhance(req: EnhanceReq):
    img = b64_to_image(req.image_base64)

    if req.face_restore:
        img = restore_faces(img, req.codeformer_weight)

    if req.upscale in (2, 4):
        img = upscale_image(img, req.upscale)

    return {"enhanced_base64": image_to_b64(img)}
