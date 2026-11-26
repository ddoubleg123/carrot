"""Render quote cards in ten art directions at 1080x1350 CSS px, 2x device scale (2160x2700 PNG).

    python render.py                       # all cards x all directions
    python render.py --cards lake --dirs documentary,stat
    python render.py --palettes 3          # 3 palette variants per direction

Outputs build/cards/<card>__<direction>__p<n>.png, build/qa.json, build/review.pdf
"""
import argparse, html, json, re, shutil
from pathlib import Path
from PIL import Image
import numpy as np
import treat

ROOT = Path(__file__).resolve().parent
BUILD = ROOT / "build"
FONTS = (ROOT / "fonts").as_uri()

# ---------------------------------------------------------------- palettes
# Curated, not random. Each direction owns a small set so variation stays on-brand.
PAL = {
    "documentary": [dict(accent="#e4572e"), dict(accent="#f2c14e"), dict(accent="#7fd1b9")],
    "duotone": [dict(dark="#10182b", light="#f0b44c", ink="#fff6e5", acc="#f0b44c"),
                dict(dark="#2a0c1f", light="#ff7a59", ink="#fff1ea", acc="#ffd2c2"),
                dict(dark="#06231f", light="#b9e3c6", ink="#f2fff6", acc="#b9e3c6")],
    "editorial": [dict(bg="#f3eee4", ink="#191714", acc="#b2361c"),
                  dict(bg="#eef0ea", ink="#141a17", acc="#2f6b4f"),
                  dict(bg="#f1ece8", ink="#1b1522", acc="#5b3fa0")],
    "stat": [dict(bg="#0f0f0f", ink="#f4f1ea", acc="#ff5a36"),
             dict(bg="#f4f1ea", ink="#111111", acc="#1747d8"),
             dict(bg="#122620", ink="#eaf4ee", acc="#c6f26b")],
    "broadsheet": [dict(bg="#ebe5d8", ink="#151412", acc="#9c2a1b"),
                   dict(bg="#e7e3d6", ink="#10151c", acc="#24476b")],
    "typeonly": [dict(bg="#ff5a36", ink="#120d0a", mark="#fff3e0"),
                 dict(bg="#e9e4d4", ink="#121212", mark="#ffd23f"),
                 dict(bg="#1b2a4a", ink="#f3efe6", mark="#3e63dd")],
    "cinematic": [dict(acc="#f5d76e"), dict(acc="#ffffff")],
    "transcript": [dict(bg="#f6f4ef", ink="#1d1c1a", hl="#ffe27a", acc="#c2410c"),
                   dict(bg="#101214", ink="#e6e3dc", hl="#3a4a1f", acc="#a3e635")],
    "backdrop": [dict(tint="rgba(8,10,20,.55)", acc="#9ad1ff"),
                 dict(tint="rgba(30,10,4,.55)", acc="#ffb38a")],
    "pullquote": [dict(bg="#f5efe3", ink="#1a1612", acc="#d1495b"),
                  dict(bg="#0e1a2b", ink="#f2ede4", acc="#edae49"),
                  dict(bg="#ecefe9", ink="#17201b", acc="#00798c")],
}
DIRECTIONS = list(PAL)
# Directions that show the photo large and untreated: low-res sources are flagged here.
PHOTO_CRITICAL = {"documentary", "backdrop", "cinematic"}

