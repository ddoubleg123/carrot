import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Generates a simple WAV tone: GET /api/tone?f=440&d=5
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const f = Math.min(2000, Math.max(50, Number(searchParams.get('f')) || 440));
  const d = Math.min(15, Math.max(1, Number(searchParams.get('d')) || 5));
  const sr = 44100;
  const numSamples = Math.floor(d * sr);

  // WAV header for 16-bit PCM mono
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample * 1; // mono
  const byteRate = sr * blockAlign;
  const dataSize = numSamples * bytesPerSample;
  const fileSize = 44 - 8 + dataSize;

  const buf = Buffer.alloc(44 + dataSize);
  let o = 0;
  function wstr(s: string) { buf.write(s, o); o += s.length; }
  function w32(v: number) { buf.writeUInt32LE(v >>> 0, o); o += 4; }
  function w16(v: number) { buf.writeUInt16LE(v & 0xffff, o); o += 2; }

  // RIFF header
  wstr('RIFF');        // ChunkID
  w32(fileSize);       // ChunkSize
  wstr('WAVE');        // Format
  // fmt chunk
  wstr('fmt ');
  w32(16);             // Subchunk1Size (PCM)
  w16(1);              // AudioFormat (1 = PCM)
  w16(1);              // NumChannels
  w32(sr);             // SampleRate
  w32(byteRate);       // ByteRate
  w16(blockAlign);     // BlockAlign
  w16(16);             // BitsPerSample
  // data chunk
  wstr('data');
  w32(dataSize);

  // Synthesize sine tone at -6 dBFS
  const amp = 0.5 * 32767; // -6 dB approx
  for (let n = 0; n < numSamples; n++) {
    const t = n / sr;
    const s = Math.sin(2 * Math.PI * f * t);
    const v = Math.max(-32768, Math.min(32767, Math.round(s * amp)));
    buf.writeInt16LE(v, 44 + n * 2);
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
