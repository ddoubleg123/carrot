from fastapi import FastAPI
import torch
from diffusers import StableDiffusionXLPipeline

app = FastAPI(title="Generator API")

device = "cuda"
base = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
).to(device)

@app.get("/health")
def health():
    return {"status": "healthy", "models_loaded": True}