BASE_CSS = f"""
@font-face{{font-family:Instrument;src:url({FONTS}/InstrumentSerif-Regular.ttf)}}
@font-face{{font-family:Instrument;font-style:italic;src:url({FONTS}/InstrumentSerif-Italic.ttf)}}
@font-face{{font-family:Fraunces;src:url({FONTS}/Fraunces.ttf);font-weight:100 900}}
@font-face{{font-family:Anton;src:url({FONTS}/Anton-Regular.ttf)}}
@font-face{{font-family:Grotesk;src:url({FONTS}/SpaceGrotesk.ttf);font-weight:300 700}}
@font-face{{font-family:Plex;src:url({FONTS}/IBMPlexMono-Medium.ttf)}}
@font-face{{font-family:Oswald;src:url({FONTS}/Oswald.ttf);font-weight:200 700}}
@font-face{{font-family:Inter;src:url({FONTS}/Inter-400.ttf);font-weight:400}}
@font-face{{font-family:Inter;src:url({FONTS}/Inter-600.ttf);font-weight:600}}
@font-face{{font-family:Inter;src:url({FONTS}/Inter-700.ttf);font-weight:700}}
@font-face{{font-family:'Inter Display';src:url({FONTS}/Inter-700.ttf);font-weight:600 700}}
@font-face{{font-family:Inter;src:url({FONTS}/Inter-400.ttf);font-weight:400}}
@font-face{{font-family:Inter;src:url({FONTS}/Inter-600.ttf);font-weight:600}}
@font-face{{font-family:Inter;src:url({FONTS}/Inter-700.ttf);font-weight:700}}
@font-face{{font-family:'Inter Display';src:url({FONTS}/Inter-700.ttf);font-weight:600 700}}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:1080px;height:1350px;overflow:hidden;background:#000}}
.card{{position:relative;width:1080px;height:1350px;overflow:hidden;font-family:Inter,sans-serif;
  -webkit-font-smoothing:antialiased;font-kerning:normal;font-feature-settings:"kern","liga","calt"}}
.ph{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.fit{{overflow:hidden;display:flex;flex-direction:column}}
.q{{text-wrap:pretty;hanging-punctuation:first last}}
.grain::after{{content:"";position:absolute;inset:-50%;pointer-events:none;opacity:.10;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}}
.attr{{font-family:Inter,sans-serif;font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:21px}}
.attr .ctx{{font-weight:400;opacity:.72}}
.kick{{font-family:Inter,sans-serif;font-weight:700;letter-spacing:.22em;text-transform:uppercase;font-size:17px}}
"""

FIT_JS = """
(() => {
  const res = [];
  document.querySelectorAll('.fit').forEach(box => {
    const q = box.querySelector('.q');
    const min = +box.dataset.min, max = +box.dataset.max;
    let lo = min, hi = max, best = min;
    const fits = () => q.offsetHeight <= box.clientHeight + 1 && q.scrollWidth <= box.clientWidth + 1 && box.scrollWidth <= box.clientWidth + 1;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2; q.style.fontSize = mid + 'px';
      if (fits()) { best = mid; lo = mid; } else { hi = mid; }
    }
    q.style.fontSize = best + 'px';
    const r = q.getBoundingClientRect();
    res.push({size: Math.round(best), ok: fits(), floor: best <= min + 0.5,
              rect: [r.left, r.top, r.width, r.height]});
  });
  const ph = document.querySelector('img.main');
  window.__qa = {fit: res, text: (document.querySelector('.q')||{}).innerText || '',
    photo: ph ? {w: ph.getBoundingClientRect().width, h: ph.getBoundingClientRect().height,
                 nw: ph.naturalWidth, nh: ph.naturalHeight} : null};
})();
"""


def typeset(s):
    """Typographic apostrophes only. Words are untouched."""
    return re.sub(r"(\w)'(\w)", "\\1\u2019\\2", s)


def quote_html(c, mark_tag="mark", which="emphasis"):
    q = typeset(c["quote"])
    sub = typeset(c.get(which) or "")
    q = html.escape(q)
    if sub and html.escape(sub) in q:
        q = q.replace(html.escape(sub), f"<{mark_tag}>{html.escape(sub)}</{mark_tag}>", 1)
    return q


def attr(c, sep=" · "):
    parts = [f'<span class="who">{html.escape(c["speaker"])}</span>']
    ctx = [x for x in (c.get("context"), c.get("date")) if x]
    if ctx:
        parts.append(f'<span class="ctx">{html.escape(sep.join(ctx))}</span>')
    return sep.join(parts)


