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

        # No input image: generate a lightweight SVG placeholder so PIL is not required
        caption = (args.prompt or 'Ghibli style scene')[:160]
        svg = f"""
<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns='http://www.w3.org/2000/svg' width='768' height='512' viewBox='0 0 768 512'>
  <defs>
    <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
      <stop offset='0%' stop-color='hsl(210,40%,88%)'/>
      <stop offset='100%' stop-color='hsl(200,42%,82%)'/>
    </linearGradient>
  </defs>
  <rect width='100%' height='100%' fill='url(#g)'/>
  <g fill='hsl(210,50%,20%)' font-family='sans-serif'>
    <text x='24' y='40' font-size='20'>Model: {args.model}</text>
    <text x='24' y='70' font-size='16'>Prompt: {caption}</text>
  </g>
</svg>
""".strip()
        out_path = args.out
        if not out_path.lower().endswith('.svg'):
            out_path += '.svg'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(svg)
        print(json.dumps({'ok': True, 'outputPath': out_path, 'meta': meta}))
    except Exception as e:
        print(json.dumps({'ok': False, 'message': str(e)}))


if __name__ == '__main__':
    main()
