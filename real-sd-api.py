#!/usr/bin/env python3
"""
Real Stable Diffusion API using the existing model
"""

import os
import io
import base64
import sys
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Add the model path to Python path
sys.path.insert(0, '/home/sduser/stable-diffusion-webui')

app = FastAPI(title="Real Stable Diffusion API")

# Global pipeline variable
pipeline = None

class ImageRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, low quality, distorted, text, watermark"
    width: int = 512
    height: int = 512
    steps: int = 20
    cfg_scale: float = 7.5
    seed: int = -1

def load_model():
    """Load the Stable Diffusion model using diffusers"""
    global pipeline
    try:
        print("Loading Stable Diffusion model from local checkpoint...")
        
        # Import here to avoid issues if not installed yet
        import torch
        from diffusers import StableDiffusionPipeline
        
        # Load from the existing safetensors file
        model_path = "/home/sduser/stable-diffusion-webui/models/Stable-diffusion/v1-5-pruned-emaonly.safetensors"
        
        pipeline = StableDiffusionPipeline.from_single_file(
            model_path,
            torch_dtype=torch.float16,
            use_safetensors=True,
            load_safety_checker=False
        )
        pipeline = pipeline.to("cuda")
        pipeline.enable_xformers_memory_efficient_attention()
        
        print("Model loaded successfully!")
        return True
    except Exception as e:
        print(f"Error loading model: {e}")
        import traceback
        traceback.print_exc()
        return False

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    load_model()

@app.get("/")
async def root():
    return {"message": "Real Stable Diffusion API", "status": "running", "model_loaded": pipeline is not None}

@app.get("/sdapi/v1/sd-models")
async def get_models():
    return [{"title": "v1-5-pruned-emaonly", "model_name": "v1-5-pruned-emaonly", "hash": ""}]

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
        
        # Generate image
        print(f"Generating REAL AI image with prompt: {request.prompt[:50]}...")
        
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
                "model": "v1-5-pruned-emaonly",
                "width": request.width,
                "height": request.height
            }
        }
        
    except Exception as e:
        print(f"Error generating image: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("Starting REAL Stable Diffusion API...")
    print("This will load the actual v1.5 model and generate REAL AI images")
    uvicorn.run(app, host="0.0.0.0", port=7860)

