import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: Request, _ctx: { params: Promise<{}> }) {
  try {
    const { postId, audioUrl } = await request.json();
    
    if (!postId || !audioUrl) {
      return NextResponse.json(
        { error: 'postId and audioUrl are required' },
        { status: 400 }
      );
    }

    console.log(`🎵 Starting transcription for post ${postId} with audio URL: ${audioUrl.substring(0, 80)}...`);

    // Update post status to processing
    await prisma.post.update({
      where: { id: postId },
      data: { 
        transcriptionStatus: 'processing',
        audioTranscription: null
      }
    });

    // Use local development or production environment for transcription
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://gotcarrot.com' 
      : 'http://localhost:3005';
    
    const transcriptionServiceUrl = `${baseUrl}/api/audio/transcribe`;

    // Start background transcription process
    processTranscription(postId, audioUrl, transcriptionServiceUrl).catch(error => {
      console.error(`❌ Background transcription failed for post ${postId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: 'Transcription started in background',
      status: 'processing'
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

// Rate limiting tracker for LanguageTool FREE API
const rateLimitTracker = {
  requests: [] as number[],
  maxRequestsPerMinute: 20,
  
  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove requests older than 1 minute
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    
    return this.requests.length < this.maxRequestsPerMinute;
  },
  
  recordRequest(): void {
    this.requests.push(Date.now());
  },
  
  getRemainingRequests(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    return Math.max(0, this.maxRequestsPerMinute - this.requests.length);
  }
};

// Function to improve transcription using LanguageTool FREE API
async function improveTranscriptionWithLanguageTool(rawText: string): Promise<string> {
  if (!rawText || rawText.trim().length === 0) return rawText;
  
  // Check rate limit
  if (!rateLimitTracker.canMakeRequest()) {
    const remaining = rateLimitTracker.getRemainingRequests();
    console.warn(`🚨 LanguageTool FREE API rate limit reached! ${remaining} requests remaining in current minute`);
    
    // Alert to upgrade to premium
    console.error('🚨 UPGRADE ALERT: Consider upgrading to LanguageTool Premium ($19.99/month) for unlimited requests at https://languagetoolplus.com/pricing');
    
    // Fallback to basic cleanup
    return basicCleanup(rawText);
  }
  
  try {
    // Basic cleanup first
    let cleaned = basicCleanup(rawText);
    
    // Record the request
    rateLimitTracker.recordRequest();
    
    // Call LanguageTool FREE API
    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: cleaned,
        language: 'en-US'
      })
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        console.warn('🚨 LanguageTool FREE API rate limit exceeded by server');
        console.error('🚨 UPGRADE ALERT: Consider upgrading to LanguageTool Premium for unlimited requests');
      }
      console.warn('LanguageTool FREE API failed, using basic cleanup');
      return cleaned;
    }
    
    const result = await response.json();
    
    // Apply corrections
    let corrected = cleaned;
    const corrections = result.matches || [];
    
    // Sort by offset in reverse order to avoid position shifts
    corrections.sort((a: any, b: any) => b.offset - a.offset);
    
    for (const match of corrections) {
      if (match.replacements && match.replacements.length > 0) {
        const replacement = match.replacements[0].value;
        const start = match.offset;
        const end = start + match.length;
        
        corrected = corrected.slice(0, start) + replacement + corrected.slice(end);
      }
    }
    
    // Final cleanup
    corrected = corrected
      .replace(/^([a-z])/, (match, letter) => letter.toUpperCase())
      .replace(/([a-zA-Z])$/, '$1.');
    
    const remaining = rateLimitTracker.getRemainingRequests();
    console.log(`🔧 Grammar correction applied. Remaining FREE requests: ${remaining}/20 per minute`);
    
    // Alert when getting close to limit
    if (remaining <= 5) {
      console.warn(`⚠️ Only ${remaining} FREE requests remaining this minute. Consider upgrading to Premium for unlimited usage.`);
    }
    
    return corrected;
    
  } catch (error) {
    console.warn('LanguageTool processing failed:', error);
    return basicCleanup(rawText);
  }
}

// Basic cleanup fallback function
function basicCleanup(rawText: string): string {
  return rawText.trim()
    .replace(/\s+/g, ' ')
    .replace(/\band,\s+/g, '. ')
    .replace(/\buh,?\s+/gi, '')
    .replace(/\bum,?\s+/gi, '')
    .replace(/\ber,?\s+/gi, '')
    .replace(/^([a-z])/, (match, letter) => letter.toUpperCase())
    .replace(/([a-zA-Z])$/, '$1.');
}

async function processTranscription(postId: string, audioUrl: string, transcriptionServiceUrl: string) {
  // Import the shared prisma instance instead of creating a new one
  const prisma = (await import('../../../../lib/prisma')).default;
  
  try {
    console.log(`🎵 Processing transcription for post ${postId} using local service`);
    
    // Check if this is a YouTube audio URL that needs proxying
    const isYouTubeAudio = audioUrl.includes('googlevideo.com/videoplayback');
    let audioBuffer: ArrayBuffer;
    
    if (isYouTubeAudio) {
      // For YouTube audio, use Railway service to download with proper authentication
      const RAILWAY_SERVICE_URL = process.env.RAILWAY_INGESTION_URL || 'http://localhost:8000';
      console.log(`🎵 Proxying YouTube audio download through Railway service`);
      
      const proxyResponse = await fetch(`${RAILWAY_SERVICE_URL}/download-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: audioUrl }),
      });
      
      if (!proxyResponse.ok) {
        throw new Error(`Failed to proxy YouTube audio: ${proxyResponse.statusText}`);
      }
      
      audioBuffer = await proxyResponse.arrayBuffer();
    } else {
      // For regular audio URLs, download directly
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
      }
      audioBuffer = await audioResponse.arrayBuffer();
    }
    
    const audioSize = audioBuffer.byteLength;
    const audioDuration = Math.max(1, Math.floor(audioSize / 16000)); // Rough estimate
    
    // Call the Vosk transcription service
    const transcriptionServiceUrl = process.env.TRANSCRIPTION_SERVICE_URL || 'https://vosk-transcription-591459094147.us-central1.run.app';
    
    console.log(`🎵 Calling Vosk transcription service: ${transcriptionServiceUrl}`);
    
    try {
      const transcriptionResponse = await fetch(`${transcriptionServiceUrl}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: postId,
          audioUrl: audioUrl
        }),
      });

      if (transcriptionResponse.ok) {
        const transcriptionResult = await transcriptionResponse.json();
        console.log('✅ Transcription completed:', transcriptionResult);
        
        // Update the post with the transcription
        const improvedTranscription = await improveTranscriptionWithLanguageTool(transcriptionResult.transcription || transcriptionResult.text);
        await prisma.post.update({
          where: { id: postId },
          data: {
            transcriptionStatus: 'completed',
            audioTranscription: improvedTranscription
          }
        });
      } else {
        console.error('❌ Transcription service error:', transcriptionResponse.status, transcriptionResponse.statusText);
        
        // Mark as completed with error message
        await prisma.post.update({
          where: { id: postId },
          data: {
            transcriptionStatus: 'completed',
            audioTranscription: 'Transcription service temporarily unavailable. Please try again later.'
          }
        });
      }
    } catch (transcriptionError) {
      console.error('❌ Transcription service error:', transcriptionError);
      
      // Mark as completed with error message
      await prisma.post.update({
        where: { id: postId },
        data: {
          transcriptionStatus: 'completed',
          audioTranscription: 'Transcription service temporarily unavailable. Please try again later.'
        }
      });
    }

    console.log(`✅ Transcription processing completed for post ${postId}`);

  } catch (error) {
    console.error(`❌ Transcription failed for post ${postId}:`, error);
    
    // Update database with error status
    try {
      await prisma.post.update({
        where: { id: postId },
        data: {
          transcriptionStatus: 'failed',
          audioTranscription: `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
    } catch (dbError) {
      console.error('Failed to update database with error status:', dbError);
    }
  } finally {
    await prisma.$disconnect();
  }
}
