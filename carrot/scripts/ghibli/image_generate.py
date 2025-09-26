import argparse
import json
import os
from PIL import Image, ImageFilter, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prompt', type=str, default='')
    parser.add_argument('--model', type=str, default='animeganv3', choices=['animeganv3', 'sd-lora'])
    parser.add_argument('--out', type=str, required=True)
    parser.add_argument('--input_image', type=str, default='')
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.out), exist_ok=True)

    meta = {
        'prompt': args.prompt,
        'model': args.model,
    }

    try:
        if args.input_image and os.path.exists(args.input_image):
            img = Image.open(args.input_image).convert('RGB')
            # Placeholder stylization: lightly smooth + edge enhance to suggest toon effect
            img = img.filter(ImageFilter.SMOOTH_MORE).filter(ImageFilter.EDGE_ENHANCE)
        else:
            # Generate a simple placeholder canvas
            img = Image.new('RGB', (768, 512), color=(220, 230, 240))
            draw = ImageDraw.Draw(img)
            caption = (args.prompt or 'Ghibli style scene')[:120]
            try:
                # Use a default font if available
                font = ImageFont.load_default()
            except Exception:
                font = None
            draw.text((24, 24), f"Model: {args.model}", fill=(20, 60, 90), font=font)
            draw.text((24, 56), f"Prompt: {caption}", fill=(20, 60, 90), font=font)

        img.save(args.out, format='PNG')

        print(json.dumps({
            'ok': True,
            'outputPath': args.out,
            'meta': meta,
        }))
    except Exception as e:
        print(json.dumps({'ok': False, 'message': str(e)}))


if __name__ == '__main__':
    main()
