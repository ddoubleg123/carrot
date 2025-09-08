import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    console.log('🟡 Thumbnail serve request:', filename);
    
    // Security: Only allow specific filename patterns to prevent directory traversal
    // Accepts filenames like 1754668780526_001 (timestamp_id)
    if (!/^\d{13}_\d{3}$/.test(filename)) {
      console.error('❌ Invalid filename pattern:', filename);
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const tempDir = join(process.cwd(), 'temp');
    const filePath = join(tempDir, `thumb_${filename}.jpg`);
    console.log('🟡 Thumbnail filePath:', filePath);

    if (!existsSync(filePath)) {
      console.error('❌ Thumbnail not found at:', filePath);
      return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    }

    const imageBuffer = await readFile(filePath);

    return new NextResponse(imageBuffer as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('❌ Thumbnail serve error:', error);
    if (error instanceof Error) {
      console.error('❌ Error stack:', error.stack);
    }
    return NextResponse.json({ 
      error: 'Failed to serve thumbnail',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
