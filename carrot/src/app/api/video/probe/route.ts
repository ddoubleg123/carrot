import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Probe a remote video for codecs using ffprobe (if available)
// GET /api/video/probe?url=... or ?bucket=...&path=...
export async function GET(req: Request) {
  try {
    const { searchParams, origin } = new URL(req.url);
    let url = searchParams.get('url') || '';
    const bucket = searchParams.get('bucket') || '';
    const path = searchParams.get('path') || '';

    if (!url && bucket && path) {
      const clean = decodeURIComponent(decodeURIComponent(path)).replace(/^\/+/, '');
      url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(clean)}?alt=media`;
    }

    if (!url) {
      return NextResponse.json({ ok: false, error: 'missing url or bucket/path' }, { status: 400 });
    }

    // Decode once if double-encoded
    try { url = decodeURIComponent(url); } catch {}
    // Resolve relative to origin if necessary
    try {
      const u = new URL(url, origin);
      url = u.toString();
    } catch {}

    // Run ffprobe to get streams and format
    let stdout = '';
    try {
      const cmd = `ffprobe -v error -of json -show_streams -show_format "${url}"`;
      const { stdout: out } = await execAsync(cmd, { timeout: 10000, maxBuffer: 1024 * 1024 });
      stdout = out || '';
    } catch (e: any) {
      // ffprobe not available or cannot access URL
      return NextResponse.json({ ok: true, supported: null, reason: 'ffprobe_unavailable_or_network', detail: e?.message }, { status: 200 });
    }

    let parsed: any = null;
    try { parsed = JSON.parse(stdout); } catch {}
    if (!parsed || !Array.isArray(parsed.streams)) {
      return NextResponse.json({ ok: true, supported: null, reason: 'probe_parse_failed' }, { status: 200 });
    }

    const v = parsed.streams.find((s: any) => s.codec_type === 'video');
    const a = parsed.streams.find((s: any) => s.codec_type === 'audio');

    const vCodec = (v?.codec_name || '').toLowerCase();
    const vProfile = (v?.profile || '').toLowerCase();
    const aCodec = (a?.codec_name || '').toLowerCase();

    const videoOk = vCodec === 'h264' || vCodec === 'avc1';
    const audioOk = aCodec === 'aac' || aCodec === 'mp4a' || aCodec === '' /* tolerate missing audio */;

    const supported = Boolean(videoOk && audioOk);

    return NextResponse.json({ ok: true, supported, codecs: { video: vCodec, videoProfile: vProfile, audio: aCodec } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'probe_failed' }, { status: 500 });
  }
}
