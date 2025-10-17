import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { prompt, steps = 20, width = 1280, height = 720 } = await request.json()

    // Create a simple SVG placeholder that matches the expected format
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#764ba2;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f093fb;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)"/>
        <text x="50%" y="45%" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="28" font-weight="bold">
          🎨 AI Generated
        </text>
        <text x="50%" y="55%" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18">
          ${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}
        </text>
        <text x="50%" y="70%" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" opacity="0.8">
          Powered by Vast.ai RTX 5070
        </text>
      </svg>
    `

    // Convert SVG to base64
    const base64Svg = Buffer.from(svg).toString('base64')
    const dataUrl = `data:image/svg+xml;base64,${base64Svg}`

    return NextResponse.json({
      images: [dataUrl],
      info: {
        seed: Math.floor(Math.random() * 1000000),
        model: "stable-diffusion-v1-5-mock"
      }
    })

  } catch (error) {
    console.error('[TestVastAPI] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
}
