import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: Request, _ctx: { params: Promise<{}> }) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      // Return all posts with transcription info
      const posts = await prisma.post.findMany({
        where: {
          OR: [
            { audioUrl: { not: null } },
            { videoUrl: { not: null } }
          ]
        },
        select: {
          id: true,
          content: true,
          userId: true,
          audioUrl: true,
          videoUrl: true,
          audioTranscription: true,
          transcriptionStatus: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 20
      });

      const summary = {
        totalPosts: posts.length,
        withTranscription: posts.filter(p => p.audioTranscription).length,
        processing: posts.filter(p => p.transcriptionStatus === 'processing').length,
        completed: posts.filter(p => p.transcriptionStatus === 'completed').length,
        withAudio: posts.filter(p => p.audioUrl).length,
        withVideo: posts.filter(p => p.videoUrl).length
      };

      return NextResponse.json({
        success: true,
        summary,
        posts: posts.map(p => ({
          id: p.id,
          content: p.content.substring(0, 50) + '...',
          status: p.transcriptionStatus,
          hasTranscription: !!p.audioTranscription,
          transcriptionPreview: p.audioTranscription?.substring(0, 100) + '...' || null,
          hasAudio: !!p.audioUrl,
          hasVideo: !!p.videoUrl,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }))
      });
    }

    // Return specific post
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        content: true,
        userId: true,
        audioUrl: true,
        videoUrl: true,
        audioTranscription: true,
        transcriptionStatus: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error('Debug transcription API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
