"""Variation engine v2: 13 directions x layout knobs x curated palettes.
Builds the 50-card set in sets.py, runs the same QA as render.py, writes build2/.

    python render2.py            # the 50
    python render2.py --only house-floor
"""
import argparse, html, json, re
from pathlib import Path
from PIL import Image
import treat
from render import BASE_CSS, FIT_JS, typeset, norm, ocr_recall, face_overlap

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "build2"
E = html.escape

# ------------------------------------------------------------ palettes
P = {  # bg, ink, accent, (soft)
    "ink":      dict(bg="#0f0f0f", ink="#f4f1ea", acc="#ff5a36", soft="#2a2a2a"),
    "paper":    dict(bg="#f3eee4", ink="#191714", acc="#b2361c", soft="#e4dccb"),
    "sage":     dict(bg="#e7ece4", ink="#14201a", acc="#2f6b4f", soft="#cfdacb"),
    "navy":     dict(bg="#13213d", ink="#f2ede4", acc="#f0b44c", soft="#22355c"),
    "tomato":   dict(bg="#ff5a36", ink="#140c08", acc="#fff3e0", soft="#ff7a5c"),
    "butter":   dict(bg="#f6d64a", ink="#151515", acc="#151515", soft="#efc52a"),
    "plum":     dict(bg="#2a0c22", ink="#fbe9f2", acc="#ff8fb1", soft="#3d1533"),
    "forest":   dict(bg="#0f2a22", ink="#eaf4ee", acc="#c6f26b", soft="#1a3d32"),
    "cobalt":   dict(bg="#1747d8", ink="#ffffff", acc="#ffd23f", soft="#2a5bea"),
    "bone":     dict(bg="#ebe5d8", ink="#151412", acc="#9c2a1b", soft="#d9d0bd"),
    "oxblood":  dict(bg="#4a0f12", ink="#f6e9dc", acc="#f2b880", soft="#5e1a1d"),
    "mint":     dict(bg="#d9f2e6", ink="#0c2b20", acc="#e4572e", soft="#bfe6d3"),
}
GRAD = {
    "dusk":  "radial-gradient(120% 90% at 10% 10%,#ff7a59 0%,transparent 55%),radial-gradient(100% 80% at 90% 30%,#6d5dfc 0%,transparent 60%),radial-gradient(120% 100% at 50% 100%,#0b1026 30%,#141a3a 100%)",
    "sea":   "radial-gradient(110% 90% at 0% 0%,#00c2a8 0%,transparent 55%),radial-gradient(90% 80% at 100% 20%,#2b6cff 0%,transparent 60%),radial-gradient(140% 100% at 50% 100%,#04121f 35%,#0b2540 100%)",
    "ember": "radial-gradient(100% 80% at 90% 0%,#ffb000 0%,transparent 55%),radial-gradient(110% 90% at 0% 40%,#e63946 0%,transparent 60%),radial-gradient(140% 100% at 50% 100%,#1a0606 35%,#3a0d0d 100%)",
}

# ------------------------------------------------------------ helpers
def q(c, tag="mark", which="emphasis"):
    s = E(typeset(c["quote"]))
    sub = E(typeset(c.get(which) or ""))
    return s.replace(sub, f"<{tag}>{sub}</{tag}>", 1) if sub and sub in s else s


def ctx(c):
    return E(" · ".join(x for x in (c.get("context"), c.get("date")) if x))


def byline(c, p, img=None, size=20, photo=True):
    face = ""
    if photo and img and img.get("thumb"):
        face = f'<img class="main" src="{img["thumb"]}" style="width:84px;height:84px;border-radius:50%;object-fit:cover;object-position:{img["focal"]}">'
    elif photo:
        ini = "".join(w[0] for w in re.sub(r"^(Rep\.|Mr\.|Ms\.|Dr\.)\s*", "", c["speaker"]).split()[:2]).upper()
        face = f'<div style="width:84px;height:84px;border-radius:50%;background:{p["acc"]};color:{p["bg"]};display:grid;place-items:center;font:700 30px Inter;letter-spacing:.02em">{E(ini)}</div>'
    return f"""<div style="display:flex;align-items:center;gap:22px">{face}
<div class="attr" style="font-size:{size}px;line-height:1.5">{E(c['speaker'])}<br><span class="ctx">{ctx(c)}</span></div></div>"""


