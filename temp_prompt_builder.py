# prompt_builder.py
from typing import Tuple
from prompt_styles import STYLE_PRESETS

FACE_KEYWORDS = ["portrait", "face", "selfie", "headshot", "person", "model", "bust", "upper body"]

def should_enhance(prompt: str) -> bool:
    p = prompt.lower()
    return any(k in p for k in FACE_KEYWORDS)

def build_prompts(user_prompt: str, style_key: str) -> Tuple[str, str]:
    style = STYLE_PRESETS.get(style_key, STYLE_PRESETS["photoreal_portrait"])
    positive = f"{user_prompt}, {', '.join(style.positive_tags)}"
    negative = ", ".join(style.negative_tags)
    return positive, negative

def style_params(style_key: str):
    style = STYLE_PRESETS.get(style_key, STYLE_PRESETS["photoreal_portrait"])
    return dict(
        width=style.resolution[0],
        height=style.resolution[1],
        steps=style.steps,
        cfg=style.cfg,
        hires=style.hires,
        hires_scale=style.hires_scale,
        hires_denoise=style.hires_denoise,
    )
