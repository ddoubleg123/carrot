"""Image treatments and focal-point detection. Pure PIL/numpy/OpenCV.

Every treatment starts from the full-resolution source PNG and writes a q95 JPEG
(or PNG for halftone) into build/img/. Nothing is resized below source size.
"""
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageFilter, ImageOps

_MODEL = str(Path(__file__).resolve().parent / "models" / "yunet.onnx")


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def load(path):
    return Image.open(path).convert("RGB")


def faces(im):
    """Face boxes (x, y, w, h) in pixel coords, largest first."""
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    s = min(1.0, 1280 / max(im.size))
    if s < 1:
        bgr = cv2.resize(bgr, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    det = cv2.FaceDetectorYN.create(_MODEL, "", (bgr.shape[1], bgr.shape[0]), 0.7)
    _, found = det.detect(bgr)
    if found is None:
        return []
    boxes = [tuple(int(v / s) for v in f[:4]) for f in found]
    return sorted(boxes, key=lambda f: -f[2] * f[3])


def focal(im):
    """CSS object-position for cover-crops: centre of the largest face, else upper third."""
    f = faces(im)
    if not f:
        return "50% 35%"
    x, y, w, h = f[0]
    return f"{100 * (x + w / 2) / im.width:.1f}% {100 * (y + h * 0.45) / im.height:.1f}%"


def upscale_if_needed(im, target_long=2160):
    """Last resort when no sharper source exists. Real-ESRGAN is better; see README.
    Returns (image, factor). factor > 1 means the card must be flagged."""
    long_side = max(im.size)
    if long_side >= target_long:
        return im, 1.0
    f = target_long / long_side
    big = im.resize((round(im.width * f), round(im.height * f)), Image.Resampling.LANCZOS)
    big = big.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    return big, f


def curve(arr, contrast=1.18, lift=0.03):
    x = arr / 255.0
    x = 0.5 + (x - 0.5) * contrast
    x = lift + x * (1 - lift)
    return np.clip(x, 0, 1) * 255


def bw(im):
    g = np.asarray(ImageOps.grayscale(im), dtype=np.float32)
    g = curve(g, 1.25, 0.02)
    return Image.fromarray(g.astype(np.uint8)).convert("RGB")


def duotone(im, dark, light):
    g = np.asarray(ImageOps.grayscale(ImageOps.autocontrast(im, cutoff=1)), dtype=np.float32) / 255.0
    g = g[..., None]
    out = hex_rgb(dark) * (1 - g) + hex_rgb(light) * g
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def warm_grade(im):
    a = np.asarray(im, dtype=np.float32)
    a = curve(a, 1.1, 0.0)
    a[..., 0] *= 1.04
    a[..., 2] *= 0.94
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def halftone(im, ink="#161412", cell=None):
    """Newsprint dot screen, rotated 45°, ink on transparent."""
    g = ImageOps.autocontrast(ImageOps.grayscale(im), cutoff=1)
    cell = cell or max(6, g.width // 140)
    rot = g.rotate(45, expand=True, fillcolor=255)
    a = np.asarray(rot, dtype=np.float32) / 255.0
    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    cx = (xx % cell) - cell / 2 + 0.5
    cy = (yy % cell) - cell / 2 + 0.5
    # mean darkness per cell
    small = rot.resize((max(1, W // cell), max(1, H // cell)), Image.Resampling.BOX)
    dark = 1 - np.asarray(small.resize((W, H), Image.Resampling.NEAREST), dtype=np.float32) / 255.0
    r = np.sqrt(dark) * cell * 0.72
    dots = (np.sqrt(cx ** 2 + cy ** 2) <= r).astype(np.uint8) * 255
    mask = Image.fromarray(dots).rotate(-45, expand=True)
    ox, oy = (mask.width - g.width) // 2, (mask.height - g.height) // 2
    mask = mask.crop((ox, oy, ox + g.width, oy + g.height))
    out = Image.new("RGBA", g.size, tuple(int(v) for v in hex_rgb(ink)) + (0,))
    out.putalpha(mask)
    return out


def save(im, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if im.mode == "RGBA":
        im.save(path.with_suffix(".png"), optimize=True)
        return path.with_suffix(".png")
    im.save(path.with_suffix(".jpg"), quality=95, subsampling=0)
    return path.with_suffix(".jpg")
