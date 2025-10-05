import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[Latest Thumbnail API] Starting query...');
    
    // First, let's check if there are any posts at all
    const totalPosts = await prisma.post.count();
    console.log('[Latest Thumbnail API] Total posts:', totalPosts);
    
    // Check posts with thumbnails
    const postsWithThumbnails = await prisma.post.count({
      where: {
        thumbnailUrl: {
          not: null
        }
      }
    });
    console.log('[Latest Thumbnail API] Posts with thumbnails:', postsWithThumbnails);
    
    // Find the most recent post with a thumbnail
    const latestPost = await prisma.post.findFirst({
      where: {
        thumbnailUrl: {
          not: null
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('[Latest Thumbnail API] Latest post found:', !!latestPost);
    console.log('[Latest Thumbnail API] Latest post data:', latestPost);

    if (!latestPost) {
      return NextResponse.json(
        { 
          error: 'No posts with thumbnails found',
          debug: {
            totalPosts,
            postsWithThumbnails
          }
        },
        { status: 404 }
      );
    }

    // Also check MediaAsset table for additional thumbnail info
    const mediaAsset = await prisma.mediaAsset.findFirst({
      where: {
        thumbUrl: {
          not: null
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const response = {
      id: latestPost.id,
      postId: latestPost.id,
      userId: latestPost.userId,
      thumbnailUrl: latestPost.thumbnailUrl,
      videoUrl: latestPost.videoUrl,
      content: latestPost.content,
      createdAt: latestPost.createdAt.toISOString(),
      author: {
        name: 'Unknown',
        username: 'unknown'
      },
      // Additional info from MediaAsset if available
      mediaAsset: mediaAsset ? {
        thumbUrl: mediaAsset.thumbUrl,
        thumbPath: mediaAsset.thumbPath,
        createdAt: mediaAsset.createdAt.toISOString()
      } : null
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error in latest thumbnail API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch latest thumbnail',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
