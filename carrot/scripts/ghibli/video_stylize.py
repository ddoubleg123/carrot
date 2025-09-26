import argparse
import json
import os
import subprocess
import sys


def run(cmd):
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = p.communicate()
    return p.returncode, out.decode('utf-8', errors='ignore'), err.decode('utf-8', errors='ignore')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=str, default='animeganv3', choices=['animeganv3', 'diffutoon'])
    parser.add_argument('--input', type=str, required=True)
    parser.add_argument('--out', type=str, required=True)
    parser.add_argument('--prompt', type=str, default='')
    args = parser.parse_args()

    meta = {
        'model': args.model,
        'prompt': args.prompt,
    }

    # Ensure output dir exists
    os.makedirs(os.path.dirname(args.out), exist_ok=True)

    try:
        # Placeholder stylization using ffmpeg edgedetect + desat to simulate toon pass
        # Replace with real frame-by-frame AnimeGANv3 or Diffutoon later.
        # Note: We keep audio from input.
        vf = (
            "format=yuv420p,"
            "edgedetect=low=0.1:high=0.3,"
            "hue=s=0.5"
        )
        cmd = [
            'ffmpeg', '-y',
            '-i', args.input,
            '-vf', vf,
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
            '-c:a', 'copy',
            args.out,
        ]
        code, out, err = run(cmd)
        if code != 0:
            raise RuntimeError(f'ffmpeg failed: {err.strip()[:300]}')

        print(json.dumps({
            'ok': True,
            'outputPath': args.out,
            'meta': meta,
        }))
    except Exception as e:
        print(json.dumps({'ok': False, 'message': str(e)}))


if __name__ == '__main__':
    main()
