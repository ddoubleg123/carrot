import { NextResponse } from 'next/server';
import { basicGrammarCleanup } from '@/lib/languageTool';
import { transcribeLocalBytes, transcribeLocalUrl } from '@/lib/asr/localVosk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024;

function presentTranscript(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (!/^Speaker \d+$/m.test(trimmed)) return basicGrammarCleanup(trimmed);
  return trimmed
    .split(/\n{2,}/)
    .map((block) => {
      const [label, ...rest] = block.split('\n');
      const name = label.trim();
      if (!/^Speaker \d+$/.test(name)) return basicGrammarCleanup(block);
      const body = basicGrammarCleanup(rest.join(' ').trim());
      return body ? `${name}\n${body}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function storedMediaUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (url.host !== 'firebasestorage.googleapis.com' && !url.host.endsWith('.firebasestorage.app')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      const url = storedMediaUrl(body?.url);
      if (!url) return NextResponse.json({ error: 'That recording cannot be transcribed.' }, { status: 400 });
      const result = await transcribeLocalUrl(url);
      const text = result.silent ? '' : presentTranscript(result.text);
      return NextResponse.json({ text, silent: result.silent || !text });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Attach an audio or video file.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Keep audio and video under 25 MB.' }, { status: 400 });
    }

    const extension = file.name.includes('.') ? file.name.split('.').pop() || 'media' : 'media';
    const result = await transcribeLocalBytes(Buffer.from(await file.arrayBuffer()), extension);
    const text = result.silent ? '' : presentTranscript(result.text);

    return NextResponse.json({ text, silent: result.silent || !text });
  } catch (error) {
    console.error('Local transcription failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed' },
      { status: 500 }
    );
  }
}