def fit(min_, max_, style, inner_style, content, cls="q"):
    return f'<div class="fit" data-min="{min_}" data-max="{max_}" style="position:absolute;{style}"><div class="{cls}" style="{inner_style}">{content}</div></div>'


# ------------------------------------------------------------ directions
def split(c, p, img, v):
    side = v.get("side", "left")
    ph = img["bw"] if v.get("tone") == "bw" else img["grade"]
    photo_pos = "left:0" if side == "left" else "right:0"
    text_pos = "left:540px;right:0" if side == "left" else "left:0;right:540px"
    face = "Instrument" if v.get("font") == "serif" else "'Inter Display',Inter"
    w = 400 if v.get("font") == "serif" else 600
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<img class="main" src="{ph}" style="position:absolute;top:0;{photo_pos};width:540px;height:660px;object-fit:cover;object-position:{img['focal']}">
<div style="position:absolute;top:660px;bottom:0;{photo_pos};width:540px;background:{p['acc']};color:{p['bg']};padding:56px">
 <div style="font-family:Anton;font-size:{_bigsize(c['big'])*0.62:.0f}px;line-height:.9;text-transform:uppercase">{E(typeset(c['big']))}</div>
 <div class="attr" style="position:absolute;left:56px;right:56px;bottom:64px;font-size:17px">{E(c['speaker'])}</div></div>
<div style="position:absolute;top:0;bottom:0;{text_pos}">
 <div class="kick" style="position:absolute;left:56px;top:70px;color:{p['acc']}">From the record</div>
 {fit(40, 84, "left:56px;right:56px;top:130px;bottom:200px", f"font-family:{face};font-weight:{w};line-height:1.08;letter-spacing:-.015em", "&ldquo;" + q(c,'span') + "&rdquo;")}
 <div class="attr" style="position:absolute;left:56px;right:56px;bottom:64px;font-size:17px;line-height:1.55;border-top:2px solid {p['acc']};padding-top:20px"><span class="ctx">{ctx(c)}</span></div>
</div></div>"""


def cutout(c, p, img, v):
    big = E(typeset(c["big"])).upper()
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<div style="position:absolute;left:0;right:0;top:56px;text-align:center;font-family:Anton;font-size:{min(400,1000/(len(big)*0.46)):.0f}px;line-height:.86;color:{p['acc']};white-space:nowrap">{big}</div>
<img class="main" src="{img['cut']}" style="position:absolute;left:50%;transform:translateX(-50%);top:{56+min(400,1000/(len(big)*0.46))*0.62:.0f}px;height:{790-56-min(400,1000/(len(big)*0.46))*0.62:.0f}px;width:auto">
<div style="position:absolute;left:0;right:0;top:790px;bottom:0;background:{p['soft'] if v.get('band') else p['bg']}"></div>
{fit(36, 64, "left:72px;right:72px;top:830px;bottom:150px", "font-family:Fraunces;font-weight:500;font-variation-settings:'opsz' 144;line-height:1.1;letter-spacing:-.015em", "&ldquo;" + q(c,'b') + "&rdquo;")}
<div class="attr" style="position:absolute;left:72px;right:72px;bottom:66px;font-size:18px">{E(c['speaker'])} &nbsp;<span class="ctx">{ctx(c)}</span></div>
<style>.q b{{font-weight:700;color:{p['acc']}}}</style></div>"""