# ---------------------------------------------------------------- directions
def d_documentary(c, p, img):
    return f"""<div class="card grain" style="background:#000">
<img class="ph main" src="{img['bw']}" style="object-position:{img['focal']}">
<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.94) 0%,rgba(0,0,0,.82) 34%,rgba(0,0,0,.25) 62%,rgba(0,0,0,0) 78%)"></div>
<div class="kick" style="position:absolute;left:84px;top:78px;color:#fff;opacity:.85;display:flex;gap:14px;align-items:center">
 <span style="width:34px;height:3px;background:{p['accent']}"></span>From the record</div>
<div class="fit" data-min="34" data-max="76" style="position:absolute;left:84px;right:84px;bottom:190px;height:600px;justify-content:flex-end">
 <div class="q" style="font-family:Instrument;color:#fff;line-height:1.08;letter-spacing:-.005em">&ldquo;{quote_html(c,'span')}&rdquo;</div></div>
<div class="attr" style="position:absolute;left:84px;right:84px;bottom:96px;color:#fff;border-top:1px solid rgba(255,255,255,.3);padding-top:26px">
 <span style="color:{p['accent']}">{html.escape(c['speaker'])}</span> <span class="ctx">&nbsp;{html.escape(' · '.join(x for x in (c.get('context'),c.get('date')) if x))}</span></div>
</div>"""


def d_duotone(c, p, img):
    return f"""<div class="card grain" style="background:{p['dark']}">
<img class="ph main" src="{img['duo']}" style="object-position:{img['focal']}">
<div style="position:absolute;inset:0;background:linear-gradient(to top,{p['dark']}f7 0%,{p['dark']}e0 42%,{p['dark']}00 70%)"></div>
<div class="fit" data-min="40" data-max="118" style="position:absolute;left:72px;right:72px;bottom:160px;height:640px;justify-content:flex-end">
 <div class="q" style="font-family:Anton;text-transform:uppercase;color:{p['ink']};line-height:.98;letter-spacing:.004em">{quote_html(c,'b')}</div></div>
<div class="attr" style="position:absolute;left:72px;bottom:70px;color:{p['ink']};background:{p['dark']};padding:14px 18px">{attr(c)}</div>
<style>.q b{{font-weight:400;color:{p['acc']}}}</style>
</div>"""


def d_editorial(c, p, img):
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<div style="position:absolute;left:72px;right:72px;top:56px;display:flex;justify-content:space-between;border-bottom:1.5px solid {p['ink']};padding-bottom:16px" class="kick">
 <span>Carrot</span><span style="color:{p['acc']}">From the record</span><span>{html.escape(c.get('date') or c['timecode'])}</span></div>
<div style="position:absolute;left:72px;right:72px;top:118px;height:470px;overflow:hidden">
 <img class="ph main" src="{img['grade']}" style="object-position:{img['focal']}"></div>
<div style="position:absolute;left:72px;top:598px;font-family:Plex;font-size:15px;opacity:.65">{html.escape(c['speaker'])}, {html.escape(c.get('context',''))} — frame at {c['timecode']}</div>
<div class="fit" data-min="30" data-max="70" style="position:absolute;left:72px;right:72px;top:660px;height:500px">
 <div class="q" style="font-family:Fraunces;font-variation-settings:'opsz' 144,'SOFT' 50;font-weight:360;line-height:1.1;letter-spacing:-.012em">
 <span style="color:{p['acc']};font-weight:700">&ldquo;</span>{quote_html(c,'em')}&rdquo;</div></div>
