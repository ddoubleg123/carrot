import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { postId, audioUrl } = await request.json();
    
    if (!postId || !audioUrl) {
      return NextResponse.json(
        { error: 'postId and audioUrl are required' },
        { status: 400 }
      );
    }

    // Cloud Run service URL (replace with your actual deployed URL)
    const TRANSCRIPTION_SERVICE_URL = process.env.TRANSCRIPTION_SERVICE_URL;
    
    if (!TRANSCRIPTION_SERVICE_URL) {
      console.log('Transcription service not configured, skipping background transcription');
      return NextResponse.json({
        success: true,
        message: 'Audio uploaded successfully. Transcription service not configured.'
      });
    }

    // Trigger background transcription (fire and forget)
    fetch(TRANSCRIPTION_SERVICE_URL + '/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        postId,
        audioUrl,
      }),
    }).catch(error => {
      console.error('Failed to trigger transcription:', error);
      // Don't fail the upload if transcription trigger fails
    });

    return NextResponse.json({
      success: true,
      message: 'Audio uploaded successfully. Transcription started in background.'
    });

  } catch (error) {
    console.error('Transcription trigger error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to trigger transcription',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
