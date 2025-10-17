# VAST.AI SDXL UPGRADE PLAN
## Complete Implementation Guide for Crisp, Realistic Face Generation

---

## 🎯 **GOAL**
Upgrade the current FastAPI-based Stable Diffusion 1.5 API (runwayml/stable-diffusion-v1-5) to produce **high-fidelity, photorealistic images** with **sharp, detailed, and symmetrical faces**. The final pipeline should deliver SDXL-level clarity, smooth edges, and natural lighting — all open source, no paid APIs.

---

## 🧱 **CURRENT SYSTEM OVERVIEW**
- **Environment:** FastAPI server (`working-sd-api.py`)
- **GPU:** RTX 3090 Ti (23.7 GB VRAM)
- **Model backend:** PyTorch, running on CUDA
- **Current base:** Stable Diffusion 1.5 (512×512)
- **Output format:** Base64-encoded PNG (in-memory)
- **Current status:** 100% disk full (40GB)

---

## 📊 **SPACE REQUIREMENTS & CLEANUP**

### **Current Status:**
- **Disk:** 100% full (40GB)
- **Problem:** SD 1.5 @ 512×512 produces blurry faces

### **Upgrade Requirements:**
- **SDXL Base:** ~7GB
- **SDXL Refiner:** ~7GB  
- **CodeFormer:** ~2GB
- **RealESRGAN:** ~1GB
- **Dependencies:** ~2GB
- **Total needed:** ~19GB

### **Cleanup Plan:**
1. **Basic cleanup:** ~3-4GB (PyTorch wheels, pip cache, temp files)
2. **HuggingFace cache analysis:** Need to free 15-20GB more
3. **Target:** Get to ~60-70% full (12-16GB free)

---

## 🔁 **IMPLEMENTATION STEPS**

### **STEP 1: DISK CLEANUP**

```bash
# SSH into Vast.ai
ssh -p 14688 root@ssh4.vast.ai

# Basic cleanup (frees ~3-4GB)
rm -rf /root/pytorch_wheels /root/.cache/pip /root/.cache/conda /root/setup.log
apt-get clean
rm -rf /tmp/* /var/tmp/*
find /root -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find /root -type f -name "*.pyc" -delete 2>/dev/null

# Check current space
df -h /

# Analyze HuggingFace cache
du -sh /root/.cache/huggingface
du -h --max-depth=2 /root/.cache/huggingface | sort -rh | head -20

# Clean old/unused models (BE CAREFUL - keep SDXL models)
# Remove old SD 1.5 models if not needed
rm -rf /root/.cache/huggingface/hub/models--runwayml--stable-diffusion-v1-5

# Check space again
df -h /
```

### **STEP 2: INSTALL REQUIRED PACKAGES**

```bash
# Install PyTorch and dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install diffusers transformers accelerate safetensors pillow basicsr facexlib insightface realesrgan

# Install CodeFormer
git clone https://github.com/sczhou/CodeFormer.git
cd CodeFormer && python setup.py develop && cd ..
```

### **STEP 3: DOWNLOAD AND LOAD CORE MODELS**

```python
from diffusers import StableDiffusionXLPipeline, StableDiffusionXLImg2ImgPipeline
import torch

device = "cuda"

# Load SDXL Base Model
base = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
).to(device)

# Load SDXL Refiner
refiner = StableDiffusionXLImg2ImgPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-refiner-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
).to(device)

# Load VAE (optional but recommended)
# Download vae-ft-mse-840000-ema-pruned.safetensors to models/vae/
```

### **STEP 4: IMPLEMENT HIRES FIX (TWO-PASS UPSCALE)**

```python
from PIL import Image

def hires_fix(pipe_base, pipe_refiner, prompt, seed):
    gen = torch.manual_seed(seed)
    
    # First pass: 768x768 low-denoise
    base_image = pipe_base(
        prompt=prompt,
        width=768,
        height=768,
        num_inference_steps=30,
        guidance_scale=7.5,
        generator=gen,
    ).images[0]

    # Second pass: upsample + low denoise
    upscaled = base_image.resize((1536, 1536), Image.LANCZOS)
    refined = pipe_refiner(
        prompt=prompt,
        image=upscaled,
        strength=0.35,
        num_inference_steps=25,
        guidance_scale=7.0,
        generator=gen,
    ).images[0]

    return refined
```

### **STEP 5: ADD CODEFORMER FACE RESTORATION**

