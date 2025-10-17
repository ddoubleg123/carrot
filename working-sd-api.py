#!/usr/bin/env python3
"""
Working Stable Diffusion API with proper error handling
Compatible with torch 2.4.0 and diffusers 0.30.0
"""
import os
import io
import base64
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Stable Diffusion API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
pipe = None
model_loaded = False

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, bad quality, distorted"
    num_inference_steps: int = 30
    guidance_scale: float = 7.5

@app.on_event("startup")
async def load_model():
    global pipe, model_loaded
    try:
        logger.info("Loading Stable Diffusion model...")
        from diffusers import StableDiffusionPipeline
        
        model_id = "runwayml/stable-diffusion-v1-5"
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16,
            safety_checker=None,
            requires_safety_checker=False
        )
        
        # Move to GPU if available
        if torch.cuda.is_available():
            pipe = pipe.to("cuda")
            logger.info(f"✓ Model loaded on GPU: {torch.cuda.get_device_name(0)}")
            logger.info(f"✓ VRAM available: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
        else:
            logger.warning("CUDA not available, using CPU (will be slow)")
        
        # Enable optimizations
        pipe.enable_attention_slicing()
        
        model_loaded = True
        logger.info("✅ Model loaded successfully!")
        
    except Exception as e:
        logger.error(f"❌ Failed to load model: {str(e)}", exc_info=True)
        model_loaded = False

@app.get("/")
async def root():
    return {
        "message": "Stable Diffusion API",
        "status": "running",
        "model_loaded": model_loaded,
        "cuda_available": torch.cuda.is_available(),
        "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": model_loaded,
        "cuda_available": torch.cuda.is_available()
    }

@app.post("/generate")
async def generate_image(request: GenerateRequest):
    if not model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded yet, please wait...")
    
    try:
        logger.info(f"Generating image for prompt: {request.prompt}")
        
        # Generate image
        with torch.inference_mode():
            result = pipe(
                prompt=request.prompt,
                negative_prompt=request.negative_prompt,
                num_inference_steps=request.num_inference_steps,
                guidance_scale=request.guidance_scale,
                height=512,
                width=512
            )
        
        image = result.images[0]
        
        # Convert to base64
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        logger.info("✓ Image generated successfully")
        
        return {
            "success": True,
            "image": f"data:image/png;base64,{img_str}",
            "prompt": request.prompt
        }
        
    except Exception as e:
        logger.error(f"Error generating image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860, log_level="info")