def arch(c, p, img, v):
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<div style="position:absolute;left:50%;transform:translateX(-50%);top:84px;width:520px;height:600px;border-radius:260px 260px 0 0;overflow:hidden;background:{p['soft']}">
 <img class="main" src="{img['bw'] if v.get('tone')=='bw' else img['grade']}" style="width:100%;height:100%;object-fit:cover;object-position:{img['focal']}"></div>
<div style="position:absolute;left:50%;transform:translateX(-50%);top:684px;width:520px;height:3px;background:{p['acc']}"></div>
{fit(34, 66, "left:100px;right:100px;top:730px;bottom:150px;text-align:center", "font-family:Instrument;line-height:1.1", "&ldquo;" + q(c,'em') + "&rdquo;")}
<div class="attr" style="position:absolute;left:0;right:0;bottom:70px;text-align:center;font-size:18px"><span style="color:{p['acc']}">{E(c['speaker'])}</span> &nbsp;<span class="ctx">{ctx(c)}</span></div>
<style>.q em{{font-style:italic;color:{p['acc']}}}</style></div>"""


def editorial(c, p, img, v):
    top = f"""<div style="position:absolute;left:72px;right:72px;top:118px;height:440px;overflow:hidden;background:{p['soft']}">
<img class="main" src="{img['bw'] if v.get('tone')=='bw' else img['grade']}" style="position:absolute;right:0;top:0;height:100%;width:352px;object-fit:cover;object-position:{img['focal']}">
<div style="position:absolute;left:40px;top:40px;right:400px;font-family:Fraunces;font-weight:300;font-size:30px;line-height:1.25;font-variation-settings:'opsz' 72">{E(c['speaker'])}<br><span style="font-style:italic;opacity:.7">{ctx(c)}</span></div></div>""" if img.get("grade") else f"""
<div style="position:absolute;left:72px;right:72px;top:118px;height:440px;background:{p['acc']};color:{p['bg']};padding:44px">
 <div style="font-family:Fraunces;font-weight:900;font-size:{min(230, 1500/max(1,len(c['big']))):.0f}px;line-height:.85;white-space:nowrap;font-variation-settings:'opsz' 144;letter-spacing:-.03em">{E(typeset(c['big']))}</div>
 <div style="position:absolute;left:44px;bottom:40px;font-family:Plex;font-size:17px">{E(c['speaker'])} — {ctx(c)}</div></div>"""
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<div class="kick" style="position:absolute;left:72px;right:72px;top:56px;display:flex;justify-content:space-between;border-bottom:1.5px solid {p['ink']};padding-bottom:16px">
 <span>Carrot</span><span style="color:{p['acc']}">From the record</span><span>{E(c.get('date') or c['timecode'])}</span></div>
{top}
{fit(36, 110, "left:72px;right:72px;top:610px;bottom:140px", "font-family:Fraunces;font-variation-settings:'opsz' 144,'SOFT' 50;font-weight:360;line-height:1.1;letter-spacing:-.012em", f"<span style='color:{p['acc']};font-weight:700'>&ldquo;</span>" + q(c,'em') + "&rdquo;")}
<div class="attr" style="position:absolute;left:72px;bottom:64px;font-size:18px">&mdash;&nbsp;{E(c['speaker'])} <span class="ctx">&nbsp;{ctx(c)}</span></div>
<style>.q em{{font-style:italic;font-weight:520}}</style></div>"""