<div class="attr" style="position:absolute;left:72px;bottom:70px;font-size:19px">&mdash;&nbsp;{attr(c)}</div>
<style>.q em{{font-style:italic;font-weight:500}}</style>
</div>"""


def d_stat(c, p, img):
    big = html.escape(typeset(c["big"]))
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<div class="kick" style="position:absolute;left:80px;top:80px;color:{p['acc']}">{html.escape(c['context'])}</div>
<div style="position:absolute;left:68px;right:60px;top:130px;font-family:Anton;font-size:{_bigsize(c['big'])}px;line-height:.9;color:{p['acc']};letter-spacing:-.01em;white-space:nowrap">{big}</div>
<div style="position:absolute;left:80px;width:120px;top:{130+_bigsize(c['big'])*0.9+40:.0f}px;height:6px;background:{p['ink']}"></div>
<div class="fit" data-min="28" data-max="58" style="position:absolute;left:80px;right:80px;top:{130+_bigsize(c['big'])*0.9+90:.0f}px;bottom:200px">
 <div class="q" style="font-family:Inter;font-weight:500;line-height:1.24;letter-spacing:-.012em">{quote_html(c,'b','big')}</div></div>
<div style="position:absolute;left:80px;right:80px;bottom:72px;display:flex;align-items:center;gap:22px">
 <img class="main" src="{img['grade']}" style="width:88px;height:88px;border-radius:50%;object-fit:cover;object-position:{img['focal']}">
 <div class="attr" style="font-size:19px;line-height:1.5">{html.escape(c['speaker'])}<br><span class="ctx">{html.escape(' · '.join(x for x in (c.get('context'),c.get('date')) if x))}</span></div></div>
<style>.q b{{font-weight:800;color:{p['acc']}}}</style>
</div>"""


def _bigsize(s):
    n = len(s)
    return 420 if n <= 3 else 330 if n <= 5 else 250 if n <= 8 else 190


def d_broadsheet(c, p, img):
    return f"""<div class="card grain" style="background:{p['bg']};color:{p['ink']}">
<div style="position:absolute;left:64px;right:64px;top:52px;text-align:center;border-bottom:4px double {p['ink']};padding-bottom:12px">
 <div style="font-family:Fraunces;font-weight:900;font-size:76px;letter-spacing:-.02em;font-variation-settings:'opsz' 144">The Record</div>
 <div style="font-family:Plex;font-size:15px;display:flex;justify-content:space-between;border-top:1px solid {p['ink']};margin-top:8px;padding-top:8px">
  <span>{html.escape(c.get('context',''))}</span><span>{html.escape(c.get('date') or 'Transcript ' + c['timecode'])}</span><span>carrot</span></div></div>
<div style="position:absolute;left:64px;top:236px;width:420px;bottom:120px;border-right:1px solid {p['ink']};padding-right:28px">
 <div style="width:100%;height:520px;background:{p['bg']};position:relative;overflow:hidden">
  <img class="ph main" src="{img['half']}" style="object-position:{img['focal']};mix-blend-mode:multiply"></div>
 <div style="font-family:Plex;font-size:14px;margin-top:12px;line-height:1.4">{html.escape(c['speaker'])}. Frame from the recording at {c['timecode']}.</div></div>
<div class="fit" data-min="30" data-max="64" style="position:absolute;left:520px;right:64px;top:236px;bottom:190px">
 <div class="q" style="font-family:Fraunces;font-style:italic;font-weight:420;font-variation-settings:'opsz' 72;line-height:1.12">&ldquo;{quote_html(c,'span')}&rdquo;</div></div>
<div class="attr" style="position:absolute;left:520px;right:64px;bottom:120px;font-size:18px;color:{p['acc']}">{attr(c)}</div>
<div style="position:absolute;left:64px;right:64px;bottom:64px;border-top:1px solid {p['ink']};padding-top:10px;font-family:Plex;font-size:13px;opacity:.7">Words as spoken. Source recording on file.</div>
</div>"""


