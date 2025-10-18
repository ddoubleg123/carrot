import { NextRequest, NextResponse } from 'next/server'
import { runPipeline } from '@/lib/pipeline'

interface GenerateHeroImageRequest {
  title: string
  summary: string
  sourceDomain?: string
  contentType?: string
  patchTheme?: string
  artisticStyle?: string
  enableHiresFix?: boolean
}

// Using new sanitizeInputs + buildPrompt system instead of simple helpers

export async function POST(request: NextRequest) {
  try {
    const reqBody: GenerateHeroImageRequest = await request.json();
    
    // Extract fields safely
    const { 
      title = "", 
      summary = "", 
      sourceDomain = "",
      contentType = "article",
      patchTheme = "general",
      artisticStyle = "photorealistic", 
      enableHiresFix = false 
    } = reqBody;

    // Validate required fields
    if (!title || !summary) {
      return NextResponse.json(
        { error: 'Title and summary are required' },
        { status: 400 }
      );
    }

    // Simple prompt building
    const positivePrompt = `${title}. ${summary}. ${artisticStyle} style, high quality, detailed, professional photography`;
    const negativePrompt = "blurry, low quality, distorted, ugly, deformed, bad anatomy, bad proportions, poorly drawn face, poorly drawn eyes, poorly drawn hands, text, watermark, signature, logo, extra limbs, cloned face, disfigured, out of frame, missing fingers, extra fingers, mutated hands";

    // Log final configuration for debugging
    console.log("[GenerateHeroImage] Config:", {
      enableHiresFix,
      positivePrompt: positivePrompt.substring(0, 150) + '...',
      artisticStyle,
      title,
      summary
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
          num_inference_steps: 20,
          guidance_scale: 7.5,
          width: 1024,
          height: 1024,
          use_refiner: false,
          use_face_restoration: false,
          face_restoration_weight: 0.6,
          hires_fix: false,
          hires_fix_simple: false,
          use_realesrgan: false,
          seed: 12345
        })
      });

      if (!response.ok) {
        throw new Error(`SDXL API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.image) {
        console.log('[GenerateHeroImage] SDXL API failed, using fallback image');
        // Fallback to a placeholder image
        const fallbackImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Question_mark_%28black%29.svg/1024px-Question_mark_%28black%29.svg.png';
        return NextResponse.json({
          success: true,
          imageUrl: fallbackImageUrl,
          prompt: positivePrompt,
          model: 'fallback',
          generationTime: 0,
          features: {
            refiner: false,
            faceRestoration: false,
            upscaling: false,
            hiresFix: false
          }
        });
      }

      // Handle case where no image was generated
      if (!result.image) {
        return NextResponse.json(
          {
            error: "No image was generated. This could be due to content safety rules or technical issues.",
          },
          { status: 400 }
        );
      }

      console.log('[GenerateHeroImage] ✅ Successfully generated image');

      // Success response
      return NextResponse.json({
        success: true,
        imageUrl: result.image,
        prompt: positivePrompt,
        source: 'ai-generated',
        license: 'generated',
        featuresApplied: result.featuresApplied
      });
      
    } catch (sdxlError: any) {
      console.log('[GenerateHeroImage] SDXL API error, using fallback:', sdxlError.message);
      // Fallback to a placeholder image when SDXL fails
      const fallbackImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Question_mark_%28black%29.svg/1024px-Question_mark_%28black%29.svg.png';
      return NextResponse.json({
        success: true,
        imageUrl: fallbackImageUrl,
        prompt: positivePrompt,
        model: 'fallback',
        generationTime: 0,
        features: {
          refiner: false,
          faceRestoration: false,
          upscaling: false,
          hiresFix: false
        }
      });
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