```python
from basicsr.utils import imwrite
from facelib.utils.face_restoration_helper import FaceRestoreHelper
from CodeFormer.basicsr.archs.codeformer_arch import CodeFormer
import numpy as np

def restore_faces(image: Image.Image, weight=0.6):
    model = CodeFormer(dim_embd=512, codebook_size=1024, n_head=8, n_layers=9, connect_list=['32', '64', '128', '256'])
    model.eval().cuda()

    helper = FaceRestoreHelper(upscale_factor=1, device='cuda', det_model='retinaface_resnet50')
    helper.read_image(np.array(image))
    helper.get_face_landmarks_5()
    helper.align_warp_face()

    for cropped_face in helper.cropped_faces:
        with torch.no_grad():
            restored = model(cropped_face.cuda(), w=weight, adain=False)[0]
        helper.add_restored_face(restored)
    restored_img = helper.get_final_image()
    return Image.fromarray(restored_img)
```

### **STEP 6: ADD REALESRGAN UPSCALING (OPTIONAL)**

```python
from realesrgan import RealESRGAN

def upscale_image(image: Image.Image, scale=2):
    model = RealESRGAN(device, scale=scale)
    model.load_weights("weights/RealESRGAN_x2plus.pth")
    sr_image = model.predict(image)
    return sr_image
```

### **STEP 7: COMPLETE FASTAPI ENDPOINT**

```python
from fastapi import FastAPI
from io import BytesIO
import base64

app = FastAPI()

@app.post("/generate")
def generate(prompt: str, seed: int = 42):
    # SDXL base + refiner + hires fix
    img = hires_fix(base, refiner, prompt, seed)

    # Optional face restoration
    img = restore_faces(img)

    # Optional upscaling
    # img = upscale_image(img, scale=2)

    buffer = BytesIO()
    img.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode()
    return {"image": f"data:image/png;base64,{b64}"}
```

---

## ⚙️ **RECOMMENDED SETTINGS**

### **Default Parameters:**
- **Steps:** 35
- **Sampler:** DPM++ 2M Karras (or Euler A if unavailable)
- **CFG:** 7
- **Resolution:** 1024×1024
- **VAE:** vae-ft-mse-840000-ema-pruned.safetensors
- **Hires Fix:** enabled
- **Face Restoration:** CodeFormer (weight 0.6)
- **Upscaler:** R-ESRGAN (optional)

### **Negative Prompt:**
```
blurry, deformed, bad eyes, low quality, bad anatomy, extra limbs, disfigured, lowres, jpeg artifacts
```

---

## 🎯 **EXPECTED RESULTS**

✅ **Realistic, detailed, and symmetrical faces**  
✅ **Natural lighting, clear skin texture**  
✅ **Sharp edges and clean focus on eyes and mouth**  
✅ **Photoreal results comparable to A1111 + ADetailer + Hires Fix**

---

## 🔧 **CONFIGURATION STEPS**

### **Step 8: Update Environment Variables**

In your local `.env.local` file:
```
VAST_AI_URL=http://ssh4.vast.ai:7860
```

### **Step 9: Test the Upgrade**

1. Start the upgraded FastAPI server on Vast.ai
2. Test from your local app: `http://localhost:3005/test-image-generation`
3. Verify crisp, detailed faces are generated

---

## 🚨 **TROUBLESHOOTING**

### **If you run out of space:**
1. Check `df -h /` 
2. Clean more HuggingFace cache: `rm -rf /root/.cache/huggingface/hub/models--*/.git`
3. Remove old Docker images: `docker system prune -af --volumes`

### **If models won't load:**
1. Check CUDA memory: `nvidia-smi`
2. Verify models downloaded: `ls -la /root/.cache/huggingface/hub/`
3. Check PyTorch installation: `python -c "import torch; print(torch.cuda.is_available())"`

### **If face restoration fails:**
1. Install missing dependencies: `pip install insightface basicsr`
2. Download CodeFormer weights manually if needed
3. Check CUDA compatibility

---

## 📋 **VERIFICATION CHECKLIST**

- [ ] Disk space freed up (at least 20GB free)
- [ ] SDXL base model downloaded and loaded
- [ ] SDXL refiner model downloaded and loaded
- [ ] CodeFormer installed and working
- [ ] RealESRGAN installed (optional)
- [ ] FastAPI server updated with new pipeline
- [ ] Environment variables configured
- [ ] Test generation produces crisp faces
- [ ] Local app can connect to upgraded server

---

## 🎉 **FINAL NOTES**

This upgrade transforms your SD 1.5 API into a professional-grade image generation system capable of producing photorealistic faces and high-quality images. The pipeline chains SDXL → refiner → CodeFormer → RealESRGAN for maximum quality.

**Total time estimate:** 2-3 hours including download time
**VRAM usage:** ~14GB (well within your 23.7GB RTX 3090 Ti)
**Disk usage:** ~19GB additional (after cleanup)

---

*This plan ensures you get crisp, detailed, realistic faces without the blurriness of SD 1.5 at 512×512 resolution.*
