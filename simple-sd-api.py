#!/usr/bin/env python3
"""
Simple Stable Diffusion API - Uses a more compatible approach
"""

import os
import io
import base64
import sys
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Simple Stable Diffusion API")

# Global pipeline variable
pipeline = None

class ImageRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, low quality, distorted, text, watermark, signature, logo"
    width: int = 512
    height: int = 512
    steps: int = 20
    cfg_scale: float = 7.5
    seed: int = -1

def load_model():
    """Load the Stable Diffusion model"""
    global pipeline
    try:
        print("🚀 Loading Stable Diffusion model...")
        
        import torch
        from diffusers import DiffusionPipeline
        
        # Use a simpler pipeline that's more compatible
        pipeline = DiffusionPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            torch_dtype=torch.float16,
            use_safetensors=True,
            safety_checker=None,
            requires_safety_checker=False
        )
        
        # Move to GPU
        pipeline = pipeline.to("cuda")
        
        print("✅ Stable Diffusion model loaded successfully!")
        print(f"✅ GPU: {torch.cuda.get_device_name()}")
        return True
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        import traceback
        traceback.print_exc()
        return False

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    load_model()

@app.get("/")
async def root():
    return {
        "message": "Simple Stable Diffusion API", 
        "status": "running", 
        "model_loaded": pipeline is not None
    }

@app.get("/sdapi/v1/sd-models")
async def get_models():
    return [{"title": "stable-diffusion-v1-5", "model_name": "stable-diffusion-v1-5", "hash": ""}]

@app.post("/sdapi/v1/txt2img")
async def generate_image(request: ImageRequest):
    try:
        global pipeline
        
        # Load model if not already loaded
        if pipeline is None:
            if not load_model():
                raise HTTPException(status_code=500, detail="Failed to load Stable Diffusion model")
        
        # Import torch here
        import torch
        
        # Set seed if provided
        generator = None
        if request.seed != -1:
            generator = torch.Generator(device="cuda").manual_seed(request.seed)
        
        # Generate REAL AI image
        print(f"🎨 Generating REAL AI image: {request.prompt[:50]}...")
        
        result = pipeline(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            num_inference_steps=request.steps,
            guidance_scale=request.cfg_scale,
            width=request.width,
            height=request.height,
            generator=generator
        )
        
        # Convert to base64
        image = result.images[0]
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')
        img_str = base64.b64encode(img_buffer.getvalue()).decode()
        
        print("✅ REAL AI image generated successfully!")
        
        return {
            "images": [img_str],
            "info": {
                "seed": request.seed if request.seed != -1 else 0,
                "model": "stable-diffusion-v1-5",
                "width": request.width,
                "height": request.height
            }
        }
        
    except Exception as e:
        print(f"❌ Error generating image: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("🚀 Starting Simple Stable Diffusion API...")
    print("🎯 This will generate ACTUAL AI images!")
    uvicorn.run(app, host="0.0.0.0", port=7860)