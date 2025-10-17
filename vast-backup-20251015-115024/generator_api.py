# generator_api.py
import os, io, base64
from typing import Optional, Dict, Any
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image
import requests
import torch
from dotenv import load_dotenv

from diffusers import StableDiffusionXLPipeline, StableDiffusionXLImg2ImgPipeline
from prompt_builder import build_prompts, style_params, should_enhance
from firebase_utils import save_png_bytes_and_get_url

load_dotenv()

device = "cuda"

# ---- Lazy load models to save VRAM ----
_base_pipeline = None
_refiner_pipeline = None

def get_base_pipeline():
    global _base_pipeline
    if _base_pipeline is None:
        print("Loading SDXL Base pipeline...")
        _base_pipeline = StableDiffusionXLPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float16,
            variant="fp16",
        ).to(device)
    return _base_pipeline

def get_refiner_pipeline():
    global _refiner_pipeline
    if _refiner_pipeline is None:
        print("Loading SDXL Refiner pipeline...")
        _refiner_pipeline = StableDiffusionXLImg2ImgPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-refiner-1.0",
            torch_dtype=torch.float16,
            variant="fp16",
        ).to(device)
    return _refiner_pipeline

def unload_base():
    global _base_pipeline
    if _base_pipeline is not None:
        del _base_pipeline
        _base_pipeline = None
        torch.cuda.empty_cache()
        print("Unloaded base pipeline")

def unload_refiner():
    global _refiner_pipeline
    if _refiner_pipeline is not None:
        del _refiner_pipeline
        _refiner_pipeline = None
        torch.cuda.empty_cache()
        print("Unloaded refiner pipeline")

ENHANCER_URL = os.getenv("ENHANCER_URL", "http://localhost:30500/enhance")
print(f"Enhancer URL: {ENHANCER_URL}")

app = FastAPI(title="Generator API")

class GenerateReq(BaseModel):
    prompt: str
    seed: int = 42
    style: str = "photoreal_portrait"  # see prompt_styles.STYLE_PRESETS
    face_enhance: Optional[bool] = None  # None -> auto; True/False override
    upscale: int = 2  # final upscale on Server 2: 0, 2, or 4
    jpeg_proxy: bool = True  # compress when sending to enhancer to reduce payload

def image_to_bytes(img: Image.Image, fmt="PNG", quality=95) -> bytes:
    buf = io.BytesIO()
    if fmt.upper() == "JPEG":
        img.save(buf, format="JPEG", quality=quality)
    else:
        img.save(buf, format=fmt)
    return buf.getvalue()

def bytes_to_b64(b: bytes) -> str:
    return base64.b64encode(b).decode()

def b64_to_image(b64: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")

def hires_fix(prompt: str, negative: str, seed: int,
              width: int, height: int, steps: int, cfg: float, scale: float, denoise: float) -> Image.Image:
    g = torch.manual_seed(seed)

    # Pass 1: lower res with base
    base = get_base_pipeline()
    low_w, low_h = int(width / scale), int(height / scale)
    low_w = max(low_w, 768)
    low_h = max(low_h, 768)

    base_img = base(
        prompt=prompt,
        negative_prompt=negative,
        width=low_w,
        height=low_h,
        num_inference_steps=max(steps, 28),
        guidance_scale=cfg,
        generator=g,
    ).images[0]

    # Upscale to target
    upscaled = base_img.resize((width, height), Image.LANCZOS)
    
    # Unload base to free VRAM
    unload_base()

    # Pass 2: light denoise with refiner
    refiner = get_refiner_pipeline()
    refined = refiner(
        prompt=prompt,
        negative_prompt=negative,
        image=upscaled,
        strength=denoise,
        num_inference_steps=int(steps * 0.7),
        guidance_scale=cfg,
        generator=g,
    ).images[0]
    
    # Unload refiner
    unload_refiner()

    return refined

def maybe_enhance(img: Image.Image, do_face: bool, upscale: int, jpeg_proxy: bool) -> Image.Image:
    try:
        # Prepare payload
        if jpeg_proxy:
            payload_bytes = image_to_bytes(img, fmt="JPEG", quality=95)
        else:
            payload_bytes = image_to_bytes(img, fmt="PNG")

        resp = requests.post(
            ENHANCER_URL,
            json={
                "image_base64": bytes_to_b64(payload_bytes),
                "face_restore": bool(do_face),
                "codeformer_weight": 0.6,
                "upscale": int(upscale)
            },
            timeout=300
        )
        resp.raise_for_status()
        enhanced_b64 = resp.json()["enhanced_base64"]
        return b64_to_image(enhanced_b64)
    except Exception as e:
        print(f"Enhancement failed: {e}, returning original image")
        return img

@app.post("/generate")
def generate(req: GenerateReq):
    print(f"Received request: {req}")
    print(f"Prompt: {req.prompt}")
    print(f"Seed: {req.seed}")
    # Build prompts & params from style
    positive, negative = build_prompts(req.prompt, req.style)
    params = style_params(req.style)

    # SDXL + (optional) hires fix
    if params["hires"]:
        img = hires_fix(
            positive, negative, req.seed,
            params["width"], params["height"],
            params["steps"], params["cfg"],
            params["hires_scale"], params["hires_denoise"]
        )
    else:
        g = torch.manual_seed(req.seed)
        base = get_base_pipeline()
        img = base(
            prompt=positive,
            negative_prompt=negative,
            width=params["width"],
            height=params["height"],
            num_inference_steps=params["steps"],
            guidance_scale=params["cfg"],
            generator=g,
        ).images[0]
        
        # Unload base to free VRAM
        unload_base()
        
        # light refiner polish
        refiner = get_refiner_pipeline()
        img = refiner(
            prompt=positive, negative_prompt=negative,
            image=img, strength=0.25, num_inference_steps=int(params["steps"] * 0.6),
            guidance_scale=params["cfg"], generator=g
        ).images[0]
        
        # Unload refiner
        unload_refiner()

    # Decide if we enhance on Server 2
    auto_face = should_enhance(req.prompt)
    do_face = auto_face if req.face_enhance is None else req.face_enhance

    if do_face or req.upscale in (2, 4):
        img = maybe_enhance(img, do_face=do_face, upscale=req.upscale, jpeg_proxy=req.jpeg_proxy)

    # Encode PNG + Save to Firebase
    png_bytes = image_to_bytes(img, fmt="PNG")
    public_url = save_png_bytes_and_get_url(png_bytes, filename_prefix=req.style)

    # Return both Base64 and public URL + meta
    return {
        "image_base64": base64.b64encode(png_bytes).decode(),
        "public_url": public_url,
        "meta": {
            "prompt": req.prompt,
            "style": req.style,
            "seed": req.seed,
            "width": params["width"],
            "height": params["height"],
            "steps": params["steps"],
            "cfg": params["cfg"],
            "hires": params["hires"],
            "hires_scale": params["hires_scale"],
            "hires_denoise": params["hires_denoise"],
            "face_enhance": do_face,
            "upscale": req.upscale
        }
    }

@app.get("/health")
def health():
    return {"status": "healthy", "models_loaded": True}

@app.post("/test")
def test(request):
    print(f"Raw request body: {request}")
    return {"received": "ok"}
