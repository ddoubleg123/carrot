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

// Simplified sanitization and name extraction (as per task requirements)
function sanitizeText(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function extractNames(title: string, summary: string): string[] {
  const pattern = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;
  const matches = [...title.matchAll(pattern), ...summary.matchAll(pattern)];
  return Array.from(new Set(matches.map((m) => m[1])));
}

export async function POST(request: NextRequest) {
  try {
    const reqBody: GenerateHeroImageRequest = await request.json();
    
    // Extract fields safely
    const { 
      title = "", 
      summary = "", 
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

    // Sanitize inputs
    const cleanTitle = sanitizeText(title);
    const cleanSummary = sanitizeText(summary);
    
    // Extract names from title and summary
    const names = extractNames(cleanTitle, cleanSummary);
    const subjectPhrase = names.length > 0 ? names.join(" and ") : "the subject";

    // Build the prompt safely - preserve user text and avoid duplication
    // Check if summary already contains the subject name to avoid repetition
    const summaryContainsSubject = names.some(name => 
      cleanSummary.toLowerCase().includes(name.toLowerCase())
    );
    
    // If summary already has the subject, use it as-is; otherwise prepend subject
    const positivePrompt = summaryContainsSubject 
      ? `${cleanSummary}, professional quality, dynamic composition, natural light, realistic depth and shadow, ${artisticStyle}, 8K detail, perfect composition, rule of thirds`
      : `${subjectPhrase} — ${cleanSummary}, professional quality, dynamic composition, natural light, realistic depth and shadow, ${artisticStyle}, 8K detail, perfect composition, rule of thirds`;
    
    const negativePrompt = "lowres, blurry, pixelated, duplicate people, text artifacts, visible words, legible text, cartoon, anime, sketch, oversaturated";

    // Log final configuration for debugging
    console.log("[GenerateHeroImage] Config:", {
      enableHiresFix,
      positivePrompt: positivePrompt.substring(0, 150) + '...',
      names,
      subjectPhrase,
      artisticStyle
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

      // Handle safety filter blocking (if image generation returns null/empty)
      if (!result.image) {
        return NextResponse.json(
          {
            error: "This image can't be generated because it violates content safety rules (hate, violence, or explicit imagery).",
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
      // Handle safety-related errors
      if (err.message?.toLowerCase().includes("safety") || 
          err.message?.toLowerCase().includes("inappropriate") ||
          err.message?.toLowerCase().includes("violates")) {
        return NextResponse.json(
          {
            error: "This image can't be generated because it violates content safety rules (hate, violence, or explicit imagery).",
          },
          { status: 400 }
        );
      }
      
      // Log unexpected errors
      console.error("Image generation failed:", err);
      return NextResponse.json(
        { error: "Unexpected generation error." },
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
