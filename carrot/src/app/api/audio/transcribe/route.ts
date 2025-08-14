import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY;
    
    if (!assemblyAIKey || assemblyAIKey === 'your_assemblyai_api_key_here') {
      return NextResponse.json({
        success: false,
        error: 'AssemblyAI API key not configured',
        message: 'Please add your AssemblyAI API key to enable automatic transcription'
      });
    }

    // Step 1: Upload audio file to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': assemblyAIKey,
      },
      body: audioFile,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const { upload_url } = await uploadResponse.json();

    // Step 2: Request transcription
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': assemblyAIKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_detection: true,
      }),
    });

    if (!transcriptResponse.ok) {
      throw new Error(`Transcription request failed: ${transcriptResponse.statusText}`);
    }

    const transcript = await transcriptResponse.json();

    // Step 3: Poll for completion
    let transcriptionResult = transcript;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (transcriptionResult.status === 'processing' || transcriptionResult.status === 'queued') {
      if (attempts >= maxAttempts) {
        throw new Error('Transcription timeout');
      }

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcript.id}`, {
        headers: {
          'authorization': assemblyAIKey,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.statusText}`);
      }

      transcriptionResult = await statusResponse.json();
      attempts++;
    }

    if (transcriptionResult.status === 'error') {
      throw new Error(`Transcription failed: ${transcriptionResult.error}`);
    }

    return NextResponse.json({
      success: true,
      transcription: transcriptionResult.text || 'No speech detected in audio',
      language: transcriptionResult.language_code || 'en',
      confidence: transcriptionResult.confidence || 0,
      duration: transcriptionResult.audio_duration || 0,
    });

  } catch (error) {
    console.error('AssemblyAI transcription error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to transcribe audio',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