def broadsheet(c, p, img, v):
    col = f"""<div style="position:absolute;left:64px;top:236px;width:420px;bottom:120px;border-right:1px solid {p['ink']};padding-right:28px">
 <div style="width:100%;height:540px;position:relative;overflow:hidden"><img class="ph main" src="{img['half']}" style="object-position:{img['focal']};mix-blend-mode:multiply"></div>
 <div style="font-family:Plex;font-size:14px;margin-top:12px;line-height:1.4">{E(c['speaker'])}. Official portrait.</div></div>"""
    left = "520px"
    return f"""<div class="card grain" style="background:{p['bg']};color:{p['ink']}">
<div style="position:absolute;left:64px;right:64px;top:52px;text-align:center;border-bottom:4px double {p['ink']};padding-bottom:12px">
 <div style="font-family:Fraunces;font-weight:900;font-size:76px;letter-spacing:-.02em;font-variation-settings:'opsz' 144">The Record</div>
 <div style="font-family:Plex;font-size:15px;display:flex;justify-content:space-between;border-top:1px solid {p['ink']};margin-top:8px;padding-top:8px">
  <span>{E(c.get('context',''))}</span><span>{E(c.get('date') or '')}</span><span>carrot</span></div></div>
{col}
{fit(34, 66, f"left:{left};right:64px;top:236px;bottom:190px", "font-family:Fraunces;font-style:italic;font-weight:420;font-variation-settings:'opsz' 72;line-height:1.12", "&ldquo;" + q(c,'span') + "&rdquo;")}
<div class="attr" style="position:absolute;left:{left};right:64px;bottom:120px;font-size:18px;color:{p['acc']}">{E(c['speaker'])}</div>
<div style="position:absolute;left:64px;right:64px;bottom:64px;border-top:1px solid {p['ink']};padding-top:10px;font-family:Plex;font-size:13px;opacity:.7">Words as spoken. Source recording on file.</div></div>"""


def _bigsize(s):
    n = len(s)
    return 460 if n <= 3 else 340 if n <= 5 else 250 if n <= 8 else 190


def stat(c, p, img, v):
    bs = _bigsize(c["big"])
    top = 120 if v.get("pos") != "low" else 560
    qtop = top + bs * .9 + 80 if v.get("pos") != "low" else 130
    qbot = 210 if v.get("pos") != "low" else 1350 - top + 40
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<div style="position:absolute;left:64px;right:50px;top:{top}px;font-family:Anton;font-size:{bs}px;line-height:.9;color:{p['acc']};letter-spacing:-.01em;white-space:nowrap">{E(typeset(c['big']))}</div>
{fit(34, 92, f"left:80px;right:80px;top:{qtop:.0f}px;bottom:{qbot:.0f}px", "font-family:Inter;font-weight:500;line-height:1.24;letter-spacing:-.012em", q(c,'b','big'))}
<div style="position:absolute;left:80px;right:80px;bottom:72px">{byline(c, p, img, 18)}</div>
<style>.q b{{font-weight:800;color:{p['acc']}}}</style></div>"""


def datagraphic(c, p, img, v):
    kind = c.get("graphic")
    g = ""
    if kind == "scale":  # 8 kilometers
        ticks = "".join(f'<line x1="{60+i*110}" y1="60" x2="{60+i*110}" y2="{40 if i%4 else 20}" stroke="{p["ink"]}" stroke-width="3"/><text x="{60+i*110}" y="110" fill="{p["ink"]}" font-family="Plex" font-size="26" text-anchor="middle">{i}</text>' for i in range(9))
        g = f'<svg width="1000" height="140" viewBox="0 0 1000 140"><rect x="60" y="60" width="880" height="18" fill="{p["acc"]}"/>{ticks}<text x="940" y="135" fill="{p["ink"]}" font-family="Plex" font-size="20" text-anchor="end" opacity=".7">km</text></svg>'
    elif kind == "years26":
        dots = "".join(f'<rect x="{60+i*34}" y="20" width="26" height="80" rx="3" fill="{p["acc"] if i<26 else p["ink"]}" opacity="{1 if i<26 else .9}"/>' for i in range(27))
        g = f'<svg width="1000" height="150" viewBox="0 0 1000 150">{dots}<text x="60" y="140" fill="{p["ink"]}" font-family="Plex" font-size="24">26 years</text><text x="944" y="140" fill="{p["ink"]}" font-family="Plex" font-size="24" text-anchor="end">now</text></svg>'
    elif kind == "gauge":
        g = f'''<svg width="1000" height="160" viewBox="0 0 1000 160"><defs><linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="{p["soft"]}"/><stop offset="1" stop-color="{p["acc"]}"/></linearGradient></defs>
<rect x="60" y="50" width="880" height="34" rx="17" fill="url(#t)"/>
<line x1="720" y1="24" x2="720" y2="110" stroke="{p["ink"]}" stroke-width="5"/><text x="720" y="150" fill="{p["ink"]}" font-family="Plex" font-size="28" text-anchor="middle">1.5°C</text>
<text x="60" y="150" fill="{p["ink"]}" font-family="Plex" font-size="22" opacity=".7">0</text></svg>'''
    elif kind == "years10":
        dots = "".join(f'<circle cx="{110+i*88}" cy="70" r="34" fill="{p["acc"]}"/>' for i in range(10))
        g = f'<svg width="1000" height="150" viewBox="0 0 1000 150">{dots}<text x="76" y="146" fill="{p["ink"]}" font-family="Plex" font-size="24">10 years</text></svg>'
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<div class="kick" style="position:absolute;left:80px;top:84px;color:{p['acc']}">{E(c['context'])}</div>
<div style="position:absolute;left:40px;top:160px">{g}</div>
{fit(40, 92, "left:80px;right:80px;top:380px;bottom:230px;justify-content:center", "font-family:'Inter Display',Inter;font-weight:600;line-height:1.08;letter-spacing:-.03em", q(c,'b','big'))}
<div style="position:absolute;left:80px;right:80px;bottom:76px">{byline(c, p, img, 18)}</div>
<style>.q b{{color:{p['acc']}}}</style></div>"""


