import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const imagePath = join(process.cwd(), 'public', 'carrot-logo.png');
    const image = await readFile(imagePath);
    // Convert Buffer to Uint8Array for NextResponse
    const imageData = new Uint8Array(image);
    return new NextResponse(imageData, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving logo:', error);
    return new NextResponse('Logo not found', { status: 404 });
  }
}
