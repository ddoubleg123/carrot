import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanupGrammar, basicGrammarCleanup } from '@/lib/languageTool';

export const runtime = 'nodejs';

// Transcription service URL (will be Cloud Run URL when deployed)
const TRANSCRIPTION_SERVICE_URL = process.env.TRANSCRIPTION_SERVICE_URL || 'http://localhost:8081';

export async function POST(request: NextRequest) {
  let postId: string | undefined;
  
  try {
    const requestData = await request.json();
    postId = requestData.postId;
    const audioUrl = requestData.audioUrl;
    const videoUrl = requestData.videoUrl;
    const transcription = requestData.transcription;
    const status = requestData.status;

    // Handle direct transcription update from Python service (enhanced transcription)
    if (postId && transcription && status && !audioUrl) {
      console.log(`🎯 Receiving enhanced transcription update for post ${postId}`);
      
      // Apply additional frontend cleanup to the already-enhanced transcription
      let finalTranscription = transcription;
      try {
        console.log(`🔧 Applying frontend LanguageTool cleanup to enhanced transcription`);
        finalTranscription = await cleanupGrammar(transcription);
        console.log(`✅ Frontend LanguageTool cleanup completed for post ${postId}`);
      } catch (error) {
        console.warn(`⚠️ Frontend LanguageTool failed, using Python-enhanced transcription for post ${postId}:`, error);
        finalTranscription = basicGrammarCleanup(transcription);
      }
      
      // Update post with final enhanced transcription
      await prisma.post.update({
        where: { id: postId },
        data: { 
          transcriptionStatus: status,
          audioTranscription: finalTranscription
        }
      });
      
      console.log(`✅ Successfully saved enhanced transcription for post ${postId}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Enhanced transcription saved successfully',
        transcription: finalTranscription,
        status: status
      });
    }

    // Original workflow: initiate transcription with Cloud Run service
    if (!postId || (!audioUrl && !videoUrl)) {
      return NextResponse.json({ error: 'postId and either audioUrl or videoUrl are required for transcription initiation' }, { status: 400 });
    }

    // Update post status directly to processing (skip redundant pending update)
    await prisma.post.update({
      where: { id: postId },
      data: { 
        transcriptionStatus: 'processing',
        audioTranscription: null
      }
    });

    // Trigger transcription service (fire-and-forget)
    console.log(`🎵 Starting background transcription for post ${postId}`);

    // Fire-and-forget transcription call (don't wait for completion)
    const mediaUrl = audioUrl || videoUrl;
    const mediaType = audioUrl ? 'audio' : 'video';
    console.log(`🎵 Sending ${mediaType} file to transcription service: ${mediaUrl.substring(0, 80)}...`);
    // Call the Vosk transcription service
    const transcriptionServiceUrl = process.env.TRANSCRIPTION_SERVICE_URL || 'https://vosk-transcription-591459094147.us-central1.run.app';
    
    try {
      console.log(`🔄 Calling transcription service at ${transcriptionServiceUrl}`);
      
      const voskResponse = await fetch(`${transcriptionServiceUrl}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          audioUrl,
          videoUrl,
          mediaType
        }),
      });

      if (!voskResponse.ok) {
        throw new Error(`Vosk service responded with status: ${voskResponse.status}`);
      }

      const voskResult = await voskResponse.json();
      console.log('✅ Vosk transcription result:', voskResult);

      if (!voskResult.success || !voskResult.transcription) {
        throw new Error('Vosk service did not return a valid transcription');
      }

      let transcription = voskResult.transcription;

      // Apply additional grammar cleanup
      let cleanedTranscription = transcription;
      try {
        console.log(`🔧 Starting grammar cleanup for post ${postId}`);
        cleanedTranscription = await cleanupGrammar(transcription);
        console.log(`✅ LanguageTool cleanup completed for post ${postId}`);
      } catch (error) {
        console.warn(`⚠️ LanguageTool failed, using basic cleanup for post ${postId}:`, error);
        cleanedTranscription = basicGrammarCleanup(transcription);
      }
      
      // Update post with cleaned transcription results
      await prisma.post.update({
        where: { id: postId },
        data: { 
          transcriptionStatus: 'completed',
          audioTranscription: cleanedTranscription
        }
      });

      console.log(`✅ Real transcription completed for post ${postId}`);

      return NextResponse.json({ 
        success: true, 
        message: 'Transcription completed',
        status: 'completed',
        transcription: cleanedTranscription
      });

    } catch (voskError) {
      console.error('❌ Vosk transcription service failed:', voskError);
      
      // Update post status to failed
      await prisma.post.update({
        where: { id: postId },
        data: { 
          transcriptionStatus: 'failed',
          audioTranscription: `Transcription failed: ${voskError.message}`
        }
      });

      return NextResponse.json({ 
        success: false, 
        error: `Transcription service failed: ${voskError.message}`,
        status: 'failed'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Transcription API error:', error);
    
    // Update post status to failed on API error
    try {
      await prisma.post.update({
        where: { id: postId },
        data: { 
          transcriptionStatus: 'failed',
          audioTranscription: 'Transcription service unavailable'
        }
      });
    } catch (dbError) {
      console.error('Failed to update post status on error:', dbError);
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    // Get transcription status
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        transcriptionStatus: true,
        audioTranscription: true
      }
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: post.transcriptionStatus || 'none',
      transcription: post.audioTranscription
    });

  } catch (error) {
    console.error('Transcription status API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