def transcript(c, p, img, v):
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']};font-family:Plex">
<div style="position:absolute;left:80px;right:80px;top:80px">{byline(c, p, img, 19)}</div>
<div style="position:absolute;left:80px;right:80px;top:236px;border-top:1.5px solid currentColor;opacity:.25"></div>
<div style="position:absolute;left:80px;top:292px;font-size:22px;color:{p['acc']}">[{c['timecode']}]</div>
{fit(32, 76, "left:250px;right:80px;top:282px;bottom:190px", "font-family:Plex;line-height:1.42;letter-spacing:-.01em", q(c))}
<div style="position:absolute;left:80px;right:80px;bottom:80px;font-size:16px;opacity:.55;display:flex;justify-content:space-between"><span>TRANSCRIPT · WORDS AS SPOKEN</span><span>CARROT</span></div>
<style>.q mark{{background:{p['acc']};color:{p['bg']};padding:.04em .12em}}</style></div>"""


def pullquote(c, p, img, v):
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<div style="position:absolute;left:52px;top:-40px;font-family:Fraunces;font-weight:900;font-size:520px;line-height:1;color:{p['acc']}">&ldquo;</div>
{fit(36, 120, "left:84px;right:84px;top:330px;bottom:250px", "font-family:Fraunces;font-weight:500;font-variation-settings:'opsz' 144,'SOFT' 100,'WONK' 1;line-height:1.08;letter-spacing:-.018em", q(c,'span'))}
<div style="position:absolute;left:84px;right:84px;bottom:84px;border-top:2px solid {p['ink']};padding-top:30px">{byline(c, p, img, 19)}</div></div>"""


