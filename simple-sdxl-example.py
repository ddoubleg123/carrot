#!/usr/bin/env python3
"""
Simplified SDXL API Example
Demonstrates the clean, elegant flow of all features working together.
"""

from fastapi import FastAPI
from pydantic import BaseModel
from io import BytesIO
import base64
from PIL import Image
import torch

app = FastAPI()

# Simplified request model
class GenerateRequest(BaseModel):
    prompt: str
    seed: int = 42
    use_hires_fix: bool = True
    use_face_restoration: bool = True
    use_neural_upscaling: bool = True

@app.post("/generate")
def generate(request: GenerateRequest):
    """
    Clean generation pipeline:
    1. SDXL base + refiner + hires fix → 1536x1536
    2. Optional face restoration → Enhanced faces
    3. Optional neural upscaling → Superior quality
    """
    
    # Step 1: Generate with Hires Fix
    # Combines: base generation (768x768) + upscale + refiner
    if request.use_hires_fix:
        img = hires_fix(
            pipe_base=base_pipe, 
            pipe_refiner=refiner_pipe,
            prompt=request.prompt,
            seed=request.seed,
            use_realesrgan=request.use_neural_upscaling
        )
    else:
        # Standard generation
        img = generate_standard(request.prompt, request.seed)
    
    # Step 2: Optional face restoration
    if request.use_face_restoration:
        img = restore_faces(img, weight=0.6)
    
    # Step 3: Convert to base64
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "image": f"data:image/png;base64,{b64}",
        "resolution": f"{img.width}x{img.height}",
        "features_used": {
            "hires_fix": request.use_hires_fix,
            "face_restoration": request.use_face_restoration,
            "neural_upscaling": request.use_neural_upscaling
        }
    }

# Example usage
if __name__ == "__main__":
    """
    Usage:
    
    curl -X POST http://localhost:7860/generate \
      -H "Content-Type: application/json" \
      -d '{
        "prompt": "professional portrait",
        "seed": 42,
        "use_hires_fix": true,
        "use_face_restoration": true,
        "use_neural_upscaling": true
      }'
    
    Result: Maximum quality 1536x1536 image with all enhancements!
    """
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)

