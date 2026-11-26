"""Pull the best still for a quote from the highest-resolution source available.

    # 1. Re-fetch only the seconds you need, at the best resolution the source has:
    yt-dlp -f "bv*[height>=1080]+ba/bv*+ba/b" --download-sections "*3:35-3:55" \
           --force-keyframes-at-cuts -o "src/house-floor.%(ext)s" <URL>

    # 2. Extract and score candidates around the spoken second:
    python frames.py src/house-floor.mp4 3:43 --id house-floor

Writes photos/<id>.png (lossless best frame), photos/<id>_sheet.jpg (contact sheet of all
candidates with scores) and prints a verdict on resolution.
"""
import argparse, json, subprocess, tempfile
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageDraw
import treat

ROOT = Path(__file__).resolve().parent
MIN_SHORT_SIDE = {"full-bleed": 1080, "inset": 540, "thumb": 200}


def ts(s):
    parts = [float(p) for p in s.split(":")]
    return sum(p * 60 ** i for i, p in enumerate(reversed(parts)))


def probe(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height,codec_name,bit_rate", "-of", "json", str(video)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)["streams"][0]


def grab(video, t, dest):
    # -ss before -i is frame-accurate when decoding (no -c copy). PNG = no second lossy pass.
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(video),
                    "-frames:v", "1", "-pix_fmt", "rgb24", str(dest)], check=True)


def score(path):
    im = Image.open(path).convert("RGB")
    g = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2GRAY)
    sharp = cv2.Laplacian(g, cv2.CV_64F).var()
    fs = treat.faces(im)
    face_area = (fs[0][2] * fs[0][3]) / (im.width * im.height) if fs else 0.0
    face_sharp = 0.0
    if fs:
        x, y, w, h = fs[0]
        face_sharp = cv2.Laplacian(g[max(0, y):y + h, max(0, x):x + w], cv2.CV_64F).var()
    # Prefer a sharp face; fall back to whole-frame sharpness for object shots.
    return {"sharp": round(sharp, 1), "face_sharp": round(face_sharp, 1), "faces": len(fs),
            "face_area": round(face_area, 4), "score": round(face_sharp * 2 + sharp if fs else sharp, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("time", help="m:ss of the spoken sentence")
    ap.add_argument("--id", required=True)
    ap.add_argument("--window", type=float, default=2.0, help="seconds either side")
    ap.add_argument("--n", type=int, default=16)
    a = ap.parse_args()

    info = probe(a.video)
    w, h = int(info["width"]), int(info["height"])
    t0 = ts(a.time)
    times = np.linspace(max(0, t0 - a.window), t0 + a.window, a.n)
    tmp = Path(tempfile.mkdtemp())
    cands = []
    for i, t in enumerate(times):
        p = tmp / f"c{i:02d}.png"
        grab(a.video, t, p)
        cands.append({"t": round(float(t), 2), "path": p, **score(p)})
    best = max(cands, key=lambda c: c["score"])

    out = ROOT / "photos"
    out.mkdir(exist_ok=True)
    Image.open(best["path"]).save(out / f"{a.id}.png")

    # contact sheet
    tw = 360
    th = round(tw * h / w)
    cols = 4
    sheet = Image.new("RGB", (cols * tw, ((len(cands) + cols - 1) // cols) * (th + 28)), "white")
    d = ImageDraw.Draw(sheet)
    for i, c in enumerate(cands):
        x, y = (i % cols) * tw, (i // cols) * (th + 28)
        sheet.paste(Image.open(c["path"]).convert("RGB").resize((tw, th)), (x, y))
        tag = f"{c['t']:.2f}s  score {c['score']:.0f}  faces {c['faces']}" + ("  ← BEST" if c is best else "")
        d.text((x + 6, y + th + 6), tag, fill="black")
    sheet.save(out / f"{a.id}_sheet.jpg", quality=88)

    short = min(w, h)
    usable = [k for k, v in MIN_SHORT_SIDE.items() if short >= v]
    print(f"source {w}x{h} {info.get('codec_name')}  best t={best['t']}s  score={best['score']}")
    print(f"usable as: {', '.join(usable) or 'nothing — find another source'}")
    if short < 1080:
        print("WARNING: below 1080p. Re-fetch at higher resolution, use an official/press photo, "
              "or route this card to directions that show the photo small or treated "
              "(stat, transcript, pullquote, broadsheet, duotone, typeonly).")


if __name__ == "__main__":
    main()