def typeonly(c, p, img, v):
    align = v.get("align", "left")
    hl = v.get("hl", "bar")
    css = {"bar": f".q mark{{background:{p['acc']};color:{p['bg']};padding:0 .08em;box-decoration-break:clone;-webkit-box-decoration-break:clone}}",
           "under": f".q mark{{background:none;color:inherit;text-decoration:underline;text-decoration-color:{p['acc']};text-decoration-thickness:.12em;text-underline-offset:.12em}}",
           "ink": f".q mark{{background:none;color:{p['acc']}}}"}[hl]
    face = v.get("font", "sans")
    fstyle = {"sans": "font-family:'Inter Display',Inter;font-weight:650;line-height:1.08;letter-spacing:-.03em",
              "serif": "font-family:Instrument;line-height:1.02;letter-spacing:-.01em",
              "grotesk": "font-family:Grotesk;font-weight:600;line-height:1.06;letter-spacing:-.03em"}[face]
    return f"""<div class="card" style="background:{p['bg']};color:{p['ink']}">
<div class="kick" style="position:absolute;left:80px;right:80px;top:82px;text-align:{align}">{E(c['speaker'])}</div>
{fit(44, 130, f"left:76px;right:76px;top:150px;bottom:200px;justify-content:center;text-align:{align}", fstyle, q(c))}
<div class="attr" style="position:absolute;left:80px;right:80px;bottom:80px;font-size:18px;display:flex;justify-content:{'center' if align=='center' else 'space-between'};gap:30px">
 <span class="ctx">{ctx(c)}</span>{'' if align=='center' else '<span>carrot</span>'}</div>
<style>{css}</style></div>"""


def poster(c, p, img, v):
    split_at = 0.78 if v.get("tall") else 0.72
    return f"""<div class="card grain" style="background:{p['bg']};color:{p['ink']}">
<div style="position:absolute;left:0;right:0;bottom:0;height:{1350*(1-split_at):.0f}px;background:{p['acc']}"></div>
{fit(48, 140, f"left:64px;right:64px;top:70px;bottom:{1350*(1-split_at)+40:.0f}px;justify-content:flex-end", "font-family:Anton;text-transform:uppercase;line-height:.96;letter-spacing:.005em", q(c,'b'))}
<div style="position:absolute;left:64px;right:64px;top:{1350*split_at+36:.0f}px;font-family:Anton;font-size:84px;line-height:.95;text-transform:uppercase;color:{p['bg']}">{E(c['speaker'])}</div>
<div class="attr" style="position:absolute;left:64px;right:64px;bottom:64px;color:{p['bg']};font-size:20px">{ctx(c)}</div>
<style>.q b{{font-weight:400;color:{p['acc']}}}</style></div>"""


def gradient(c, p, img, v):
    return f"""<div class="card grain" style="background:{GRAD[v.get('g','dusk')]};color:#fff">
<div class="kick" style="position:absolute;left:80px;top:84px;opacity:.85">From the record</div>
{fit(40, 96, "left:80px;right:80px;top:170px;bottom:250px;justify-content:flex-end", "font-family:Grotesk;font-weight:500;line-height:1.08;letter-spacing:-.025em", q(c,'span'))}
<div style="position:absolute;left:80px;right:80px;bottom:80px;border-top:1px solid rgba(255,255,255,.35);padding-top:28px">{byline(c, dict(acc='#ffffff', bg='#111111'), img, 19)}</div></div>"""


def record(c, p, img, v):
    return f"""<div class="card grain" style="background:{p['bg']};color:{p['ink']};font-family:Plex">
<div style="position:absolute;inset:48px;border:2px solid {p['ink']}"></div>
<div style="position:absolute;inset:60px;border:1px solid {p['ink']};opacity:.5"></div>
<div style="position:absolute;left:100px;right:100px;top:110px;display:flex;justify-content:space-between;font-size:17px;letter-spacing:.12em">
 <span>OFFICIAL RECORD</span><span>NO. {abs(hash(c['id']))%9000+1000}</span></div>
<div style="position:absolute;left:100px;right:100px;top:150px;font-size:17px;opacity:.7;letter-spacing:.06em">{ctx(c).upper()} · {c['timecode']}</div>
{fit(36, 78, "left:100px;right:100px;top:240px;bottom:330px;justify-content:center", "font-family:Fraunces;font-weight:400;font-variation-settings:'opsz' 96;line-height:1.14", "&ldquo;" + q(c,'span') + "&rdquo;")}
<div style="position:absolute;right:110px;bottom:120px;transform:rotate(-8deg);border:5px solid {p['acc']};color:{p['acc']};padding:12px 26px;font:700 34px Inter;letter-spacing:.14em;opacity:.88">ON THE RECORD</div>
<div style="position:absolute;left:100px;bottom:130px;font-size:20px;letter-spacing:.06em">SPEAKER: {E(c['speaker']).upper()}</div></div>"""


