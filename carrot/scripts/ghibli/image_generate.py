import argparse
import json
import os
from typing import Optional

try:
    # Make Pillow optional; only required when an input image is provided
    from PIL import Image, ImageFilter, ImageDraw, ImageFont  # type: ignore
    _PIL_AVAILABLE = True
except Exception:
    Image = ImageFilter = ImageDraw = ImageFont = None  # type: ignore
    _PIL_AVAILABLE = False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prompt', type=str, default='')
    parser.add_argument('--model', type=str, default='animeganv3', choices=['animeganv3', 'sd-lora'])
    parser.add_argument('--out', type=str, required=True)
    parser.add_argument('--input_image', type=str, default='')
    parser.add_argument('--animegan_cmd', type=str, default=os.environ.get('ANIMEGAN_CMD', ''))
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.out), exist_ok=True)

    meta = {
        'prompt': args.prompt,
        'model': args.model,
    }

    try:
        # If an input image is provided, we require Pillow
        if args.input_image and os.path.exists(args.input_image):
            if not _PIL_AVAILABLE:
                raise RuntimeError('Pillow (PIL) not installed; required to process uploaded images. Install requirements.txt')
            # If AnimeGAN command provided, use it to stylize the uploaded image
            if args.animegan_cmd:
                # The command may contain placeholders {in} and {out}
                out_path = args.out if args.out.lower().endswith('.png') else (args.out + '.png')
                cmd = args.animegan_cmd.replace('{in}', args.input_image).replace('{out}', out_path)
                import subprocess
                p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                _o, _e = p.communicate()
                if p.returncode != 0:
                    raise RuntimeError(f"AnimeGAN command failed: {(_e or b'').decode('utf-8', 'ignore')[:300]}")
                if not os.path.exists(out_path):
                    raise RuntimeError('AnimeGAN did not produce output file')
                meta['animegan'] = True
                print(json.dumps({'ok': True, 'outputPath': out_path, 'meta': meta}))
                return

            # Else, simple PIL placeholder stylization
            img = Image.open(args.input_image).convert('RGB')  # type: ignore
            img = img.filter(ImageFilter.SMOOTH_MORE).filter(ImageFilter.EDGE_ENHANCE)  # type: ignore
            out_path = args.out if args.out.lower().endswith('.png') else (args.out + '.png')
            img.save(out_path, format='PNG')  # type: ignore
            print(json.dumps({'ok': True, 'outputPath': out_path, 'meta': meta}))
            return

        # No input image: produce a PNG file
        out_path = args.out if args.out.lower().endswith('.png') else (args.out + '.png')
        if _PIL_AVAILABLE:
            # Render a simple PNG with prompt and model text
            img = Image.new('RGB', (768, 512), color=(220, 230, 240))  # type: ignore
            draw = ImageDraw.Draw(img)  # type: ignore
            caption = (args.prompt or 'Ghibli style scene')[:160]
            try:
                font = ImageFont.load_default()  # type: ignore
            except Exception:
                font = None
            draw.text((24, 24), f"Model: {args.model}", fill=(20, 60, 90), font=font)  # type: ignore
            draw.text((24, 56), f"Prompt: {caption}", fill=(20, 60, 90), font=font)  # type: ignore
            img.save(out_path, format='PNG')  # type: ignore
        else:
            # Fallback: write a solid-color PNG without external libs
            write_solid_png(out_path, 768, 512, (220, 230, 240))
        print(json.dumps({'ok': True, 'outputPath': out_path, 'meta': meta}))
    except Exception as e:
        print(json.dumps({'ok': False, 'message': str(e)}))


if __name__ == '__main__':
    main()


# --- Minimal PNG writer (solid color) ---
# Writes a valid PNG with a single IDAT chunk containing zlib-compressed raw RGB scanlines.
def write_solid_png(path: str, w: int, h: int, rgb: tuple):
    import struct, zlib, binascii

    r, g, b = rgb
    # Each scanline: filter byte (0) + RGB bytes
    raw = bytearray()
    row = bytes([0] + [r, g, b] * w)
    for _ in range(h):
        raw.extend(row)
    compressed = zlib.compress(bytes(raw), level=6)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack("!I", len(data)) + tag + data + struct.pack("!I", binascii.crc32(tag + data) & 0xffffffff)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack("!IIBBBBB", w, h, 8, 2, 0, 0, 0)  # 8-bit, RGB
    png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
