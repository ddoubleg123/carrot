"""Server render job. One quote record in, passing variants out.

The laptop does not run this. The Carrot container does, via:
    python3 service.py --job job.json --out /tmp/cards
The last stdout line is RESULT {json}.
"""
import argparse, json, re, sys, urllib.request
from pathlib import Path
from urllib.parse import urlparse

import treat
from render import FIT_JS, BASE_CSS, face_overlap, norm, ocr_recall, typeset
from render2 import DIR, P

ROOT = Path(__file__).resolve().parent
LOGO = ROOT.parents[1] / "public" / "carrot-logo.png"
MARK_CSS = """
html,body{height:1422px!important;background:#1C1917}
.made{width:1080px;height:72px;background:#1C1917;color:#F4F1EA;display:flex;align-items:center;gap:18px;padding:0 28px;font-family:Inter,sans-serif;font-size:28px;font-weight:500;letter-spacing:.04em}
.made .logo{width:36px;height:36px;overflow:hidden;display:flex;align-items:center;justify-content:center;flex:none}
.made img{height:64px;width:64px;max-width:none;object-fit:contain}
"""


def mark_html():
    logo = f"<span class='logo'><img src='{LOGO.as_uri()}' alt=''></span>" if LOGO.exists() else ""
    return f"<div class='made'>{logo}<span>gotcarrot.com</span></div>"

# CSS size of the photograph in each direction. A direction is eligible only when
# the source is at least that large, so the picture is never stretched.
PHOTO_BOX = {
    "split": (540, 660),
    "arch": (520, 600),
    "editorial": (352, 440),
    "broadsheet": (420, 540),
}
KNOBS = {
    "split": [dict(side="left", tone="bw", font="serif"), dict(side="right", tone="color", font="sans")],
    "cutout": [dict(), dict(band=True)],
    "arch": [dict(tone="color"), dict(tone="bw")],
    "editorial": [dict(tone="bw"), dict(tone="color")],
    "broadsheet": [dict()],
    "stat": [dict(pos="high"), dict(pos="low")],
    "datagraphic": [dict()],
    "transcript": [dict()],
    "pullquote": [dict()],
    "typeonly": [
        dict(hl="bar", font="sans", align="left"),
        dict(hl="under", font="serif", align="left"),
        dict(hl="ink", font="grotesk", align="center"),
    ],
    "poster": [dict(), dict(tall=True)],
    "gradient": [dict(g="dusk"), dict(g="sea"), dict(g="ember")],
    "record": [dict()],
}


def derive(card):
    quote = " ".join(card["quote"].split())
    card["quote"] = quote
    big = card.get("big") or ""
    if not big or big not in quote:
        found = re.search(r"\d[\d,.]*(?:\s*(?:years?|kilometers?|km|°C))?", quote)
        big = found.group(0) if found else ""
    card["big"] = big
    emphasis = card.get("emphasis") or ""
    card["emphasis"] = emphasis if emphasis and emphasis in quote else ""
    graphic = ""
    if re.fullmatch(r"10 years", big):
        graphic = "years10"
    elif re.fullmatch(r"26 years", big):
        graphic = "years26"
    elif "kilometer" in big or big.endswith("km"):
        graphic = "scale"
    elif "1.5" in big and "°" in quote:
        graphic = "gauge"
    card["graphic"] = graphic
    for key in ("speaker", "context", "date", "timecode"):
        card[key] = card.get(key) or ""
    return card


def fits(native, box):
    if not native:
        return False
    return native[0] >= box[0] and native[1] >= box[1]


def eligible(card, native, has_cutout):
    found = []
    for name, box in PHOTO_BOX.items():
        if fits(native, box):
            found.append(name)
    if has_cutout:
        found.append("cutout")
    if card.get("graphic"):
        found.append("datagraphic")
    if any(ch.isdigit() for ch in card.get("big") or ""):
        found.append("stat")
    if len(card["quote"].split()) < 30:
        found.append("poster")
    found += ["typeonly", "pullquote", "gradient", "record", "transcript"]
    if "editorial" not in found and card.get("big") and not native:
        found.append("editorial")
    seen = []
    for name in found:
        if name not in seen:
            seen.append(name)
    return seen


def candidates(card, native, has_cutout, limit):
    dirs = eligible(card, native, has_cutout)
    palettes = list(P)
    start = sum(ord(ch) for ch in card["id"]) % len(palettes)
    out = []
    for name in dirs:
        knobs = KNOBS[name]
        for knob in knobs[:2]:
            if name == "gradient":
                out.append((name, None, knob))
            else:
                palette = palettes[(start + len(out)) % len(palettes)]
                out.append((name, palette, dict(knob)))
            if len(out) >= limit:
                return out
    return out


def allowed_url(url):
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or not host:
        return False
    if host in {"localhost", "metadata.google.internal"} or host.endswith(".local"):
        return False
    if host.startswith("127.") or host.startswith("10.") or host.startswith("192.168.") or host.startswith("169.254."):
        return False
    return True


def has_residue(path):
    """A picture with burned-in words is not a picture we can use."""
    try:
        import pytesseract
        from PIL import Image
    except Exception:
        return False
    try:
        text = pytesseract.image_to_string(Image.open(path))
    except Exception:
        return False
    words = re.findall(r"[A-Za-z]{3,}", text or "")
    return len(words) >= 3