DIR = {f.__name__: f for f in (split, cutout, arch, editorial, broadsheet, stat, datagraphic, transcript,
                               pullquote, typeonly, poster, gradient, record)}

# ------------------------------------------------------------ the 50
SET = [
    # house floor: real official portrait (675x825) -> half/inset/thumb/cutout directions only
    ("house-floor", "split", "ink", dict(side="left", tone="bw", font="serif")),
    ("house-floor", "split", "paper", dict(side="right", tone="color", font="sans")),
    ("house-floor", "arch", "plum", dict(tone="bw")),
    ("house-floor", "cutout", "butter", dict()),
    ("house-floor", "cutout", "cobalt", dict(band=True)),
    ("house-floor", "editorial", "paper", dict(tone="bw")),
    ("house-floor", "broadsheet", "bone", dict()),
    ("house-floor", "transcript", "paper", dict()),
    ("house-floor", "stat", "forest", dict()),
    ("house-floor", "datagraphic", "oxblood", dict()),
    # lake
    ("lake", "stat", "navy", dict()),
    ("lake", "datagraphic", "sage", dict()),
    ("lake", "typeonly", "mint", dict(hl="under", font="serif")),
    ("lake", "typeonly", "cobalt", dict(hl="ink", align="center")),
    ("lake", "poster", "forest", dict(tall=True)),
    ("lake", "gradient", None, dict(g="sea")),
    ("lake", "editorial", "sage", dict()),
    ("lake", "pullquote", "paper", dict()),
    # measles
    ("measles", "stat", "ink", dict(pos="low")),
    ("measles", "datagraphic", "paper", dict()),
    ("measles", "typeonly", "tomato", dict(hl="bar")),
    ("measles", "poster", "oxblood", dict()),
    ("measles", "record", "bone", dict()),
    ("measles", "transcript", "ink", dict()),
    ("measles", "gradient", None, dict(g="ember")),
    ("measles", "pullquote", "mint", dict()),
    # two wars
    ("two-wars", "typeonly", "paper", dict(hl="under", font="serif")),
    ("two-wars", "typeonly", "plum", dict(hl="ink", font="grotesk")),
    ("two-wars", "poster", "navy", dict(tall=True)),
    ("two-wars", "pullquote", "oxblood", dict()),
    ("two-wars", "transcript", "sage", dict()),
    ("two-wars", "editorial", "bone", dict()),
    ("two-wars", "record", "paper", dict()),
    ("two-wars", "gradient", None, dict(g="dusk")),
    # 1.5 degrees
    ("one-point-five", "stat", "tomato", dict()),
    ("one-point-five", "datagraphic", "ink", dict()),
    ("one-point-five", "typeonly", "butter", dict(hl="bar", align="center")),
    ("one-point-five", "poster", "ink", dict()),
    ("one-point-five", "gradient", None, dict(g="ember")),
    ("one-point-five", "pullquote", "navy", dict()),
    ("one-point-five", "transcript", "bone", dict()),
    ("one-point-five", "record", "sage", dict()),
    # hearing
    ("hearing", "stat", "cobalt", dict()),
    ("hearing", "typeonly", "ink", dict(hl="bar", font="grotesk")),
    ("hearing", "typeonly", "sage", dict(hl="under", font="serif", align="center")),
    ("hearing", "poster", "butter", dict(tall=True)),
    ("hearing", "transcript", "plum", dict()),
    ("hearing", "record", "bone", dict()),
    ("hearing", "gradient", None, dict(g="sea")),
    ("hearing", "editorial", "mint", dict()),
]
assert len(SET) == 50


