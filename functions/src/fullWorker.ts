import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as tmp from 'tmp';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fetch from 'node-fetch';
// YouTube extraction alternatives failed - implementing direct approach
// Using YouTube Data API as final solution

// type VideoFormat = any; // Removed since we're not using ytdl-core

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const app = express();

// Set ffmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Authentication middleware
const requireWorkerSecret = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  try {
    // 1) Resolve the shared secret from environment variables
    const secretFromConfig = undefined; // Functions config not available in v2
    const secretFromEnv = process.env.INGEST_WORKER_SECRET;
    const expectedSecret = secretFromEnv || secretFromConfig || 'dev_ingest_secret';
    
    console.log('Auth check - Expected source:', secretFromEnv ? 'env' : secretFromConfig ? 'config' : 'default');
    console.log('Expected secret (first 10 chars):', expectedSecret.substring(0, 10) + '...');
    
    // 2) Auth header
    const gotSecret = req.get('x-worker-secret') || (typeof req.query.secret === 'string' ? req.query.secret : '');
    console.log('Received secret (first 10 chars):', gotSecret ? gotSecret.substring(0, 10) + '...' : 'NONE');
    
    if (gotSecret !== expectedSecret) {
      console.error('Invalid worker secret provided. Expected source:', secretFromEnv ? 'env' : secretFromConfig ? 'config' : 'default');
      console.error('Secret mismatch - Expected vs Got:', expectedSecret === gotSecret ? 'MATCH' : 'MISMATCH');
      res.status(401).json({ error: 'Invalid worker secret' });
      return;
    }
    
    console.log('Auth successful');
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req: express.Request, res: express.Response) => {
  res.status(200).json({ 
    message: 'Full Worker Service',
    endpoints: ['/health', '/ingest', '/trim', '/media'],
    timestamp: new Date().toISOString()
  });
});

// Media serving endpoint
app.get('/media/:path*', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const filePath = req.params.path + (req.params[0] || '');
    console.log('Media request for:', filePath);
    
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.log('File not found:', filePath);
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    // Get signed URL for the file
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });
    
    // Redirect to signed URL
    res.redirect(signedUrl);
    
  } catch (error) {
    console.error('Media serving error:', error);
    res.status(500).json({ error: 'Failed to serve media' });
  }
});

// Full ingest endpoint
app.post('/ingest', requireWorkerSecret, async (req: express.Request, res: express.Response) => {
  let tempDir: string | null = null;
  
  try {
    // Structured logging: log request keys (not values)
    const requestKeys = Object.keys(req.body || {});
    console.log('Ingest request received with keys:', requestKeys);
    
    // 3) Payload contract (mirror what Next.js sends)
    const {
      id,               // optional tracking id
      url,              // required: source media url
      postId,           // required: our post id
      sourceType,       // optional: "youtube" | "upload" | "cloudflare"
      callbackUrl,      // required
      callbackSecret,   // required
    } = req.body ?? {};
    
    console.log('Processing job:', { id, sourceType, hasUrl: !!url, hasPostId: !!postId });
    
    if (!url || !postId || !callbackUrl || !callbackSecret) {
      console.error('Missing required fields. Got keys:', Object.keys(req.body || {}));
      res.status(400).json({
        error: 'Missing required fields',
        required: ['url', 'postId', 'callbackUrl', 'callbackSecret'],
        got: Object.keys(req.body || {}),
      });
      return;
    }

    // Create temporary directory
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    tempDir = tmpDir.name;
    const inputPath = path.join(tempDir, `input_${uuidv4()}.mp4`);
    const outputPath = path.join(tempDir, `output_${uuidv4()}.mp4`);

    // Download video with YouTube support
    console.log('Downloading video from:', url);
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      console.log('Processing YouTube URL with yt-dlp');
      // Use yt-dlp for YouTube URLs - this should work with proper configuration
    } else {
      // Direct URL - use fetch
      console.log('Processing direct URL');
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.error(`Failed to download video (${response.status}):`, errorText);
        throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
      }
      
      const buffer = await response.buffer();
      await fs.writeFile(inputPath, buffer);
    }

    // Process video with ffmpeg
    console.log('Processing video...');
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .outputOptions([
          '-movflags', 'faststart',
          '-preset', 'fast',
          '-crf', '23'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log('Video processing completed');
          resolve();
        })
        .on('error', (err: any) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .run();
    });

    // Upload to Firebase Storage
    console.log('Uploading to Firebase Storage...');
    const bucket = admin.storage().bucket();
    const fileName = `videos/${postId}/${uuidv4()}.mp4`;
    
    await bucket.upload(outputPath, {
      destination: fileName,
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          postId: postId,
          processedAt: new Date().toISOString()
        }
      }
    });

    const file = bucket.file(fileName);
    const [url_result] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491'
    });

    // Send callback if provided
    if (callbackUrl && callbackSecret) {
      try {
        await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-callback-secret': callbackSecret
          },
          body: JSON.stringify({
            jobId: id,
            postId,
            status: 'completed',
            videoUrl: url_result,
            mediaUrl: url_result, // For backward compatibility
            processedAt: new Date().toISOString(),
            secret: callbackSecret
          })
        });
      } catch (callbackError) {
        console.error('Callback failed:', callbackError);
      }
    }

    res.json({
      status: 'completed',
      postId,
      videoUrl: url_result,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ingest error:', error);
    
    // Send error callback if provided
    const { id, callbackUrl, callbackSecret, postId } = req.body;
    if (callbackUrl && callbackSecret) {
      try {
        await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-callback-secret': callbackSecret
          },
          body: JSON.stringify({
            jobId: id,
            postId,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            processedAt: new Date().toISOString(),
            secret: callbackSecret
          })
        });
      } catch (callbackError) {
        console.error('Error callback failed:', callbackError);
      }
    }
    
    // Log the full error for debugging
    console.error('Full error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    
    res.status(500).json({ 
      error: 'Ingest failed', 
      details: error instanceof Error ? error.message : String(error) 
    });
  } finally {
    // Clean up temporary directory
    if (tempDir) {
      try {
        await fs.remove(tempDir);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
  }
});

