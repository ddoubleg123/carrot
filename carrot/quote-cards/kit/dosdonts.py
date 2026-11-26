"""Render deliberate 'don't' cards and pair each with a passing card from build2/.
Output: build2/pairs/pair_XX.png (labelled side-by-side) — run after render2.py."""
import json, glob
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from render import BASE_CSS, typeset
import treat

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "build2"
cards = {c["id"]: c for c in json.loads((ROOT / "cards2.json").read_text(encoding="utf-8"))["cards"]}
H = cards["house-floor"]
QH = typeset(H["quote"])
port = (ROOT / H["portrait"]).as_uri()

# low-res version for the stretched example
lo = Image.open(ROOT / H["portrait"]).convert("RGB").resize((150, 184), Image.Resampling.BILINEAR)
(OUT / "img").mkdir(parents=True, exist_ok=True)
lo.save(OUT / "img" / "lowres.jpg", quality=55)
lowres = (OUT / "img" / "lowres.jpg").as_uri()

DONTS = {
 "tiny": f"""<div class="card" style="background:#f3efe6;color:#222;font-family:Georgia">
<img src="{port}" style="position:absolute;left:90px;top:110px;width:150px;height:150px;object-fit:cover">
<div style="position:absolute;left:280px;top:118px;right:110px;font-size:22px;line-height:1.4">{QH}</div>
<div style="position:absolute;left:90px;right:90px;bottom:120px;border-top:3px solid #bbb;padding-top:16px;font:13px Arial;color:#888">REP. MARK DESAULNIER · HOUSE FLOOR · 18 NOVEMBER 2026</div></div>""",
 "stretched": f"""<div class="card" style="background:#000">
<img src="{lowres}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;image-rendering:auto">
<div style="position:absolute;left:0;right:0;bottom:0;height:520px;background:#1e5aa8;color:#fff;padding:50px;font:600 40px Arial;line-height:1.3">{QH}</div></div>""",
 "face": f"""<div class="card" style="background:#000">
<img src="{port}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(0)">
<div style="position:absolute;left:120px;right:120px;top:330px;background:rgba(255,255,255,.92);border-radius:28px;padding:44px;font:500 40px Arial;line-height:1.3;color:#111">{QH}</div></div>""",
 "cut": f"""<div class="card" style="background:#111;color:#fff">
<div style="position:absolute;left:80px;right:80px;top:300px;font-family:Instrument;font-size:96px;line-height:1.05">&ldquo;In my pocket I have pills that were largely developed by American taxpayers&hellip;&rdquo;</div>
<div class="attr" style="position:absolute;left:80px;bottom:90px">Rep. Mark DeSaulnier</div></div>""",
 "rainbow": f"""<div class="card" style="background:linear-gradient(135deg,#ff00cc,#3333ff 50%,#00ffcc);color:#ffeb3b">
<div style="position:absolute;left:60px;right:60px;top:90px;font:900 54px Impact;color:#fff;text-shadow:4px 4px 0 #000">FOR THE FIRST TIME IN</div>
<div style="position:absolute;left:60px;right:60px;top:180px;font:italic 700 120px 'Comic Sans MS',cursive;color:#ffeb3b;text-shadow:5px 5px 0 #f00">26 YEARS,</div>
<div style="position:absolute;left:60px;right:60px;top:360px;font:400 50px 'Courier New';color:#0f0;background:#000a;padding:20px">the US has lost its measles-free status.</div>
<div style="position:absolute;left:60px;right:60px;top:560px;font:700 46px Georgia;color:#fff;font-style:italic">It's currently going through the largest outbreak in over three decades.</div>
<div style="position:absolute;left:60px;bottom:60px;font:20px Arial;color:#fff">💉🔥 NARRATION</div></div>""",
 "residue": f"""<div class="card" style="background:#000">
<img src="{port}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
<div style="position:absolute;right:40px;top:40px;background:#c00;color:#fff;font:800 30px Arial;padding:8px 16px">NEWS 24 LIVE</div>
<div style="position:absolute;left:0;right:0;bottom:430px;height:70px;background:#0a2a66;color:#fff;font:700 34px Arial;padding:14px 40px">rkey · ER 20, 20</div>
<div style="position:absolute;left:0;right:0;bottom:0;height:430px;background:#7a1f1f;color:#fff;padding:44px;font:500 34px Arial;line-height:1.3">{QH}</div></div>""",
 "emphasis": f"""<div class="card" style="background:#f6f4ef;color:#111">
<div style="position:absolute;left:80px;right:80px;top:160px;font:500 64px Inter;line-height:1.2;letter-spacing:-.02em">
<b style="color:#e11d48">AI</b> will <u>create jobs</u> <span style="background:#fde047">more rapidly</span> and it will <b style="color:#2563eb;font-size:1.3em">DISPLACE</b> <i>jobs</i> <span style="background:#86efac">more rapidly</span> than the <b><u style="color:#9333ea">prior ones.</u></b></div>
<div class="attr" style="position:absolute;left:80px;bottom:90px">Mr. Gallagher</div></div>""",
}