def fetch_picture(src, dest):
    if not src:
        return None
    path = Path(src)
    if path.exists():
        return path
    if not allowed_url(src):
        return None
    dest.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(src, headers={"User-Agent": "CarrotQuoteCard/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = response.read(12_000_001)
    if len(data) > 12_000_000 or len(data) < 1000:
        return None
    dest.write_bytes(data)
    return dest


def prepare(card, picture, out):
    """Treat the picture at its real size. No picture is a valid result."""
    if not picture:
        return {"focal": "50% 35%"}, None, False
    image = treat.load(picture)
    folder = Path(out) / "img"
    prepared = {"focal": "50% 35%", "native": image.size}
    try:
        prepared["focal"] = treat.focal(image)
    except Exception:
        pass
    prepared["grade"] = treat.save(treat.warm_grade(image), folder / "grade").as_uri()
    prepared["bw"] = treat.save(treat.bw(image), folder / "bw").as_uri()
    prepared["half"] = treat.save(treat.halftone(image, cell=6), folder / "half").as_uri()
    prepared["thumb"] = prepared["grade"]
    cut = Path(card["cutout"]) if card.get("cutout") else None
    has_cut = bool(cut and cut.exists() and treat.load(cut).size[1] >= 640)
    if has_cut:
        prepared["cut"] = cut.as_uri()
    return prepared, image.size, has_cut


def render_variants(card, img, jobs, out, check_ocr):
    from playwright.sync_api import sync_playwright
    folder = Path(out)
    (folder / "cards").mkdir(parents=True, exist_ok=True)
    (folder / "html").mkdir(parents=True, exist_ok=True)
    rows = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1422}, device_scale_factor=2)
        for index, (direction, palette, variant) in enumerate(jobs, 1):
            colors = P.get(palette) or P["ink"]
            body = DIR[direction](card, colors, img, variant)
            doc = f"<!doctype html><html><head><meta charset='utf-8'><style>{BASE_CSS}{MARK_CSS}</style></head><body>{body}{mark_html()}</body></html>"
            label = palette or variant.get("g") or "field"
            name = f"{index:02d}_{direction}__{label}"
            html_path = folder / "html" / f"{name}.html"
            html_path.write_text(doc, encoding="utf-8")
            page.goto(html_path.as_uri())
            page.evaluate("document.fonts.ready")
            page.evaluate(FIT_JS)
            info = page.evaluate("window.__qa")
            png = folder / "cards" / f"{name}.png"
            page.screenshot(path=str(png))
            page.add_style_tag(content=".fit,.attr,.kick{visibility:hidden!important}")
            hidden = folder / "tmp.png"
            page.screenshot(path=str(hidden))
            fit = (info or {}).get("fit") or [{"size": 0, "ok": False, "rect": [0, 0, 0, 0]}]
            first = fit[0]
            row = dict(
                direction=direction,
                palette=label,
                variant=variant,
                file=str(png),
                font_px=first["size"],
                fits=bool(first["ok"]),
                string_match=norm(info.get("text") or "") == norm(typeset(card["quote"])),
            )
            if img.get("grade"):
                try:
                    row["face_covered"] = face_overlap(hidden, first["rect"])
                except Exception:
                    row["face_covered"] = None
            photo = (info or {}).get("photo")
            if photo and photo.get("w") and img.get("native"):
                shown = max(photo["w"] / img["native"][0], photo["h"] / img["native"][1])
                row["src_px_per_card_px"] = round(1 / shown, 2) if shown else 0
            if check_ocr:
                try:
                    row["ocr_word_recall"] = ocr_recall(png, card["quote"])
                except Exception:
                    row["ocr_word_recall"] = None
            fails = []
            if not row["fits"]:
                fails.append("text overflows")
            if not row["string_match"]:
                fails.append("words differ from string")
            if row.get("face_covered") and row["face_covered"] > 0.15:
                fails.append("text covers face")
            if row.get("src_px_per_card_px", 9) < 1.0:
                fails.append("photo shown larger than its source")
            if row["font_px"] < 34 and direction != "transcript":
                fails.append("quote type under 34 px")
            row["fails"] = fails
            row["passed"] = not fails
            rows.append(row)
            print(f"{name} {row['font_px']}px {'PASS' if row['passed'] else 'FAIL ' + '; '.join(fails)}", file=sys.stderr)
        browser.close()
    hidden = folder / "tmp.png"
    if hidden.exists():
        hidden.unlink()
    return rows


def keep(rows, limit):
    """One direction and one palette. The first passing card of each idea."""
    chosen = []
    directions = set()
    palettes = set()
    for row in rows:
        if not row["passed"]:
            continue
        if row["direction"] in directions or row["palette"] in palettes:
            continue
        directions.add(row["direction"])
        palettes.add(row["palette"])
        chosen.append(row)
        if len(chosen) >= limit:
            break
    return chosen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--variants", type=int, default=12)
    parser.add_argument("--shortlist", type=int, default=8)
    parser.add_argument("--no-ocr", action="store_true")
    args = parser.parse_args()
    card = derive(json.loads(Path(args.job).read_text(encoding="utf-8")))
    if not card.get("speaker") or not card.get("quote"):
        print("RESULT " + json.dumps({"passes": [], "reason": "A card needs a quote and a source."}))
        return
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    picture = fetch_picture(card.get("picture") or "", out / "source")
    if picture and has_residue(picture):
        print("picture has burned-in text; using type directions", file=sys.stderr)
        picture = None
    img, native, has_cut = prepare(card, picture, out)
    jobs = candidates(card, native, has_cut, args.variants)
    rows = render_variants(card, img, jobs, out, not args.no_ocr)
    passes = []
    for row in keep(rows, args.shortlist):
        passes.append({
            "direction": row["direction"],
            "palette": row["palette"],
            "file": row["file"],
            "font_px": row["font_px"],
            "quality": "high",
        })
    (out / "qa.json").write_text(json.dumps({"card": card["id"], "rows": rows, "passes": passes}, indent=1), encoding="utf-8")
    print("RESULT " + json.dumps({"passes": passes}))


if __name__ == "__main__":
    main()
