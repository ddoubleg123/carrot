import { NextRequest, NextResponse } from 'next/server'
import { runPipeline } from '@/lib/pipeline'

interface GenerateHeroImageRequest {
  title?: string
  summary?: string
  topic?: string
  context?: string
  description?: string
  sourceDomain?: string
  contentType?: string
  patchTheme?: string
  artisticStyle?: string
  enableHiresFix?: boolean
  preferredSubjects?: string[]
  license?: string
}

// Using new sanitizeInputs + buildPrompt system instead of simple helpers

export async function POST(request: NextRequest) {
  try {
    const reqBody: GenerateHeroImageRequest = await request.json();
    
    // Extract fields safely - support both old and new contract
    const { 
      title = "", 
      summary = "", 
      topic = "",
      context = "",
      description = "",
      sourceDomain = "",
      contentType = "article",
      patchTheme = "general",
      artisticStyle = "photorealistic", 
      enableHiresFix = false,
      preferredSubjects = [],
      license = "cc0-or-cc-by"
    } = reqBody;

    // Normalize: use topic/context if provided, otherwise fall back to title/summary
    const normalizedTitle = topic || title || ""
    const normalizedSummary = context || description || summary || ""

    // Validate required fields
    if (!normalizedTitle || !normalizedSummary) {
      console.warn('[GenerateHeroImage] Validation error:', {
        received: { title, summary, topic, context, description },
        normalized: { normalizedTitle, normalizedSummary }
      })
      return NextResponse.json(
        { 
          error: 'Title/topic and summary/context are required',
          details: 'Provide either (title, summary) or (topic, context)'
        },
        { status: 400 }
      );
    }

    // Simple prompt building
    const positivePrompt = `${normalizedTitle}. ${normalizedSummary}. ${artisticStyle} style, high quality, detailed, professional photography`;
    const negativePrompt = "blurry, low quality, distorted, ugly, deformed, bad anatomy, bad proportions, poorly drawn face, poorly drawn eyes, poorly drawn hands, text, watermark, signature, logo, extra limbs, cloned face, disfigured, out of frame, missing fingers, extra fingers, mutated hands";

    // Log final configuration for debugging
    console.log("[GenerateHeroImage] Config:", {
      enableHiresFix,
      positivePrompt: positivePrompt.substring(0, 150) + '...',
      artisticStyle,
      title: normalizedTitle,
      summary: normalizedSummary.substring(0, 100),
      preferredSubjects,
      license
    });

    console.log(`[AI Image Generator] HD Option: ${enableHiresFix ? "ON" : "OFF"}`);

    if (enableHiresFix) {
      console.log('[AI Image Generator] 🔧 Running Hires Fix pass...');
    } else {
      console.log('[AI Image Generator] ℹ️ Hires Fix skipped (HD = No)');
    }

    // Generate image using the real pipeline with safety-filter and HD logic
    try {
      // Call SDXL API directly
      const vastAiUrl = process.env.VAST_AI_URL || 'http://localhost:7860';
      
      console.log('[GenerateHeroImage] Attempting SDXL generation...');
      
      const response = await fetch(`${vastAiUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: positivePrompt,
          negative_prompt: negativePrompt,
          num_inference_steps: 30,  // Increased for better quality
          guidance_scale: 7.5,
          width: 1024,
          height: 1024,
          use_refiner: enableHiresFix,  // Use refiner when HD is enabled
          use_face_restoration: true,   // ✅ ALWAYS restore faces
          face_restoration_weight: 0.8, // Increased weight for better faces
          hires_fix: enableHiresFix,    // Use hires fix when enabled
          hires_fix_simple: false,
          use_realesrgan: enableHiresFix, // Use upscaling when HD enabled
          seed: -1  // Random seed for variety (not fixed)
        })
      });

      if (!response.ok) {
        throw new Error(`SDXL API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.image) {
        console.log('[GenerateHeroImage] SDXL API returned no image');
        return NextResponse.json(
          { success: false, error: 'no_image_generated' },
          { status: 502 }
        );
      }

      console.log('[GenerateHeroImage] ✅ Successfully generated image');

      // Convert base64 to buffer and upload to Firebase
      let finalImageUrl = result.image;
      
      try {
        // Check if it's a base64 image
        if (result.image.startsWith('data:image')) {
          console.log('[GenerateHeroImage] 📤 Attempting Firebase Storage upload...');
          
          // Extract base64 data
          const base64Data = result.image.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          
          const imageSizeKB = (buffer.length / 1024).toFixed(2);
          console.log('[GenerateHeroImage] 📏 Image size:', imageSizeKB, 'KB');
          
          // Warning if image is too large
          if (parseFloat(imageSizeKB) > 500) {
            console.warn('[GenerateHeroImage] ⚠️ Image larger than 500KB:', imageSizeKB, 'KB');
          }
          
          // Generate unique filename
          const filename = `ai-hero-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
          
          console.log('[GenerateHeroImage] 📁 Filename:', filename);
          
          // Upload to Firebase
          const { uploadToFirebase } = await import('@/lib/uploadToFirebase');
          console.log('[GenerateHeroImage] 🔄 Calling uploadToFirebase...');
          
          const uploadResult = await uploadToFirebase(buffer, filename, 'image/png');
          
          console.log('[GenerateHeroImage] 📤 Upload result:', {
            success: uploadResult.success,
            hasUrl: !!uploadResult.url,
            error: uploadResult.error
          });
          
          if (uploadResult.success && uploadResult.url) {
            finalImageUrl = uploadResult.url;
            console.log('[GenerateHeroImage] ✅ Successfully uploaded to Firebase!');
            console.log('[GenerateHeroImage] 🔗 CDN URL:', uploadResult.url);
          } else {
            console.error('[GenerateHeroImage] ❌ Firebase upload failed:', uploadResult.error || 'Unknown error');
            console.log('[GenerateHeroImage] ⚠️ Falling back to base64');
          }
        } else {
          console.log('[GenerateHeroImage] ℹ️ Image is not base64, skipping upload');
        }
      } catch (uploadError: any) {
        console.error('[GenerateHeroImage] ❌ Upload exception:', {
          message: uploadError.message,
          stack: uploadError.stack?.split('\n').slice(0, 3).join('\n')
        });
        console.log('[GenerateHeroImage] ⚠️ Continuing with base64 due to error');
        // Continue with base64 if upload fails
      }

      // Success response
      return NextResponse.json({
        success: true,
        imageUrl: finalImageUrl,
        prompt: positivePrompt,
        source: 'ai-generated',
        license: 'generated',
        featuresApplied: result.featuresApplied
      });
      
    } catch (sdxlError: any) {
      console.log('[GenerateHeroImage] SDXL API error:', sdxlError.message);
      return NextResponse.json(
        { success: false, error: 'ai_generation_failed' },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error('[GenerateHeroImage] Request error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process request' 
      },
      { status: 500 }
    );
  }
}
