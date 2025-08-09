import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 Video thumbnail extraction API called');
    
    const formData = await request.formData();
    const file = formData.get('video') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    console.log('📁 Processing video file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Check if FFmpeg is available on the system
    let ffmpegAvailable = false;
    try {
      await execAsync('ffmpeg -version');
      ffmpegAvailable = true;
      console.log('✅ FFmpeg detected, using server-side extraction');
    } catch (error) {
      console.log('⚠️ FFmpeg not available, falling back to client-side extraction');
    }

    if (!ffmpegAvailable) {
      // Return a response indicating client should handle thumbnail extraction
      return NextResponse.json({
        success: true,
        useClientExtraction: true,
        message: 'FFmpeg not available, use client-side extraction',
        fallbackInstructions: 'Extract thumbnails using HTML5 video element on client'
      });
    }

    // FFmpeg is available, proceed with server-side extraction
    const tempDir = join(process.cwd(), 'temp');
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const inputPath = join(tempDir, `input_${timestamp}.mp4`);
    const outputPattern = join(tempDir, `thumb_${timestamp}_%03d.jpg`);

    // Save uploaded file to temp location
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(inputPath, buffer);

    console.log('💾 Video file saved to:', inputPath);

    // Get video duration first to calculate frame positions
    const durationCommand = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${inputPath}"`;
    
    let duration = 0;
    try {
      const { stdout: durationOutput } = await execAsync(durationCommand);
      duration = parseFloat(durationOutput.trim());
      console.log('📏 Video duration:', duration, 'seconds');
    } catch (error) {
      console.error('Failed to get video duration, using default extraction');
      duration = 60; // Default fallback
    }

    // Extract 10 evenly-spaced thumbnails using specific timestamps
    const thumbnailCount = 10;
    const interval = duration / (thumbnailCount + 1); // +1 to avoid first/last frame
    
    console.log(`🎬 Extracting ${thumbnailCount} thumbnails at ${interval.toFixed(2)}s intervals`);
    
    // Extract thumbnails at specific timestamps
    for (let i = 1; i <= thumbnailCount; i++) {
      const frameTimestamp = interval * i;
      const outputFile = join(tempDir, `thumb_${timestamp}_${String(i).padStart(3, '0')}.jpg`);
      
      const ffmpegCommand = [
        'ffmpeg',
        '-ss', frameTimestamp.toFixed(2), // Seek to specific timestamp
        '-i', `"${inputPath}"`,
        '-vframes', '1', // Extract exactly 1 frame
        '-q:v', '2', // High quality JPEG
        '-y', // Overwrite existing files
        `"${outputFile}"`
      ].join(' ');
      
      console.log(`🖼️ Extracting frame ${i} at ${frameTimestamp.toFixed(2)}s:`, ffmpegCommand);
      
      try {
        await execAsync(ffmpegCommand);
        console.log(`✅ Frame ${i} extracted successfully`);
      } catch (frameError) {
        console.error(`❌ Failed to extract frame ${i}:`, frameError);
      }
    }

    console.log('🔧 All thumbnail extraction commands completed');

    // Check which thumbnails were successfully created
    const successfulThumbnails: string[] = [];
    for (let i = 1; i <= thumbnailCount; i++) {
      const outputFile = join(tempDir, `thumb_${timestamp}_${String(i).padStart(3, '0')}.jpg`);
      if (existsSync(outputFile)) {
        successfulThumbnails.push(outputFile);
      }
    }

    if (successfulThumbnails.length === 0) {
      console.error('❌ No thumbnails were successfully extracted');
      
      // Cleanup input file
      try {
        await unlink(inputPath);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      
      // Fall back to client-side extraction
      return NextResponse.json({
        success: true,
        useClientExtraction: true,
        message: 'Server-side extraction failed, use client-side extraction',
        fallbackInstructions: 'Extract thumbnails using HTML5 video element on client'
      });
    }

    console.log(`✅ Successfully extracted ${successfulThumbnails.length} thumbnails`);

    // Generate thumbnail URLs for successfully extracted frames
    const thumbnailUrls: string[] = [];
    for (let i = 1; i <= thumbnailCount; i++) {
      const thumbPath = join(tempDir, `thumb_${timestamp}_${String(i).padStart(3, '0')}.jpg`);
      if (existsSync(thumbPath)) {
        // Create a URL that can serve the thumbnail
        thumbnailUrls.push(`/api/video/thumbnails/serve/${timestamp}_${String(i).padStart(3, '0')}`);
      }
    }

    console.log('🖼️ Generated thumbnails:', thumbnailUrls);

    // Cleanup input file
    try {
      await unlink(inputPath);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    return NextResponse.json({
      success: true,
      thumbnails: thumbnailUrls,
      count: thumbnailUrls.length,
      message: 'Thumbnails extracted successfully'
    });

  } catch (error) {
    console.error('❌ Thumbnail extraction API error:', error);
    
    // Always fall back to client-side extraction on any error
    return NextResponse.json({
      success: true,
      useClientExtraction: true,
      message: 'Server error, use client-side extraction',
      fallbackInstructions: 'Extract thumbnails using HTML5 video element on client',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
