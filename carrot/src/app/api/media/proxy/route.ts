import { NextRequest, NextResponse } from 'next/server'

/**
 * Media proxy endpoint for optimizing images
 * Parameters: url, w (width), h (height), f (format), q (quality)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')
    const width = parseInt(searchParams.get('w') || '1280')
    const height = parseInt(searchParams.get('h') || '0')
    const format = searchParams.get('f') || 'webp'
    const quality = parseInt(searchParams.get('q') || '80')

    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    // Validate URL
    try {
      new URL(imageUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    console.log('[Media Proxy] Fetching:', imageUrl.substring(0, 50))

    // Fetch the original image with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0; +https://carrot.app/bot)'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status })
      }

      const imageBuffer = await response.arrayBuffer()
      const contentType = response.headers.get('content-type') || 'image/jpeg'

      // For now, return the original image
      // In production, this would use sharp or imgproxy for optimization
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000', // 1 year cache
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      })

    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json({ error: 'Request timeout' }, { status: 408 })
      }
      throw fetchError
    }

  } catch (error) {
    console.error('[Media Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
