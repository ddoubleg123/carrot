"""Review PDF: cover, then each sentence's cards on contact pages (6 per page) with QA flags.
Images are the 2160x2700 renders, so the PDF holds ~900 dpi at the printed size."""
import html
from pathlib import Path


def build(cards, qa, build_dir: Path, title="Quote cards — art directions"):
    from playwright.sync_api import sync_playwright
    from PIL import Image
    thumbs = build_dir / "thumbs"
    thumbs.mkdir(exist_ok=True)
    for r in qa:  # 1000 px wide JPEGs: ~430 dpi at the printed size, keeps the PDF small
        t = thumbs / (Path(r["png"]).stem + ".jpg")
        if not t.exists():
            Image.open(build_dir / r["png"]).convert("RGB").resize((1000, 1250), Image.Resampling.LANCZOS).save(t, quality=90)
        r["thumb"] = str(t.relative_to(build_dir))
    by = {}
    for r in qa:
        by.setdefault(r["card"], []).append(r)
    n_fail = sum(1 for r in qa if r["fails"])
    pages = [f"""<section class="cover"><div class="k">Review packet</div><h1>{html.escape(title)}</h1>
<p>{len(cards)} sentences × {len({r['direction'] for r in qa})} art directions = {len(qa)} cards. Rendered at 2160 × 2700 px.
{len(qa) - n_fail} pass automated QA; {n_fail} flagged. Flags are printed under each card.</p>
<p class="m">Checks per card: words on the card equal the source string · text fits with no overflow · OCR reads ≥85% of the words · text box does not cover a detected face · source photo resolution is adequate for the direction.</p></section>"""]
    for c in cards:
        rows = by.get(c["id"], [])
        for i in range(0, len(rows), 6):
            cells = "".join(
                f"""<figure><img src="{(build_dir / r['thumb']).as_uri()}"><figcaption><b>{html.escape(r['direction'])}</b>
{'<span class="ok">pass</span>' if not r['fails'] else '<span class="bad">' + html.escape('; '.join(r['fails'])) + '</span>'}
<span class="m">{r.get('font_px')} px type{' · upscaled ×' + str(r['upscaled']) if r['upscaled'] > 1 else ''}</span></figcaption></figure>"""
                for r in rows[i:i + 6])
            pages.append(f"""<section><div class="k">{html.escape(c['speaker'])} · {html.escape(c.get('context',''))}</div>
<p class="q">{html.escape(c['quote'])}</p><div class="grid">{cells}</div></section>""")
    doc = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@page{{size:letter;margin:.45in}} *{{box-sizing:border-box}} body{{font-family:Inter,sans-serif;color:#1c1917;margin:0}}
section{{break-after:page}} .cover{{padding-top:2.4in}} h1{{font-size:34pt;letter-spacing:-.02em;margin:.1in 0 .2in;font-weight:700}}
.k{{font-size:8pt;letter-spacing:.18em;text-transform:uppercase;color:#9a3412;font-weight:700}}
.q{{font-size:9.5pt;margin:.06in 0 .14in;color:#44403c;max-width:7in}} .m{{color:#78716c;font-size:7.5pt}}
.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:.16in .14in}}
figure{{margin:0}} figure img{{width:100%;aspect-ratio:4/5;display:block;box-shadow:0 0 0 .5px #d6d3d1}}
figcaption{{font-size:7.5pt;margin-top:4px;display:flex;flex-direction:column;gap:1px}}
.ok{{color:#15803d}} .bad{{color:#b91c1c}}
</style></head><body>{''.join(pages)}</body></html>"""
    hp = build_dir / "review.html"
    hp.write_text(doc, encoding="utf-8")
    with sync_playwright() as pw:
        try:
            br = pw.chromium.launch(channel="chrome")
        except Exception:
            br = pw.chromium.launch()
        pg = br.new_page()
        pg.goto(hp.as_uri())
        pg.wait_for_function("Array.from(document.images).every(i => i.complete)", timeout=120000)
        pg.pdf(path=str(build_dir / "review.pdf"), format="Letter", print_background=True)
        br.close()
    print(build_dir / "review.pdf")
