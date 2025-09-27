import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { auth } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/patch/[handle]/posts - Get posts for a specific patch
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get the patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      include: {
        posts: {
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                username: true,
                profilePhoto: true,
                image: true
              }
            }
          }
        }
      }
    });

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 });
    }

    // Transform posts to include media information
    const transformedPosts = patch.posts.map(post => ({
      id: post.id,
      content: post.content || '',
      videoUrl: post.videoUrl,
      imageUrls: post.imageUrls ? (typeof post.imageUrls === 'string' ? JSON.parse(post.imageUrls) : post.imageUrls) : [],
      audioUrl: post.audioUrl,
      createdAt: post.createdAt,
      user: {
        id: post.User.id,
        name: post.User.name || 'Unknown',
        username: post.User.username || 'unknown',
        avatar: post.User.profilePhoto || post.User.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.User.name || 'User')}&background=FF6A00&color=fff&size=40`
      },
      tags: [], // You can add tags from post metadata if needed
      metrics: post.metrics ? (typeof post.metrics === 'string' ? JSON.parse(post.metrics) : post.metrics) : {}
    }));

    return NextResponse.json({
      success: true,
      posts: transformedPosts,
      total: patch.posts.length,
      patch: {
        id: patch.id,
        name: patch.name,
        handle: patch.handle
      }
    });
  } catch (error) {
    console.error('Error fetching patch posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