def images_for(c):
    if not c.get("portrait"):
        return {"focal": "50% 35%"}
    im = treat.load(ROOT / c["portrait"])
    out = OUT / "img" / c["id"]
    d = {"focal": treat.focal(im), "native": im.size}
    d["grade"] = treat.save(treat.warm_grade(im), out / "grade").as_uri()
    d["bw"] = treat.save(treat.bw(im), out / "bw").as_uri()
    d["half"] = treat.save(treat.halftone(im, cell=6), out / "half").as_uri()
    d["thumb"] = d["grade"]
    if c.get("cutout"):
        d["cut"] = (ROOT / c["cutout"]).as_uri()
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--no-ocr", action="store_true")
    a = ap.parse_args()
    from playwright.sync_api import sync_playwright
    cards = {c["id"]: c for c in json.loads((ROOT / "cards2.json").read_text(encoding="utf-8"))["cards"]}
    (OUT / "cards").mkdir(parents=True, exist_ok=True)
    (OUT / "html").mkdir(parents=True, exist_ok=True)
    imgs = {k: images_for(c) for k, c in cards.items()}
    qa = []
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        pg = br.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=2)
        for n, (cid, d, pal, v) in enumerate(SET, 1):
            if a.only and cid not in a.only.split(","):
                continue
            c, img = cards[cid], imgs[cid]
            p = P.get(pal) or P["ink"]
            body = DIR[d](c, p, img, v)
            doc = f"<!doctype html><html><head><meta charset='utf-8'><style>{BASE_CSS}</style></head><body>{body}</body></html>"
            name = f"{n:02d}_{cid}__{d}__{pal or v.get('g')}"
            hp = OUT / "html" / f"{name}.html"
            hp.write_text(doc, encoding="utf-8")
            pg.goto(hp.as_uri())
            pg.evaluate("document.fonts.ready")
            pg.evaluate(FIT_JS)
            info = pg.evaluate("window.__qa")
            png = OUT / "cards" / f"{name}.png"
            pg.screenshot(path=str(png))
            pg.add_style_tag(content=".fit,.attr,.kick{visibility:hidden!important}")
            tmp = OUT / "tmp.png"
            pg.screenshot(path=str(tmp))
            f0 = info["fit"][0]
            rec = dict(n=n, card=cid, direction=d, palette=pal or v.get("g"), variant=v, png=str(png.relative_to(OUT)),
                       font_px=f0["size"], fits=f0["ok"], string_match=norm(info["text"]) == norm(typeset(c["quote"])),
                       face_covered=face_overlap(tmp, f0["rect"]) if img.get("grade") else None)
            ph = info.get("photo")
            if ph and ph["w"] and img.get("native"):
                rec["src_px_per_card_px"] = round(1 / max(ph["w"] / img["native"][0], ph["h"] / img["native"][1]), 2)
            if not a.no_ocr:
                rec["ocr_word_recall"] = ocr_recall(png, c["quote"])
            fails = []
            if not rec["fits"]: fails.append("text overflows")
            if not rec["string_match"]: fails.append("words differ from string")
            if rec["face_covered"] and rec["face_covered"] > .15: fails.append("text covers face")
            if rec.get("src_px_per_card_px", 9) < 1.0: fails.append("photo shown larger than its source")
            if rec["font_px"] < 34 and d != "transcript": fails.append("quote type under 34 px")
            rec["warn"] = ["OCR recall %.0f%% (display type; check by eye)" % (100 * rec["ocr_word_recall"])] if rec.get("ocr_word_recall", 1) < .85 else []
            rec["fails"] = fails
            qa.append(rec)
            print(f"{name:52s} {rec['font_px']:>4}px  {'PASS' if not fails else 'FAIL: ' + '; '.join(fails)}", flush=True)
        br.close()
    (OUT / "tmp.png").unlink(missing_ok=True)
    (OUT / "qa.json").write_text(json.dumps(qa, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
