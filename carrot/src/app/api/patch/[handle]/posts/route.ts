import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { auth } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/patch/[handle]/posts - Get posts for a specific patch
export async function GET(
  request: Request,
  context: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await context.params;
    const { searchParams } = new URL(request.url);
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
            author: {
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
      content: post.body || '',
      videoUrl: post.media ? (typeof post.media === 'string' ? JSON.parse(post.media) : post.media)?.videoUrl : null,
      imageUrls: post.media ? (typeof post.media === 'string' ? JSON.parse(post.media) : post.media)?.imageUrls || [] : [],
      audioUrl: post.media ? (typeof post.media === 'string' ? JSON.parse(post.media) : post.media)?.audioUrl : null,
      createdAt: post.createdAt,
      user: {
        id: post.author.id,
        name: post.author.name || 'Unknown',
        username: post.author.username || 'unknown',
        avatar: post.author.profilePhoto || post.author.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author.name || 'User')}&background=FF6A00&color=fff&size=40`
      },
      tags: post.tags || [],
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
