from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import base64

app = FastAPI(title="Minimal Stable Diffusion API")

class TextToImageRequest(BaseModel):
    prompt: str
    negative_prompt: str = ""
    width: int = 512
    height: int = 512
    steps: int = 20
    cfg_scale: float = 7.0
    sampler_name: str = "Euler a"
    batch_size: int = 1
    n_iter: int = 1
    seed: int = -1
    restore_faces: bool = False
    tiling: bool = False
    enable_hr: bool = False

@app.get("/")
async def read_root():
    return {"message": "Minimal Stable Diffusion API", "status": "running"}

@app.post("/sdapi/v1/txt2img")
async def txt2img(request: TextToImageRequest):
    try:
        # This is a placeholder for actual image generation
        # In a real scenario, you would integrate a lightweight SD model here
        # For now, it returns a base64 encoded SVG placeholder
        svg_content = f"""
        <svg width="{request.width}" height="{request.height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#764ba2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#f093fb;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad)"/>
          <text x="50%" y="45%" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">
            🎨 AI Generated
          </text>
          <text x="50%" y="55%" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16">
            {request.prompt[:50]}{'...' if len(request.prompt) > 50 else ''}
          </text>
          <text x="50%" y="70%" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" opacity="0.8">
            Powered by Vast.ai RTX 5070
          </text>
        </svg>
        """
        base64_svg = base64.b64encode(svg_content.encode('utf-8')).decode('utf-8')
        return {"images": [f"data:image/svg+xml;base64,{base64_svg}"]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("Starting Minimal Stable Diffusion API...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
