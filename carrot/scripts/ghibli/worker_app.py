import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from diffusers import StableDiffusionPipeline, StableDiffusionImg2ImgPipeline, EulerAncestralDiscreteScheduler
import torch
from PIL import Image
from io import BytesIO
from typing import Dict, Optional

app = FastAPI(title="Ghibli Worker")

MODEL = os.environ.get("GHIBLI_SD_MODEL", "runwayml/stable-diffusion-v1-5")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Base pipelines
_txt2img = StableDiffusionPipeline.from_pretrained(MODEL, torch_dtype=torch.float16 if DEVICE=='cuda' else torch.float32)
_txt2img.scheduler = EulerAncestralDiscreteScheduler.from_config(_txt2img.scheduler.config)
_txt2img = _txt2img.to(DEVICE)
_txt2img.enable_attention_slicing()

_img2img: Optional[StableDiffusionImg2ImgPipeline] = None

# Cache loaded LoRAs to avoid reloading from disk repeatedly
_loaded_loras: Dict[str, bool] = {}

def apply_lora(pipe, lora_path: str, alpha: float = 1.0):
    if not lora_path:
        return pipe
    try:
        pipe.load_lora_weights(lora_path, adapter_name="_session")
        # Some diffusers versions support setting the LoRA scale via set_adapters
        if hasattr(pipe, "set_adapters"):
            pipe.set_adapters(["_session"], adapter_weights=[alpha])
        if hasattr(pipe, "fuse_lora"):
            pipe.fuse_lora(lora_scale=alpha)  # type: ignore
        _loaded_loras[lora_path] = True
    except Exception as ex:
        raise RuntimeError(f"Failed to load LoRA {lora_path}: {ex}")
    return pipe

@app.get("/health")
def health():
    return {"ok": True, "device": DEVICE, "model": MODEL}

@app.get("/loras")
def list_loras():
    root = os.environ.get("GHIBLI_LORA_DIR", "/models")
    if not os.path.isdir(root):
        return {"ok": True, "items": []}
    items = [os.path.join(root, f) for f in os.listdir(root) if f.endswith(".safetensors")]
    return {"ok": True, "items": items}

@app.post("/generate-image")
async def generate_image(
    prompt: str = Form(...),
    model: str = Form("sd-lora"),
    lora: str | None = Form(None),
    lora_alpha: str | None = Form(None),
    image: UploadFile | None = File(None),
):
    try:
        alpha = 1.0
        if lora_alpha:
            try:
                alpha = float(lora_alpha)
            except Exception:
                alpha = 1.0
        # Decide which pipeline to use
        if image is not None:
            global _img2img
            if _img2img is None:
                _img2img = StableDiffusionImg2ImgPipeline.from_pretrained(MODEL, torch_dtype=torch.float16 if DEVICE=='cuda' else torch.float32)
                _img2img.scheduler = EulerAncestralDiscreteScheduler.from_config(_img2img.scheduler.config)
                _img2img = _img2img.to(DEVICE)
                _img2img.enable_attention_slicing()
            pipe = _img2img
        else:
            pipe = _txt2img

        # Optionally apply LoRA per request
        if lora:
            pipe = apply_lora(pipe, lora, alpha)

        if image is not None:
            buf = await image.read()
            init = Image.open(BytesIO(buf)).convert("RGB")
            out = pipe(prompt=prompt, image=init, strength=0.65, num_inference_steps=25, guidance_scale=7.5).images[0]
        else:
            out = pipe(prompt=prompt, width=768, height=512, num_inference_steps=25, guidance_scale=7.5).images[0]

        os.makedirs("/srv/outputs", exist_ok=True)
        out_path = f"/srv/outputs/out-{os.getpid()}.png"
        out.save(out_path)
        return JSONResponse({"ok": True, "outputPath": f"/files/{os.path.basename(out_path)}", "meta": {"device": DEVICE, "lora": bool(lora), "alpha": alpha}})
    except Exception as e:
        return JSONResponse({"ok": False, "message": str(e)}, status_code=500)

app.mount("/files", StaticFiles(directory="/srv/outputs"), name="files")
