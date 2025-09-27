# Ghibli Image Generation Setup (Windows + Linux)

This document explains how to install dependencies to run Stable Diffusion + LoRA (sd-lora) and the prompt-only fallback.

The app pages are:
- Test page: `/test-ghibli`
- Status endpoint: `/api/ghibli/status`

The backend script that performs generation is:
- `scripts/ghibli/image_generate.py`

## Quick Capability Matrix

- Prompt-only PNG placeholder: No dependencies beyond Python. Runs anywhere.
- Uploaded-image placeholder: Requires Pillow (PIL). `pip install -r scripts/ghibli/requirements.txt`
- Stable Diffusion + LoRA (sd-lora): Requires PyTorch + diffusers (GPU recommended). `pip install -r scripts/ghibli/requirements-sd.txt` plus a matching torch.

## Environment Variables

Set these on your server (Render, local, etc.):

- `GHIBLI_SD_MODEL` (optional, default: `runwayml/stable-diffusion-v1-5`)
- `GHIBLI_LORA_WEIGHTS` (required for LoRA): Absolute path to a `.safetensors` file.
- `GHIBLI_SD_STEPS` (optional, default `25`)
- `GHIBLI_SD_GUIDANCE` (optional, default `7.5`)
- `GHIBLI_SD_WIDTH`/`GHIBLI_SD_HEIGHT` (optional, default `768x512`)

Check readiness at `/api/ghibli/status`.

---

## Windows Setup (PowerShell)

1) Check Python and pip versions

```powershell
python --version
pip --version
```

PyTorch currently supports Python 3.8–3.12. If you’re on 3.13, install 3.12.

2) Create and activate a virtual environment (recommended)

```powershell
python -m venv .venv
. .venv\Scripts\Activate.ps1
python --version
```

3) Install Pillow baseline (optional, for uploaded-image placeholder)

```powershell
pip install -r scripts/ghibli/requirements.txt
```

4) Install PyTorch + Diffusers (choose ONE of the following)

- GPU (CUDA 12.1). Works on NVIDIA GPUs with matching drivers:

```powershell
pip install --index-url https://download.pytorch.org/whl/cu121 torch torchvision torchaudio
pip install -r scripts/ghibli/requirements-sd.txt
```

- GPU (CUDA 11.8):

```powershell
pip install --index-url https://download.pytorch.org/whl/cu118 torch torchvision torchaudio
pip install -r scripts/ghibli/requirements-sd.txt
```

- CPU only (slow but works everywhere):

```powershell
pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision torchaudio
pip install -r scripts/ghibli/requirements-sd.txt
```

If you see "No matching distribution found", you likely have an unsupported Python version. Use Python 3.12.

5) Set env vars and verify

```powershell
$env:GHIBLI_LORA_WEIGHTS = "C:\\path\\to\\ghibli_style_lora.safetensors"
# Optional defaults
$env:GHIBLI_SD_MODEL = "runwayml/stable-diffusion-v1-5"
$env:GHIBLI_SD_STEPS = "25"
$env:GHIBLI_SD_GUIDANCE = "7.5"
```

Open `/api/ghibli/status` and confirm:
- `python: true`
- `torch: true`
- `loraExists: true`

Then open `/test-ghibli`, pick "Stable Diffusion + Ghibli LoRA", enter a prompt, and Run.

---

## Linux Setup (bash)

```bash
python3 --version
python3 -m venv .venv
source .venv/bin/activate

# Pillow baseline
pip install -r scripts/ghibli/requirements.txt

# GPU (CUDA 12.1) example
pip install --index-url https://download.pytorch.org/whl/cu121 torch torchvision torchaudio
pip install -r scripts/ghibli/requirements-sd.txt

# CPU fallback
# pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision torchaudio
# pip install -r scripts/ghibli/requirements-sd.txt

export GHIBLI_LORA_WEIGHTS=/abs/path/ghibli_style_lora.safetensors
export GHIBLI_SD_MODEL=runwayml/stable-diffusion-v1-5
export GHIBLI_SD_STEPS=25
export GHIBLI_SD_GUIDANCE=7.5
```

Check `/api/ghibli/status`, then use `/test-ghibli`.

---

## Troubleshooting

- "No matching distribution found for torch":
  - Ensure Python is 3.8–3.12. Python 3.13 is not yet supported.
  - Try CPU wheels or CUDA 11.8 wheels if 12.1 fails.
- Performance is slow:
  - You are on CPU. Use a GPU machine locally or a Vast.ai worker.
- LoRA not found:
  - Check `GHIBLI_LORA_WEIGHTS` path is absolute and readable by the server process.

### Windows: Python 3.13 cannot install torch/numpy

Symptoms:

```
ERROR: Could not find a version that satisfies the requirement torch (from versions: none)
ERROR: No matching distribution found for torch
```

or numpy attempts to build from source and fails due to missing Visual Studio build tools.

Root cause: As of now, official PyTorch and many binary wheels do not support Python 3.13 on Windows. Use Python 3.12 for the SD environment.

Fix (PowerShell):

```
# Requires Python 3.12 installed with the Python Launcher
py -3.12 -m venv .venv312
. .venv312\Scripts\Activate.ps1
python --version  # should be 3.12.x

# Install torch + diffusers stack (choose ONE)
# CUDA 12.1
pip install --index-url https://download.pytorch.org/whl/cu121 torch torchvision torchaudio
pip install -r scripts/ghibli/requirements-sd.txt

# CUDA 11.8
# pip install --index-url https://download.pytorch.org/whl/cu118 torch torchvision torchaudio
# pip install -r scripts/ghibli/requirements-sd.txt

# CPU only (slow)
# pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision torchaudio
# pip install -r scripts/ghibli/requirements-sd.txt

# Configure LoRA path and open status page
$env:GHIBLI_LORA_WEIGHTS = "C:\\absolute\\path\\ghibli_style_lora.safetensors"
Start-Process "http://localhost:3000/api/ghibli/status"
```

---

## Using LoRAs (style adapters)

LoRA files let you switch visual styles without retraining the whole model.

Where to place LoRA files on the worker
- Copy `.safetensors` files into `/models` on the Vast worker (or a different directory; set `GHIBLI_LORA_DIR` accordingly).

How to enable a LoRA
- Easiest (fixed LoRA): set an env var on the worker shell and restart the worker:
  - `export GHIBLI_LORA_WEIGHTS=/models/your_style.safetensors`
- Per-request (dynamic): in the Test UI (`/test-ghibli`), set:
  - LoRA path (on worker): `/models/your_style.safetensors`
  - LoRA strength: `0.0`–`1.0`
  - These are forwarded by the app route to the worker.

Server behavior
- If a LoRA path is provided in the request, the worker loads and applies it for that generation.
- Otherwise, if `GHIBLI_LORA_WEIGHTS` is set, the worker uses that as a default.
- If neither is set, generation uses the base model.

Optional worker update (minimal FastAPI)
If you bootstrapped a minimal worker, ensure its `/generate-image` accepts `lora` and `lora_alpha` form fields and loads them per request. See `scripts/ghibli/worker_app.py` for a reference implementation.

Prompting tips
- With strong LoRAs, keep prompts simple; the LoRA provides the aesthetic.
- Start with LoRA strength `0.8–1.0`, reduce if the look is too strong.