def d_typeonly(c, p, img):
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<div class="kick" style="position:absolute;left:80px;top:82px">{html.escape(c['speaker'])}</div>
<div class="fit" data-min="40" data-max="120" style="position:absolute;left:76px;right:76px;top:150px;bottom:200px;justify-content:center">
 <div class="q" style="font-family:'Inter Display',Inter;font-weight:650;line-height:1.1;letter-spacing:-.03em">{quote_html(c)}</div></div>
<div class="attr" style="position:absolute;left:80px;right:80px;bottom:80px;font-size:19px;display:flex;justify-content:space-between">
 <span>{html.escape(' · '.join(x for x in (c.get('context'),c.get('date')) if x))}</span><span>carrot</span></div>
<style>.q mark{{background:{p['mark']};color:inherit;padding:0 .08em;box-decoration-break:clone;-webkit-box-decoration-break:clone}}</style>
</div>"""


def d_cinematic(c, p, img):
    return f"""<div class="card grain" style="background:#060606;color:#f4f1ea">
<div style="position:absolute;left:0;right:0;top:150px;height:452px;overflow:hidden">
 <img class="ph main" src="{img['grade']}" style="object-position:{img['focal']}"></div>
<div style="position:absolute;left:80px;right:80px;top:84px;display:flex;justify-content:space-between;font-family:Plex;font-size:17px;opacity:.75">
 <span>{html.escape(c['speaker']).upper()}</span><span>&#9679; {c['timecode']}</span></div>
<div class="fit" data-min="32" data-max="66" style="position:absolute;left:100px;right:100px;top:660px;bottom:210px;justify-content:center;text-align:center">
 <div class="q" style="font-family:Instrument;font-style:italic;line-height:1.14">{quote_html(c,'span')}</div></div>
<div class="attr" style="position:absolute;left:0;right:0;bottom:96px;text-align:center;color:{p['acc']};font-size:19px">{attr(c)}</div>
</div>"""


def d_transcript(c, p, img):
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']};font-family:Plex">
<div style="position:absolute;left:80px;right:80px;top:80px;display:flex;align-items:center;gap:22px">
 <img class="main" src="{img['grade']}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;object-position:{img['focal']}">
 <div style="font-size:22px;line-height:1.45">{html.escape(c['speaker'])}<br><span style="opacity:.6">{html.escape(' · '.join(x for x in (c.get('context'),c.get('date')) if x))}</span></div></div>
<div style="position:absolute;left:80px;right:80px;top:236px;border-top:1.5px solid currentColor;opacity:.25"></div>
<div style="position:absolute;left:80px;top:290px;font-size:22px;color:{p['acc']}">[{c['timecode']}]</div>
<div class="fit" data-min="28" data-max="58" style="position:absolute;left:250px;right:80px;top:280px;bottom:190px">
 <div class="q" style="font-family:Plex;line-height:1.42;letter-spacing:-.01em">{quote_html(c)}</div></div>
<div style="position:absolute;left:80px;right:80px;bottom:80px;font-size:16px;opacity:.55;display:flex;justify-content:space-between"><span>TRANSCRIPT · WORDS AS SPOKEN</span><span>CARROT</span></div>
<style>.q mark{{background:{p['hl']};color:inherit;padding:.04em .1em}}</style>
</div>"""


def d_backdrop(c, p, img):
    return f"""<div class="card" style="background:#000;color:#fff">
<img class="ph" src="{img['grade']}" style="object-position:{img['focal']};filter:blur(38px) saturate(1.2);transform:scale(1.2)">
<div style="position:absolute;inset:0;background:{p['tint']}"></div>
<img class="main" src="{img['grade']}" style="position:absolute;left:80px;top:80px;width:340px;height:425px;object-fit:cover;object-position:{img['focal']};border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.5)">
<div class="attr" style="position:absolute;left:460px;top:84px;right:80px;line-height:1.6;font-size:20px"><span style="color:{p['acc']}">{html.escape(c['speaker'])}</span><br><span class="ctx">{html.escape(' · '.join(x for x in (c.get('context'),c.get('date')) if x))}</span></div>
<div class="fit" data-min="32" data-max="70" style="position:absolute;left:80px;right:80px;top:560px;bottom:90px;justify-content:flex-end">
 <div class="q" style="font-family:Grotesk;font-weight:500;line-height:1.12;letter-spacing:-.02em">{quote_html(c,'span')}</div></div>
</div>"""


