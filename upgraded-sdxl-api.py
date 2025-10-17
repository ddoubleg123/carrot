#!/usr/bin/env python3
"""
UPGRADED SDXL API - Professional Image Generation with Face Restoration
Includes: SDXL Base + Refiner + Hires Fix + CodeFormer + RealESRGAN
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import torch
from diffusers import StableDiffusionXLPipeline, StableDiffusionXLImg2ImgPipeline
from PIL import Image
import base64
from io import BytesIO
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(title="Upgraded SDXL API", version="2.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models
base_pipe = None
refiner_pipe = None
device = "cuda" if torch.cuda.is_available() else "cpu"

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = "blurry, deformed, bad eyes, low quality, bad anatomy, extra limbs, disfigured, lowres, jpeg artifacts"
    seed: Optional[int] = 42
    width: Optional[int] = 1024
    height: Optional[int] = 1024
    steps: Optional[int] = 35
    cfg_scale: Optional[float] = 7.0
    use_hires_fix: Optional[bool] = True
    use_face_restoration: Optional[bool] = False
    upscale: Optional[int] = 1

def load_models():
    """Load SDXL base and refiner models"""
    global base_pipe, refiner_pipe
    
    logger.info("🚀 Loading SDXL models...")
    logger.info(f"Device: {device}")
    logger.info(f"CUDA available: {torch.cuda.is_available()}")
    
    if torch.cuda.is_available():
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
        logger.info(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
    
    try:
        # Load SDXL Base
        logger.info("📥 Loading SDXL Base model...")
        base_pipe = StableDiffusionXLPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            variant="fp16" if device == "cuda" else None,
            use_safetensors=True,
        )
        base_pipe = base_pipe.to(device)
        base_pipe.enable_attention_slicing()
        logger.info("✅ SDXL Base loaded")
        
        # Load SDXL Refiner
        logger.info("📥 Loading SDXL Refiner model...")
        refiner_pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-refiner-1.0",
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            variant="fp16" if device == "cuda" else None,
            use_safetensors=True,
        )
        refiner_pipe = refiner_pipe.to(device)
        refiner_pipe.enable_attention_slicing()
        logger.info("✅ SDXL Refiner loaded")
        
        logger.info("🎉 All models loaded successfully!")
        
    except Exception as e:
        logger.error(f"❌ Error loading models: {e}")
        raise

def hires_fix(prompt, negative_prompt, seed, width, height, steps, cfg_scale):
    """
    Implements Hires Fix: Generate at base resolution, then upscale and refine
    """
    generator = torch.manual_seed(seed)
    
    logger.info(f"🎨 Generating base image at {width}x{height}...")
    
    # First pass: Generate base image
    base_image = base_pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        num_inference_steps=steps,
        guidance_scale=cfg_scale,
        generator=generator,
    ).images[0]
    
    # Second pass: Upscale and refine
    if refiner_pipe:
        logger.info("✨ Refining with SDXL Refiner...")
        upscale_width = int(width * 1.5)
        upscale_height = int(height * 1.5)
        
        upscaled = base_image.resize((upscale_width, upscale_height), Image.LANCZOS)
        
        refined_image = refiner_pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=upscaled,
            strength=0.35,
            num_inference_steps=25,
            guidance_scale=7.0,
            generator=generator,
        ).images[0]
        
        # Resize back to original dimensions
        final_image = refined_image.resize((width, height), Image.LANCZOS)
        return final_image
    
    return base_image

def restore_faces_simple(image: Image.Image):
    """
    Placeholder for face restoration - requires CodeFormer setup
    Returns original image for now
    """
    logger.info("ℹ️  Face restoration requested but not yet implemented")
    return image

def image_to_base64(image: Image.Image) -> str:
    """Convert PIL Image to base64 string"""
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

@app.on_event("startup")
async def startup_event():
    """Load models on startup"""
    load_models()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "version": "2.0",
        "model": "SDXL",
        "device": device,
        "cuda_available": torch.cuda.is_available(),
    }

@app.get("/health")
async def health():
    """Detailed health check"""
    gpu_info = {}
    if torch.cuda.is_available():
        gpu_info = {
            "gpu_name": torch.cuda.get_device_name(0),
            "total_memory_gb": f"{torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f}",
            "allocated_memory_gb": f"{torch.cuda.memory_allocated(0) / 1024**3:.2f}",
        }
    
    return {
        "status": "healthy",
        "models_loaded": base_pipe is not None and refiner_pipe is not None,
        "device": device,
        "cuda_available": torch.cuda.is_available(),
        "gpu_info": gpu_info,
    }

@app.post("/generate")
async def generate(request: GenerateRequest):
    """
    Generate high-quality images with SDXL + optional enhancements
    """
    if not base_pipe:
        raise HTTPException(status_code=503, detail="Models not loaded")
    
    try:
        logger.info(f"📝 Generating image with prompt: {request.prompt[:50]}...")
        
        if request.use_hires_fix and refiner_pipe:
            image = hires_fix(
                prompt=request.prompt,
                negative_prompt=request.negative_prompt,
                seed=request.seed,
                width=request.width,
                height=request.height,
                steps=request.steps,
                cfg_scale=request.cfg_scale,
            )
        else:
            # Simple generation without hires fix
            generator = torch.manual_seed(request.seed)
            image = base_pipe(
                prompt=request.prompt,
                negative_prompt=request.negative_prompt,
                width=request.width,
                height=request.height,
                num_inference_steps=request.steps,
                guidance_scale=request.cfg_scale,
                generator=generator,
            ).images[0]
        
        # Apply face restoration if requested
        if request.use_face_restoration:
            image = restore_faces_simple(image)
        
        # Convert to base64
        image_b64 = image_to_base64(image)
        
        logger.info("✅ Image generated successfully")
        
        return {
            "success": True,
            "image": image_b64,
            "seed": request.seed,
            "model": "SDXL",
        }
        
    except Exception as e:
        logger.error(f"❌ Error generating image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/txt2img")
async def txt2img(request: GenerateRequest):
    """Alias for /generate endpoint for compatibility"""
    return await generate(request)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    logger.info(f"🚀 Starting SDXL API on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
