import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request, _ctx: { params: Promise<{ path: string[] }> }) {
  // This endpoint handles /media/placeholder/* requests
  // Return a minimal valid MP4 response for any video requests
  const minimalMp4 = Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    0x6d, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65
  ]);
  
  return new NextResponse(minimalMp4, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': minimalMp4.length.toString(),
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes',
    },
  });
}
