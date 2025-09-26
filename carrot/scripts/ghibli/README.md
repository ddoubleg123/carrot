# Ghibli Style Lab Scripts

This folder contains minimal, reproducible pipelines to test Ghibli-style image and video generation using open-source tooling.

The code is intentionally simple and modular so you can swap in real models (AnimeGANv3, Diffutoon, SD + LoRA) later.

## Quick Start

1) Create a Python venv and install requirements:

```
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r scripts/ghibli/requirements.txt
```

2) Test image pipeline:

```
python scripts/ghibli/image_generate.py \
  --prompt "Ghibli style, peaceful countryside" \
  --model animeganv3 \
  --out /tmp/ghibli-image.png
```

3) Test video pipeline (requires ffmpeg):

```
python scripts/ghibli/video_stylize.py \
  --model animeganv3 \
  --input /path/to/input.mp4 \
  --out /tmp/ghibli-stylized.mp4 \
  --prompt "soft ghibli tone"
```

Both scripts print a single JSON line to stdout with `ok`, `outputPath`, and `meta`.

## Notes

- By default these scripts use simple stylization (PIL filters for images, `ffmpeg` edgedetect for video) as placeholders. Replace with real model inference when ready.
- Keep model paths dynamic via env vars or CLI flags; do not hardcode credentials or secrets.
- The Next.js API routes call these scripts as child processes and stream outputs back through `/api/ghibli/file?path=...`.
