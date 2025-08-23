import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

// Allow-listed files we proxy (UMD build)
const TYPES: Record<string, string> = {
  'ffmpeg.min.js': 'application/javascript; charset=utf-8',
  'ffmpeg-core.js': 'application/javascript; charset=utf-8',
  'ffmpeg-core.wasm': 'application/wasm',
  'ffmpeg-core.worker.js': 'application/javascript; charset=utf-8',
};

const SOURCES = [
  // unpkg
  'https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/umd/',
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/',
  // jsDelivr
  'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.6/dist/umd/',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/',
];

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const { file: raw } = await ctx.params;
  // Explicitly ignore hashed and generic names to avoid accidental execution in SSR or worker contexts.
  // e.g. 814.ffmpeg.js, ffmpeg.js, and any *.map -> 204 No Content (silence dev noise)
  if (/^\d+\.ffmpeg\.js$/.test(raw) || raw === 'ffmpeg.js' || raw.endsWith('.map')) {
    return new NextResponse(null, { status: 204 });
  }
  let name = raw;
  if (!TYPES[name]) return new NextResponse('Not found', { status: 404 });

  // 1) Try local node_modules (no external network)
  const localMap: Record<string, string> = {
    'ffmpeg.min.js': path.join(process.cwd(), 'node_modules', '@ffmpeg', 'ffmpeg', 'dist', 'umd', 'ffmpeg.min.js'),
    'ffmpeg-core.js': path.join(process.cwd(), 'node_modules', '@ffmpeg', 'core', 'dist', 'umd', 'ffmpeg-core.js'),
    'ffmpeg-core.wasm': path.join(process.cwd(), 'node_modules', '@ffmpeg', 'core', 'dist', 'umd', 'ffmpeg-core.wasm'),
    'ffmpeg-core.worker.js': path.join(process.cwd(), 'node_modules', '@ffmpeg', 'core', 'dist', 'umd', 'ffmpeg-core.worker.js'),
  };

  const localPath = localMap[name];
  if (localPath) {
    try {
      const buf = await fs.readFile(localPath);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': TYPES[name],
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {}
  }

  // Map file -> package base
  const packageBases: string[] = name.startsWith('ffmpeg-core')
    ? SOURCES.filter((s) => s.includes('/core@'))
    : SOURCES.filter((s) => s.includes('/ffmpeg@'));

  const ua = req.headers.get('user-agent') || 'carrot-ffmpeg-proxy';
  let lastErr: any = null;
  for (const base of packageBases) {
    const url = base + name;
    try {
      const upstream = await fetch(url, {
        // avoid opaque caching issues during dev
        cache: 'no-store',
        headers: { 'User-Agent': ua },
      });
      if (!upstream.ok) {
        lastErr = new Error(`Upstream ${url} -> ${upstream.status}`);
        continue;
      }
      const buf = await upstream.arrayBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': TYPES[name],
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  return new NextResponse(`Upstream failed: ${lastErr?.message || 'unknown'}`, { status: 502 });
}