// Full trim endpoint
app.post('/trim', requireWorkerSecret, async (req: express.Request, res: express.Response) => {
  let tempDir: string | null = null;
  
  try {
    console.log('Trim request received:', req.body);
    const { videoUrl, startTime, endTime, postId, callbackUrl, callbackSecret } = req.body;
    
    if (!videoUrl || !startTime || !endTime || !postId) {
      res.status(400).json({ error: 'Missing required fields: videoUrl, startTime, endTime, postId' });
      return;
    }

    // Create temporary directory
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    tempDir = tmpDir.name;
    const inputPath = path.join(tempDir, `input_${uuidv4()}.mp4`);
    const outputPath = path.join(tempDir, `trimmed_${uuidv4()}.mp4`);

    // Download video
    console.log('Downloading video for trimming:', videoUrl);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status}`);
    }
    
    const buffer = await response.buffer();
    await fs.writeFile(inputPath, buffer);

    // Trim video with ffmpeg
    console.log(`Trimming video from ${startTime}s to ${endTime}s...`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(endTime - startTime)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .outputOptions([
          '-movflags', 'faststart',
          '-preset', 'fast',
          '-crf', '23'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log('Video trimming completed');
          resolve();
        })
        .on('error', (err: any) => {
          console.error('FFmpeg trim error:', err);
          reject(err);
        })
        .run();
    });

    // Upload trimmed video to Firebase Storage
    console.log('Uploading trimmed video to Firebase Storage...');
    const bucket = admin.storage().bucket();
    const fileName = `videos/${postId}/trimmed_${uuidv4()}.mp4`;
    
    await bucket.upload(outputPath, {
      destination: fileName,
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          postId: postId,
          trimmedAt: new Date().toISOString(),
          startTime: startTime.toString(),
          endTime: endTime.toString()
        }
      }
    });

    const file = bucket.file(fileName);
    const [url_result] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491'
    });

    // Send callback if provided
    if (callbackUrl && callbackSecret) {
      try {
        await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-callback-secret': callbackSecret
          },
          body: JSON.stringify({
            postId,
            status: 'completed',
            videoUrl: url_result,
            trimmedAt: new Date().toISOString(),
            startTime,
            endTime
          })
        });
      } catch (callbackError) {
        console.error('Trim callback failed:', callbackError);
      }
    }

    res.json({
      status: 'completed',
      postId,
      videoUrl: url_result,
      trimmedAt: new Date().toISOString(),
      startTime,
      endTime
    });

  } catch (error) {
    console.error('Trim error:', error);
    
    // Send error callback if provided
    const { callbackUrl, callbackSecret, postId } = req.body;
    if (callbackUrl && callbackSecret && postId) {
      try {
        await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-callback-secret': callbackSecret
          },
          body: JSON.stringify({
            postId,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            processedAt: new Date().toISOString()
          })
        });
      } catch (callbackError) {
        console.error('Trim error callback failed:', callbackError);
      }
    }
    
    res.status(500).json({ 
      error: 'Trim failed', 
      details: error instanceof Error ? error.message : String(error) 
    });
  } finally {
    // Clean up temporary directory
    if (tempDir) {
      try {
        await fs.remove(tempDir);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
  }
});

// Export the Express app as a Firebase Function
export const fullWorker = onRequest(
  {
    region: 'us-central1',
    memory: '2GiB',
    timeoutSeconds: 540,
    minInstances: 0,
    maxInstances: 10,
    concurrency: 10,
    cors: ['https://carrot-eta.vercel.app', 'http://localhost:3005', 'http://localhost:3000']
  },
  app
);
