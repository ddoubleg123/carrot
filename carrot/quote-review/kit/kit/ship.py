"""Render every quote-card variation the photo can support.

A full-bleed layout (documentary, cinematic) is high quality only when the
photo's short side is at least 1080. Smaller frames are not enlarged to fake
that. Other layouts use the photo smaller, so a 1200px frame can still pass.

Each passing direction is rendered in every palette it owns. Layouts that
claim the words were spoken on a recording are skipped unless a timecode
is set.

Prints one stdout line: RESULT {json}
"""
import argparse
import json
import re
import sys
from pathlib import Path

import render
import treat
from PIL import Image

FULL_BLEED = ("documentary", "cinematic")
RECORDING = ("broadsheet", "transcript")


def number_span(quote):
    match = re.search(r"\d[\d,.]*(?:\s*[°%])?(?:\s+[A-Za-z][A-Za-z'-]{1,12}){0,2}", quote)
    if not match:
        return ""
    bit = match.group(0).strip()
    return bit if len(bit) <= 18 else ""


def prepare(card, photo: Path):
    im = treat.load(photo)
    native = im.size
    focal = treat.focal(im)
    found = treat.faces(im)
    if found:
        x, y, w, h = found[0]
        crop = f"{100 * (x + w / 2) / im.width:.1f}% 8%"
    else:
        crop = focal
    # Do not enlarge. A blown-up frame is the low-quality card.
    out = render.BUILD / "img" / card["id"]
    paths = {
        "grade": treat.save(treat.warm_grade(im), out / "grade"),
        "bw": treat.save(treat.bw(im), out / "bw"),
        "half": treat.save(treat.halftone(im), out / "half"),
    }
    for i, palette in enumerate(render.PAL["duotone"]):
        paths[f"duo{i}"] = treat.save(treat.duotone(im, palette["dark"], palette["light"]), out / f"duo{i}")
    return {k: v.as_uri() for k, v in paths.items()} | {
        "focal": focal, "crop": crop, "native": native, "upscale": 1.0,
    }


def tesseract_ready():
    import pytesseract
    for candidate in (
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
    ):
        if candidate.exists():
            pytesseract.pytesseract.tesseract_cmd = str(candidate)
            return True
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def judge(rec, direction):
    fails = []
    if not rec["fits"]:
        fails.append("text overflows")
    if not rec["string_match"]:
        fails.append("rendered words differ from string")
    if rec["face_covered"] and rec["face_covered"] > 0.15:
        fails.append("text covers face")
    if direction in render.PHOTO_CRITICAL and rec.get("photo_px_per_output_px", 1) < 0.5:
        fails.append("source too small for this direction")
    recall = rec.get("ocr_word_recall")
    if recall is None:
        fails.append("OCR could not run")
    elif recall < 0.85:
        fails.append("OCR could not read the words")
    return fails


def allowed_directions(short, big, recording):
    allowed, skipped = [], []
    for direction in render.DIRECTIONS:
        if direction == "stat" and not big:
            skipped.append(f"{direction}: no number to set large")
            continue
        if direction in RECORDING and not recording:
            skipped.append(f"{direction}: this is not a recording")
            continue
        if direction in FULL_BLEED and short < 1080:
            skipped.append(f"{direction}: short side {short}px, full bleed wants 1080")
            continue
        allowed.append(direction)
    return allowed, skipped


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True)
    parser.add_argument("--quote", required=True)
    parser.add_argument("--speaker", required=True)
    parser.add_argument("--photo", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--timecode", default="")
    args = parser.parse_args()

    photo = Path(args.photo)
    if not photo.exists():
        print("RESULT " + json.dumps({"passes": [], "error": "missing photo"}))
        return 1
    if not tesseract_ready():
        print("RESULT " + json.dumps({"passes": [], "error": "OCR is not installed"}))
        return 1

    quote = args.quote.strip()
    speaker = args.speaker.strip() or "Narration"
    big = number_span(quote)
    card = {
        "id": re.sub(r"[^a-z0-9-]", "", args.id.lower()) or "card",
        "quote": quote,
        "big": big,
        "speaker": speaker,
        "context": "",
        "date": "",
        "timecode": args.timecode.strip(),
    }
    short = min(Image.open(photo).size)
    directions, skipped = allowed_directions(short, big, bool(card["timecode"]))
    img = prepare(card, photo)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    passes = []

    from playwright.sync_api import sync_playwright

    (render.BUILD / "html").mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        try:
            browser = pw.chromium.launch(channel="chrome")
        except Exception:
            browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=2)
        for direction in directions:
            for index, palette in enumerate(render.PAL[direction]):
                packed = dict(img, duo=img[f"duo{index % len(render.PAL['duotone'])}"])
                body = render.RENDER[direction](card, palette, packed)
                doc = (
                    "<!doctype html><html><head><meta charset='utf-8'><style>"
                    f"{render.BASE_CSS}</style></head><body>{body}<script>{render.FIT_JS}</script></body></html>"
                )
                name = f"{card['id']}__{direction}__p{index + 1}"
                html_path = render.BUILD / "html" / f"{name}.html"
                html_path.write_text(doc, encoding="utf-8")
                page.goto(html_path.as_uri())
                page.evaluate("document.fonts.ready")
                page.evaluate(render.FIT_JS)
                info = page.evaluate("window.__qa")
                png = out / f"{name}.png"
                page.screenshot(path=str(png))
                page.add_style_tag(content=".fit,.attr,.kick{visibility:hidden!important}")
                photo_only = render.BUILD / "tmp_photo.png"
                page.screenshot(path=str(photo_only))
                fit = info["fit"][0] if info["fit"] else {}
                rec = {
                    "fits": fit.get("ok"),
                    "string_match": render.norm(info["text"]) == render.norm(render.typeset(quote)),
                    "face_covered": render.face_overlap(photo_only, fit["rect"]) if fit else None,
                }
                ph = info.get("photo")
                if ph and ph["w"]:
                    rec["photo_px_per_output_px"] = round(
                        min(img["native"][0] / (ph["w"] * 2), img["native"][1] / (ph["h"] * 2)), 2
                    )
                rec["ocr_word_recall"] = render.ocr_recall(png, quote)
                fails = judge(rec, direction)
                if fails:
                    png.unlink(missing_ok=True)
                    skipped.append(f"{name}: " + "; ".join(fails))
                    print(f"LOW {name} {'; '.join(fails)}", file=sys.stderr)
                    continue
                passes.append({
                    "direction": direction,
                    "palette": index + 1,
                    "file": str(png),
                    "quality": "high",
                })
                print(f"HIGH {name}", file=sys.stderr)
        browser.close()
    tmp = render.BUILD / "tmp_photo.png"
    if tmp.exists():
        tmp.unlink()
    print("RESULT " + json.dumps({"passes": passes, "skipped": skipped[:12], "short": short}))
    return 0 if passes else 1


if __name__ == "__main__":
    sys.exit(main())
