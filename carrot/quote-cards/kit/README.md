# Quote card kit

Replaces the 300-px-screenshot → PIL → 150-dpi PDF path with:
full-resolution frames → image treatments → ten art directions rendered by Chrome at 2160×2700 → automated QA → review PDF.

## Setup (Windows, once)

```
pip install playwright pillow numpy opencv-python pytesseract
playwright install chromium        # or use installed Chrome (render.py tries channel="chrome" first)
winget install yt-dlp.yt-dlp Gyan.FFmpeg UB-Mannheim.TesseractOCR
```
Fonts (OFL, from Google Fonts) are in `fonts/`. Face model (YuNet, OpenCV Zoo) is in `models/`.
Optional, for sources that truly have no sharper copy: Real-ESRGAN (`realesrgan-ncnn-vulkan.exe -n realesrgan-x4plus -i in.png -o out.png`). Mark upscaled cards in the note.

## Run

1. **Get the best source.** Re-fetch just the seconds you need at max resolution:
   `yt-dlp -f "bv*[height>=1080]+ba/bv*+ba/b" --download-sections "*3:35-3:55" --force-keyframes-at-cuts -o "src/house-floor.%(ext)s" <URL>`
   If the source is ≤480p and no better copy exists, look for an official or press photo of the same moment or person, with rights to use it.
2. **Pick the frame.** `python frames.py src/house-floor.mp4 3:43 --id house-floor`
   Extracts 16 lossless PNGs across ±2 s, scores face sharpness, saves the best to `photos/` plus a contact sheet. Look at the sheet; override by hand if the best-scored frame is the wrong expression.
3. **Edit `cards.json`.** `quote` is the exact string. `big` and `emphasis` must be exact substrings — they change weight and color only.
4. **Render.** `python render.py` (all), `--cards lake --dirs stat,editorial`, `--palettes 3` for color variants.
5. **Review.** `build/review.pdf` (contact pages with QA flags), `build/cards/*.png` (posting size), `build/qa.json`.

## Directions

| Direction | Photo role | Low-res tolerant |
|---|---|---|
| documentary | full-bleed B&W, gradient scrim, serif | no |
| duotone | full-bleed two-color, condensed caps | partly |
| editorial | magazine page, photo inset, Fraunces | yes |
| stat | one number from the quote, huge | yes (thumb) |
| broadsheet | newsprint, halftone column | yes |
| typeonly | none — color field, highlighted phrase | yes |
| cinematic | letterboxed still, subtitle-style quote | no |
| transcript | mono, timecode, highlighted line | yes (thumb) |
| backdrop | blurred photo field + sharp framed photo | partly |
| pullquote | giant quote mark, byline photo | yes (thumb) |

## QA (per card, automatic)

- rendered text == source string (after typographic apostrophes)
- text fits its box at or above the minimum size
- OCR reads ≥85% of the words (normal + inverted pass)
- text box covers <15% of any detected face (checked on a photo-only render)
- photo-critical directions fail when the source has <0.5 source px per output px

A pass is not approval. A person still reads every card against the caption.
