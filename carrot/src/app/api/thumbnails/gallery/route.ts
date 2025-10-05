import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[Gallery Thumbnails API] Starting query...');
    
    // Get posts with thumbnails, ordered by most recent first
    const postsWithThumbnails = await prisma.post.findMany({
      where: {
        thumbnailUrl: {
          not: null
        }
      },
      select: {
        id: true,
        thumbnailUrl: true,
        videoUrl: true,
        content: true,
        createdAt: true,
        userId: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20 // Limit to 20 most recent thumbnails
    });

    console.log('[Gallery Thumbnails API] Found posts with thumbnails:', postsWithThumbnails.length);

    // Transform the data for the gallery
    const thumbnails = postsWithThumbnails.map(post => ({
      id: post.id,
      thumbnailUrl: post.thumbnailUrl,
      videoUrl: post.videoUrl,
      content: post.content,
      createdAt: post.createdAt.toISOString(),
      userId: post.userId
    }));

    return NextResponse.json({
      thumbnails,
      count: thumbnails.length
    });
    
  } catch (error) {
    console.error('Error in gallery thumbnails API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch gallery thumbnails',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
