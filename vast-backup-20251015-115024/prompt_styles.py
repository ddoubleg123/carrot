# prompt_styles.py
from dataclasses import dataclass
from typing import Dict, List

NEGATIVE_BASE = (
    "blurry, lowres, bad anatomy, deformed, disfigured, extra limbs, bad hands, cross-eye, "
    "text, watermark, logo, jpeg artifacts, oversharpened, noisy, grainy, duplicate, malformed"
)

@dataclass
class StylePreset:
    name: str
    positive_tags: List[str]
    negative_tags: List[str]
    resolution: tuple  # (width, height)
    steps: int
    cfg: float
    hires: bool
    hires_scale: float
    hires_denoise: float

STYLE_PRESETS: Dict[str, StylePreset] = {
    # Photoreal portrait with perfect faces
    "photoreal_portrait": StylePreset(
        name="photoreal_portrait",
        positive_tags=[
            "ultra-detailed, photorealistic, 35mm, shallow depth of field, skin pores, natural light",
            "sharp focus, catchlight eyes, well-defined iris, symmetrical face, cinematic lighting"
        ],
        negative_tags=[NEGATIVE_BASE, "overprocessed skin, plastic skin, uncanny valley"],
        resolution=(1024, 1024),
        steps=35,
        cfg=7.0,
        hires=True,
        hires_scale=2.0,
        hires_denoise=0.35
    ),
    # Cinematic / Moody
    "cinematic": StylePreset(
        name="cinematic",
        positive_tags=[
            "cinematic still, volumetric light, film grain subtle, arri alexa, moody shadows, rim light",
            "masterpiece, best quality, sharp details"
        ],
        negative_tags=[NEGATIVE_BASE],
        resolution=(1024, 1024),
        steps=35,
        cfg=7.0,
        hires=True,
        hires_scale=1.5,
        hires_denoise=0.35
    ),
    # Fashion/Editorial
    "editorial": StylePreset(
        name="editorial",
        positive_tags=[
            "fashion editorial, studio lighting, softbox, crisp edges, glossy magazine look, rich color",
            "sharp eyes, perfect makeup, detailed hair strands, high contrast"
        ],
        negative_tags=[NEGATIVE_BASE, "overexposed highlights, blown highlights"],
        resolution=(1024, 1280),
        steps=36,
        cfg=7.2,
        hires=True,
        hires_scale=1.7,
        hires_denoise=0.38
    ),
    # Street/Documentary
    "street": StylePreset(
        name="street",
        positive_tags=[
            "documentary, candid, natural light, realistic color, fine texture, subtle grain"
        ],
        negative_tags=[NEGATIVE_BASE],
        resolution=(1024, 1024),
        steps=32,
        cfg=6.8,
        hires=True,
        hires_scale=1.5,
        hires_denoise=0.32
    ),
    # Neon / Cyberpunk
    "neon": StylePreset(
        name="neon",
        positive_tags=[
            "neon lights, reflective surfaces, rain-soaked streets, bokeh, high contrast, glows"
        ],
        negative_tags=[NEGATIVE_BASE],
        resolution=(1024, 1024),
        steps=35,
        cfg=7.5,
        hires=True,
        hires_scale=1.8,
        hires_denoise=0.36
    ),
    # Illustration: Watercolor
    "watercolor": StylePreset(
        name="watercolor",
        positive_tags=[
            "watercolor painting, soft edges, paper texture, delicate wash, hand-painted look"
        ],
        negative_tags=[NEGATIVE_BASE, "photoreal"],
        resolution=(1024, 1024),
        steps=28,
        cfg=7.0,
        hires=False,
        hires_scale=1.0,
        hires_denoise=0.0
    ),
    # Illustration: Art Deco Poster
    "art_deco_poster": StylePreset(
        name="art_deco_poster",
        positive_tags=[
            "art deco, bold geometry, limited palette, high contrast, poster design, clean lines"
        ],
        negative_tags=[NEGATIVE_BASE, "photoreal"],
        resolution=(1024, 1536),
        steps=30,
        cfg=7.2,
        hires=True,
        hires_scale=1.5,
        hires_denoise=0.30
    ),
    # Anime / Cel
    "anime": StylePreset(
        name="anime",
        positive_tags=[
            "anime style, crisp lineart, cel shading, vibrant colors, studio quality"
        ],
        negative_tags=[NEGATIVE_BASE, "realistic skin pores"],
        resolution=(1024, 1024),
        steps=28,
        cfg=7.0,
        hires=True,
        hires_scale=1.6,
        hires_denoise=0.33
    ),
}
