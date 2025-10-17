import { NextRequest, NextResponse } from 'next/server'
import { runPipeline } from '@/lib/pipeline'
import { sanitizeInputs } from '@/lib/prompt/sanitize'
import { buildPrompt } from '@/lib/prompt/build'

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

    // Use our new prompt system
    const sanitized = sanitizeInputs(title, summary);

    const promptResult = buildPrompt({
      s: sanitized,
      styleOverride: artisticStyle
    });

    const positivePrompt = promptResult.positive;
    const negativePrompt = promptResult.negative;

    // Log final configuration for debugging
    console.log("[GenerateHeroImage] Config:", {
      enableHiresFix,
      positivePrompt: positivePrompt.substring(0, 150) + '...',
      artisticStyle,
      sanitizedNames: sanitized.names,
      extractedHints: {
        action: sanitized.actionHint,
        location: sanitized.locationHint,
        crowd: sanitized.crowdHint
      }
    });

    console.log(`[AI Image Generator] HD Option: ${enableHiresFix ? "ON" : "OFF"}`);

    if (enableHiresFix) {
      console.log('[AI Image Generator] 🔧 Running Hires Fix pass...');
    } else {
      console.log('[AI Image Generator] ℹ️ Hires Fix skipped (HD = No)');
    }

    // Generate image using the real pipeline with safety-filter and HD logic
    try {
      const result = await runPipeline({
        positive: positivePrompt,
        negative: negativePrompt,
        seed: 12345, // or 'auto' for random
        enableRefiner: true,
        enableFaceRestore: true,
        enableUpscale: true,
        enableHiresFix: enableHiresFix,
        styleMode: artisticStyle
      });

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
      
    } catch (err: any) {
      // Log the actual error for debugging
      console.error("Image generation failed:", err);
      
      // Only return content safety error if DeepSeek actually said no
      if (err.message?.toLowerCase().includes("content safety") || 
          err.message?.toLowerCase().includes("violates content safety")) {
        return NextResponse.json(
          {
            error: "This image can't be generated because it violates content safety rules (hate, violence, or explicit imagery).",
          },
          { status: 400 }
        );
      }
      
      // For all other errors, return the actual error message
      return NextResponse.json(
        { error: err.message || "Image generation failed." },
        { status: 500 }
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