def d_pullquote(c, p, img):
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<div style="position:absolute;left:52px;top:-40px;font-family:Fraunces;font-weight:900;font-size:520px;line-height:1;color:{p['acc']}">&ldquo;</div>
<div class="fit" data-min="32" data-max="80" style="position:absolute;left:84px;right:84px;top:330px;bottom:250px">
 <div class="q" style="font-family:Fraunces;font-weight:500;font-variation-settings:'opsz' 144,'SOFT' 100,'WONK' 1;line-height:1.08;letter-spacing:-.018em">{quote_html(c,'span')}</div></div>
<div style="position:absolute;left:84px;right:84px;bottom:84px;display:flex;align-items:center;gap:24px;border-top:2px solid {p['ink']};padding-top:30px">
 <img class="main" src="{img['grade']}" style="width:92px;height:92px;border-radius:50%;object-fit:cover;object-position:{img['focal']}">
 <div class="attr" style="font-size:20px;line-height:1.5">{html.escape(c['speaker'])}<br><span class="ctx">{html.escape(' · '.join(x for x in (c.get('context'),c.get('date')) if x))}</span></div></div>
</div>"""


RENDER = {k: globals()["d_" + k] for k in DIRECTIONS}


# ---------------------------------------------------------------- images
def prepare_images(c):
    src = ROOT / c["photo"]
    im = treat.load(src)
    native = im.size
    focal = treat.focal(im)
    work, up = treat.upscale_if_needed(im)
    out = BUILD / "img" / c["id"]
    duo_pal = PAL["duotone"]
    paths = {
        "grade": treat.save(treat.warm_grade(work), out / "grade"),
        "bw": treat.save(treat.bw(work), out / "bw"),
        "half": treat.save(treat.halftone(work), out / "half"),
    }
    for i, pp in enumerate(duo_pal):
        paths[f"duo{i}"] = treat.save(treat.duotone(work, pp["dark"], pp["light"]), out / f"duo{i}")
    return {k: v.as_uri() for k, v in paths.items()} | {"focal": focal, "native": native, "upscale": up}


# ---------------------------------------------------------------- QA
def norm(s):
    s = s.replace("\u2019", "'").replace("\u201c", "").replace("\u201d", "").replace('"', "")
    return re.sub(r"\s+", " ", s).strip().lower()


def ocr_recall(png, quote):
    import pytesseract
    from PIL import ImageOps
    g = ImageOps.grayscale(Image.open(png))
    got = set()
    for im in (g, ImageOps.invert(g)):  # light-on-dark cards read better inverted
        got |= set(re.findall(r"[a-z0-9]+", norm(pytesseract.image_to_string(im))))
    want = re.findall(r"[a-z0-9]+", norm(quote))
    return round(sum(w in got for w in want) / max(1, len(want)), 3)


def face_overlap(photo_only_png, text_rect, scale=2):
    im = Image.open(photo_only_png).convert("RGB")
    fs = treat.faces(im)
    if not fs:
        return None
    x, y, w, h = [v * scale for v in text_rect]
    worst = 0.0
    for fx, fy, fw, fh in fs[:2]:
        ix = max(0, min(x + w, fx + fw) - max(x, fx))
        iy = max(0, min(y + h, fy + fh) - max(y, fy))
        worst = max(worst, ix * iy / (fw * fh))
    return round(worst, 3)


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cards", default="")
    ap.add_argument("--dirs", default="")
    ap.add_argument("--palettes", type=int, default=1)
    ap.add_argument("--no-ocr", action="store_true")
    a = ap.parse_args()

    from playwright.sync_api import sync_playwright
    cards = json.loads((ROOT / "cards.json").read_text(encoding="utf-8"))["cards"]
    if a.cards:
        cards = [c for c in cards if c["id"] in a.cards.split(",")]
    dirs = a.dirs.split(",") if a.dirs else DIRECTIONS
    (BUILD / "cards").mkdir(parents=True, exist_ok=True)
    (BUILD / "html").mkdir(parents=True, exist_ok=True)
    qa = []
    with sync_playwright() as pw:
        try:
            br = pw.chromium.launch(channel="chrome")
        except Exception:
            br = pw.chromium.launch()
        pg = br.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=2)
        for ci, c in enumerate(cards):
            img = prepare_images(c)
            for d in dirs:
                pals = PAL[d]
                for pi in range(min(a.palettes, len(pals))):
                    p = pals[(ci + pi) % len(pals)]
                    im = dict(img, duo=img[f"duo{(ci + pi) % len(PAL['duotone'])}"])
                    if d == "duotone":
                        p = PAL["duotone"][(ci + pi) % len(PAL["duotone"])]
                    body = RENDER[d](c, p, im)
                    doc = f"<!doctype html><html><head><meta charset='utf-8'><style>{BASE_CSS}</style></head><body>{body}<script>{FIT_JS}</script></body></html>"
                    name = f"{c['id']}__{d}__p{pi + 1}"
                    hp = BUILD / "html" / f"{name}.html"
                    hp.write_text(doc, encoding="utf-8")
                    pg.goto(hp.as_uri())
                    pg.evaluate("document.fonts.ready")
                    pg.evaluate(FIT_JS)
                    info = pg.evaluate("window.__qa")
                    png = BUILD / "cards" / f"{name}.png"
                    pg.screenshot(path=str(png))
                    # photo-only pass for face/text overlap
                    pg.add_style_tag(content=".fit,.attr,.kick{visibility:hidden!important}")
                    tmp = BUILD / "tmp_photo.png"
                    pg.screenshot(path=str(tmp))
                    f0 = info["fit"][0] if info["fit"] else {}
                    rec = {
                        "card": c["id"], "direction": d, "palette": pi + 1, "png": str(png.relative_to(BUILD)),
                        "font_px": f0.get("size"), "fits": f0.get("ok"), "at_min_size": f0.get("floor"),
                        "string_match": norm(info["text"]) == norm(typeset(c["quote"])),
                        "face_covered": face_overlap(tmp, f0["rect"]) if f0 else None,
                        "source_px": img["native"], "upscaled": round(img["upscale"], 2),
                    }
                    ph = info.get("photo")
                    if ph and ph["w"]:
                        rec["photo_px_per_output_px"] = round(min(img["native"][0] / (ph["w"] * 2), img["native"][1] / (ph["h"] * 2)), 2)
                    if not a.no_ocr:
                        rec["ocr_word_recall"] = ocr_recall(png, c["quote"])
                    fails = []
                    if not rec["fits"]: fails.append("text overflows")
                    if not rec["string_match"]: fails.append("rendered words differ from string")
                    if rec["face_covered"] and rec["face_covered"] > 0.15: fails.append("text covers face")
                    if d in PHOTO_CRITICAL and rec.get("photo_px_per_output_px", 1) < 0.5: fails.append("source too small for this direction")
                    if rec.get("ocr_word_recall", 1) < 0.85: fails.append("OCR could not read the words")
                    rec["fails"] = fails
                    qa.append(rec)
                    print(f"{name:40s} {'PASS' if not fails else 'FAIL: ' + '; '.join(fails)}")
        br.close()
    (BUILD / "tmp_photo.png").unlink(missing_ok=True)
    (BUILD / "qa.json").write_text(json.dumps(qa, indent=1), encoding="utf-8")
    import review
    review.build(cards, qa, BUILD)


if __name__ == "__main__":
    main()
