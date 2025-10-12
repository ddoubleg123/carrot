import { NextRequest, NextResponse } from 'next/server'

interface GenerateHeroImageRequest {
  title: string
  summary: string
  sourceDomain?: string
  contentType?: string
  patchTheme?: string // e.g., 'Chicago Bulls', 'Politics', etc.
}

export async function POST(request: NextRequest) {
  try {
    const { title, summary, sourceDomain, contentType = 'article', patchTheme }: GenerateHeroImageRequest = await request.json()

    if (!title || !summary) {
      return NextResponse.json({ error: 'Title and summary are required' }, { status: 400 })
    }

    console.log('[GenerateHeroImage] Generating AI image for:', { title: title.substring(0, 50), sourceDomain, patchTheme })

    // Create a detailed prompt for DeepSeek Vision
    const prompt = createImagePrompt(title, summary, sourceDomain, contentType, patchTheme)
    
    // Call DeepSeek Vision API
    const imageUrl = await generateImageWithDeepSeek(prompt)
    
    if (!imageUrl) {
      throw new Error('Failed to generate image with DeepSeek')
    }

    console.log('[GenerateHeroImage] Successfully generated image:', imageUrl.substring(0, 50))

    return NextResponse.json({
      success: true,
      imageUrl,
      source: 'ai-generated',
      license: 'generated',
      prompt: prompt.substring(0, 100) + '...'
    })

  } catch (error) {
    console.error('[GenerateHeroImage] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
}

function createImagePrompt(title: string, summary: string, sourceDomain?: string, contentType?: string, patchTheme?: string): string {
  // Base prompt for high-quality hero images
  let prompt = `Create a professional, high-quality hero image for a web article. `
  
  // Add context based on content type
  if (contentType === 'article') {
    prompt += `Style: Modern, clean, editorial design. `
  } else if (contentType === 'video') {
    prompt += `Style: Dynamic, engaging, video thumbnail design. `
  } else if (contentType === 'pdf') {
    prompt += `Style: Professional, document-focused design. `
  }

  // Add patch theme context for better relevance
  if (patchTheme) {
    if (patchTheme.toLowerCase().includes('bulls') || patchTheme.toLowerCase().includes('basketball')) {
      prompt += `Theme: Chicago Bulls basketball, red and black colors, sports atmosphere. `
    } else if (patchTheme.toLowerCase().includes('politics') || patchTheme.toLowerCase().includes('political')) {
      prompt += `Theme: Political, government, civic engagement, professional tone. `
    } else if (patchTheme.toLowerCase().includes('sports')) {
      prompt += `Theme: Sports, athletic, dynamic, energetic. `
    }
  }

  // Add source domain context
  if (sourceDomain) {
    if (sourceDomain.includes('espn')) {
      prompt += `Style: ESPN sports journalism, bold, athletic. `
    } else if (sourceDomain.includes('politico') || sourceDomain.includes('thehill')) {
      prompt += `Style: Political journalism, authoritative, news-focused. `
    } else if (sourceDomain.includes('theathletic')) {
      prompt += `Style: Sports journalism, premium, detailed. `
    } else if (sourceDomain.includes('cnn') || sourceDomain.includes('bbc')) {
      prompt += `Style: News journalism, professional, informative. `
    }
  }

  // Add content-specific details
  prompt += `Content context: "${title}". `
  
  // Extract key themes from summary for better image relevance
  const summaryWords = summary.toLowerCase().split(' ')
  const keyTerms = summaryWords.filter(word => 
    word.length > 4 && 
    !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'will', 'said', 'could', 'would'].includes(word)
  ).slice(0, 5)
  
  if (keyTerms.length > 0) {
    prompt += `Key themes: ${keyTerms.join(', ')}. `
  }

  // Final specifications
  prompt += `Requirements: 1280x720 aspect ratio, high resolution, professional quality, suitable for web hero image, no text overlays, clean composition.`

  return prompt
}

async function generateImageWithDeepSeek(prompt: string): Promise<string | null> {
  try {
    // Note: This is a placeholder implementation
    // You'll need to integrate with DeepSeek's actual image generation API
    // For now, we'll return a placeholder that indicates AI generation
    
    console.log('[GenerateHeroImage] DeepSeek prompt:', prompt.substring(0, 200) + '...')
    
    // TODO: Replace with actual DeepSeek Vision API call
    // const response = await fetch('https://api.deepseek.com/v1/images/generations', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     model: 'deepseek-vision',
    //     prompt: prompt,
    //     size: '1280x720',
    //     quality: 'hd',
    //     n: 1
    //   })
    // })
    
    // For now, return a data URI that indicates AI generation
    // This will be replaced with actual DeepSeek API integration
    const placeholderSvg = createAIPlaceholderSvg()
    return placeholderSvg
    
  } catch (error) {
    console.error('[GenerateHeroImage] DeepSeek API error:', error)
    return null
  }
}

function createAIPlaceholderSvg(): string {
  // Create a more sophisticated placeholder that indicates AI generation
  const svg = `
    <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#764ba2;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#f093fb;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#aiGradient)"/>
      <g transform="translate(640,360)">
        <circle cx="0" cy="-30" r="40" fill="white" opacity="0.9"/>
        <circle cx="-25" cy="0" r="35" fill="white" opacity="0.8"/>
        <circle cx="25" cy="0" r="35" fill="white" opacity="0.8"/>
        <circle cx="0" cy="30" r="40" fill="white" opacity="0.9"/>
        <text x="0" y="100" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold" opacity="0.9">
          AI Generated
        </text>
        <text x="0" y="130" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" opacity="0.7">
          Custom Hero Image
        </text>
      </g>
    </svg>
  `
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
