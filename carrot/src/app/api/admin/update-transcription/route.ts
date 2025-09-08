import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin endpoint to update transcription status - no auth required for development
export async function POST(request: any, context: any) {
  try {
    const { postId, transcriptionStatus, audioTranscription } = await request.json();
    
    if (!postId) {
      return NextResponse.json(
        { error: 'postId is required' },
        { status: 400 }
      );
    }

    console.log(`🔧 Admin updating transcription for post ${postId}`);

    // Update the post with transcription data
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(transcriptionStatus && { transcriptionStatus }),
        ...(audioTranscription && { audioTranscription }),
        updatedAt: new Date() // Force timestamp update
      },
      select: {
        id: true,
        transcriptionStatus: true,
        audioTranscription: true,
        updatedAt: true
      }
    });

    console.log(`✅ Admin transcription update completed for post ${postId}`);
    console.log(`New status: ${updatedPost.transcriptionStatus}`);

    return NextResponse.json({
      success: true,
      message: 'Transcription updated successfully',
      post: updatedPost
    });

  } catch (error) {
    console.error('Admin transcription update error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update transcription',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