PAIRS = [  # (dont key, do card number, title, why)
 ("tiny", 18, "Make the words the hero", "Don't: 22 px type in a sea of empty cream. Do: quote auto-fit to its block."),
 ("stretched", 1, "Never stretch a small picture", "Don't: a 150 px frame blown up to full-bleed. Do: show it at or below its native size."),
 ("face", 3, "Keep text off the face", "Don't: a plate across the eyes and mouth. Do: picture and words get their own space."),
 ("cut", 6, "Never cut the sentence", "Don't: trim to fit and add an ellipsis. Do: give the full sentence a roomier layout."),
 ("rainbow", 21, "One display face, one palette", "Don't: five fonts, a gradient and emoji. Do: one face, three colors, one emphasis."),
 ("residue", 4, "Remove broadcast residue", "Don't: network bugs, chyrons and fragments. Do: clean picture, crop or cut out at source."),
 ("emphasis", 44, "One emphasis, not five", "Don't: bold, color, underline and highlight together. Do: a single highlighted phrase."),
]


def font(sz, bold=False):
    for f in (["/usr/share/fonts/opentype/inter/Inter-Bold.otf"] if bold else ["/usr/share/fonts/opentype/inter/Inter-Regular.otf"]):
        try:
            return ImageFont.truetype(f, sz)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    from playwright.sync_api import sync_playwright
    d = OUT / "donts"; d.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        pg = br.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=1)
        for k, body in DONTS.items():
            hp = d / f"{k}.html"
            hp.write_text(f"<!doctype html><html><head><meta charset='utf-8'><style>{BASE_CSS}</style></head><body>{body}</body></html>", encoding="utf-8")
            pg.goto(hp.as_uri()); pg.evaluate("document.fonts.ready")
            pg.screenshot(path=str(d / f"{k}.png"))
        br.close()
    pd = OUT / "pairs"; pd.mkdir(exist_ok=True)
    cw, ch = 720, 900
    for i, (k, n, title, why) in enumerate(PAIRS, 1):
        good = glob.glob(str(OUT / "cards" / f"{n:02d}_*.png"))[0]
        W, Hh = cw * 2 + 120, ch + 230
        im = Image.new("RGB", (W, Hh), "#faf8f4")
        dr = ImageDraw.Draw(im)
        dr.text((40, 30), title, font=font(40, True), fill="#1c1917")
        dr.text((40, 86), why, font=font(22), fill="#57534e")
        for j, (src, lab, col) in enumerate([(d / f"{k}.png", "DON'T", "#b91c1c"), (good, "DO", "#15803d")]):
            x = 40 + j * (cw + 40)
            card = Image.open(src).convert("RGB").resize((cw, ch), Image.Resampling.LANCZOS)
            im.paste(card, (x, 150))
            dr.rectangle([x, 150 + ch, x + cw, 150 + ch + 50], fill=col)
            dr.text((x + 20, 150 + ch + 9), lab, font=font(26, True), fill="white")
        im.save(pd / f"pair_{i:02d}_{k}.png")
        print(pd / f"pair_{i:02d}_{k}.png")


if __name__ == "__main__":
    main()
