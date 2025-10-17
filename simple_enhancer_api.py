import base64, io
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image

app = FastAPI(title="Simple Enhancer API")

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

@app.post("/enhance")
def enhance(req: EnhanceReq):
    img = b64_to_image(req.image_base64)
    
    # For now, just return the original image
    # TODO: Add CodeFormer and RealESRGAN when dependencies are fixed
    print(f"Enhancement requested: face_restore={req.face_restore}, upscale={req.upscale}")
    
    return {"enhanced_base64": image_to_b64(img)}

@app.get("/health")
def health():
    return {"status": "ok", "message": "Simple Enhancer API running"}
