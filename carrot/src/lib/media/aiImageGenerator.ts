interface GenerateAIImageRequest {
  title: string
  summary: string
  sourceDomain?: string
  contentType?: string
  patchTheme?: string
}

interface AIImageResult {
  success: boolean
  imageUrl?: string
  error?: string
}

export async function generateAIImage({
  title,
  summary,
  sourceDomain,
  contentType = 'article',
  patchTheme
}: GenerateAIImageRequest): Promise<AIImageResult> {
  try {
    console.log('[AI Image Generator] Generating image for:', { title: title.substring(0, 50), sourceDomain, patchTheme })

    // Create a detailed prompt for DeepSeek Vision
    const prompt = createImagePrompt(title, summary, sourceDomain, contentType, patchTheme)
    
    // Call DeepSeek Vision API
    const imageUrl = await generateImageWithDeepSeek(prompt)
    
    if (!imageUrl) {
      throw new Error('Failed to generate image with DeepSeek')
    }

    console.log('[AI Image Generator] Successfully generated image:', imageUrl.substring(0, 50))

    return {
      success: true,
      imageUrl
    }

  } catch (error) {
    console.error('[AI Image Generator] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate image'
    }
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
      prompt += `Theme: Chicago Bulls basketball, red and black colors, sports atmosphere, United Center arena. `
    } else if (patchTheme.toLowerCase().includes('politics') || patchTheme.toLowerCase().includes('political')) {
      prompt += `Theme: Political, government, civic engagement, professional tone, Washington DC elements. `
    } else if (patchTheme.toLowerCase().includes('sports')) {
      prompt += `Theme: Sports, athletic, dynamic, energetic, competition. `
    }
  }

  // Add source domain context
  if (sourceDomain) {
    if (sourceDomain.includes('espn')) {
      prompt += `Style: ESPN sports journalism, bold, athletic, red and black branding. `
    } else if (sourceDomain.includes('politico') || sourceDomain.includes('thehill')) {
      prompt += `Style: Political journalism, authoritative, news-focused, blue and white tones. `
    } else if (sourceDomain.includes('theathletic')) {
      prompt += `Style: Sports journalism, premium, detailed, professional sports photography. `
    } else if (sourceDomain.includes('cnn') || sourceDomain.includes('bbc')) {
      prompt += `Style: News journalism, professional, informative, trustworthy. `
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
  prompt += `Requirements: 1280x720 aspect ratio, high resolution, professional quality, suitable for web hero image, no text overlays, clean composition, visually striking.`

  return prompt
}

async function generateImageWithDeepSeek(prompt: string): Promise<string | null> {
  try {
    console.log('[AI Image Generator] DeepSeek Janus Pro prompt:', prompt.substring(0, 200) + '...')
    
    // Check if we have a DeepSeek API key
    if (!process.env.DEEPSEEK_API_KEY) {
      console.warn('[AI Image Generator] No DeepSeek API key found, using placeholder')
      return createAIPlaceholderSvg()
    }
    
    // Use DeepSeek Janus Pro for image generation
    const response = await fetch('https://api.deepseek.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'janus-pro-1b', // Use Janus Pro 1B model for faster generation
        prompt: prompt,
        size: '1280x720',
        quality: 'hd',
        style: 'professional',
        aspect_ratio: '16:9',
        num_images: 1
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[AI Image Generator] DeepSeek API error:', response.status, errorText)
      return createAIPlaceholderSvg()
    }
    
    const data = await response.json()
    
    if (data.data && data.data[0] && data.data[0].url) {
      console.log('[AI Image Generator] Successfully generated image with Janus Pro')
      return data.data[0].url
    }
    
    console.warn('[AI Image Generator] No image URL in response, using placeholder')
    return createAIPlaceholderSvg()
    
  } catch (error) {
    console.error('[AI Image Generator] DeepSeek API error:', error)
    return createAIPlaceholderSvg()
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
        <pattern id="aiPattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <circle cx="50" cy="50" r="2" fill="white" opacity="0.1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#aiGradient)"/>
      <rect width="100%" height="100%" fill="url(#aiPattern)"/>
      <g transform="translate(640,360)">
        <g opacity="0.9">
          <circle cx="-40" cy="-20" r="25" fill="white"/>
          <circle cx="40" cy="-20" r="25" fill="white"/>
          <circle cx="0" cy="20" r="30" fill="white"/>
          <circle cx="-60" cy="10" r="20" fill="white"/>
          <circle cx="60" cy="10" r="20" fill="white"/>
        </g>
        <text x="0" y="80" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="28" font-weight="bold" opacity="0.95">
          AI Generated
        </text>
        <text x="0" y="110" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18" opacity="0.8">
          Custom Hero Image
        </text>
        <text x="0" y="140" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" opacity="0.6">
          DeepSeek Vision
        </text>
      </g>
    </svg>
  `
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
