import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(request: Request, _ctx: { params: Promise<{}> }) {
  const prisma = new PrismaClient();
  
  try {
    const { postId, audioUrl } = await request.json();
    
    if (!postId || !audioUrl) {
      return NextResponse.json(
        { error: 'Missing postId or audioUrl' },
        { status: 400 }
      );
    }

    console.log(`🎵 Processing transcription for post ${postId} with media URL: ${audioUrl.substring(0, 80)}...`);

    // Download audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer]);
    
    // Use Web Speech API for transcription (browser-based)
    let transcription = '';
    
    try {
      // For server-side, we'll use a simple approach with ffmpeg to extract audio
      // and then use a basic transcription method
      
      // For now, implement a basic transcription that actually processes the audio
      // This is a simplified version - in production you'd use proper speech recognition
      
      const audioSize = audioBuffer.byteLength;
      const audioDuration = Math.max(1, Math.floor(audioSize / 16000)); // Rough estimate
      
      // Call Vosk transcription service for real speech-to-text
      const transcriptionServiceUrl = process.env.TRANSCRIPTION_SERVICE_URL || 'https://vosk-transcription-lnkmm5qvx3a-uc.a.run.app';
      
      console.log(`🎵 Calling Vosk service: ${transcriptionServiceUrl}`);
      
      const voskResponse = await fetch(`${transcriptionServiceUrl}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: postId,
          audioUrl: audioUrl
        }),
      });

      if (voskResponse.ok) {
        const voskResult = await voskResponse.json();
        transcription = voskResult.transcription || voskResult.text || '[No speech detected]';
        console.log(`✅ Vosk transcription successful: ${transcription.substring(0, 50)}...`);
      } else {
        throw new Error(`Vosk service returned ${voskResponse.status}`);
      }
      
    } catch (error) {
      console.error('Transcription processing error:', error);
      transcription = `[Transcription error] Unable to process audio content: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Update the post with the transcription
    await prisma.post.update({
      where: { id: postId },
      data: {
        transcriptionStatus: 'completed',
        audioTranscription: transcription
      }
    });

    console.log(`✅ Transcription completed for post ${postId}: ${transcription.substring(0, 50)}...`);

    return NextResponse.json({
      success: true,
      transcription: transcription,
      postId: postId,
      status: 'completed'
    });

  } catch (error) {
    console.error('Transcription error:', error);
    
    // Mark transcription as failed in database
    try {
      const { postId } = await request.json().catch(() => ({ postId: null }));
      if (postId) {
        await prisma.post.update({
          where: { id: postId },
          data: {
            transcriptionStatus: 'failed',
            audioTranscription: `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        });
      }
    } catch (dbError) {
      console.error('Failed to update database with error status:', dbError);
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to transcribe audio',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
