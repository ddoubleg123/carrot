import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get('src');

  if (!src) {
    return new NextResponse('Missing src parameter', { status: 400 });
  }

  try {
    // Security: Prevent directory traversal
    if (src.includes('..') || src.startsWith('/') || src.includes('\\')) {
      return new NextResponse('Invalid image path', { status: 400 });
    }

    const imagePath = join(process.cwd(), 'public', src);
    const image = await readFile(imagePath);
    const mimeType = getMimeType(src);
    // Convert Buffer to Uint8Array for NextResponse
    const imageData = new Uint8Array(image);
    return new NextResponse(imageData, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return new NextResponse('Image not found', { status: 404 });
  }
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}
