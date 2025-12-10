/**
 * Wikimedia Commons Search API
 * Searches for images related to Chicago Bulls content
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Optional: Check for internal key (for server-to-server calls)
    // This endpoint is also accessible without auth for flexibility
    const internalKey = request.headers.get('x-internal-key')
    const isInternalCall = internalKey && internalKey === process.env.INTERNAL_API_KEY
    
    const { query, limit = 5 } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }
    
    console.log(`[WikimediaSearch] Searching for: ${query}${isInternalCall ? ' (internal)' : ''}`)
    
    // Search Wikimedia Commons API
    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php')
    searchUrl.searchParams.set('action', 'query')
    searchUrl.searchParams.set('format', 'json')
    searchUrl.searchParams.set('list', 'search')
    searchUrl.searchParams.set('srsearch', query)
    searchUrl.searchParams.set('srnamespace', '6') // File namespace
    searchUrl.searchParams.set('srlimit', limit.toString())
    searchUrl.searchParams.set('srprop', 'timestamp|snippet')
    
    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Wikimedia API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.query || !data.query.search) {
      return NextResponse.json({ images: [] })
    }
    
    // Process search results and get actual image URLs
    const images = await Promise.all(
      data.query.search.slice(0, limit).map(async (result: any) => {
        const title = result.title
        const snippet = result.snippet
        
        // Get actual image URL using imageinfo API
        try {
          const imageInfoUrl = new URL('https://commons.wikimedia.org/w/api.php')
          imageInfoUrl.searchParams.set('action', 'query')
          imageInfoUrl.searchParams.set('format', 'json')
          imageInfoUrl.searchParams.set('titles', title)
          imageInfoUrl.searchParams.set('prop', 'imageinfo')
          imageInfoUrl.searchParams.set('iiprop', 'url|thumburl')
          imageInfoUrl.searchParams.set('iiurlwidth', '800') // Request 800px width
          
          const imageInfoResponse = await fetch(imageInfoUrl.toString(), {
            headers: {
              'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
              'Accept': 'application/json'
            }
          })
          
          if (imageInfoResponse.ok) {
            const imageInfoData = await imageInfoResponse.json()
            const pages = imageInfoData.query?.pages
            if (pages) {
              const page = Object.values(pages)[0] as any
              const imageInfo = page?.imageinfo?.[0]
              if (imageInfo) {
                // Prefer thumburl (800px) if available, otherwise use full URL
                const imageUrl = imageInfo.thumburl || imageInfo.url
                return {
                  title: title.replace(/^File:/, ''),
                  url: imageUrl, // Actual image URL
                  thumbnail: imageInfo.thumburl || imageInfo.url,
                  snippet: snippet.replace(/<[^>]+>/g, '').substring(0, 200)
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[WikimediaSearch] Failed to get image info for ${title}:`, error)
        }
        
        // Fallback: extract from snippet or construct URL
        const thumbnailMatch = snippet.match(/src="([^"]+)"/)
        const thumbnailUrl = thumbnailMatch ? thumbnailMatch[1] : null
        
        // Construct direct image URL as last resort
        const imageTitle = title.replace(/^File:/, '')
        const directUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageTitle)}?width=800`
        
        return {
          title: imageTitle,
          url: thumbnailUrl || directUrl,
          thumbnail: thumbnailUrl || directUrl,
          snippet: snippet.replace(/<[^>]+>/g, '').substring(0, 200)
        }
      })
    )
    
    // Filter out any null results and ensure we have valid image URLs
    const validImages = images.filter((img: any) => img && img.url)
    
    console.log(`[WikimediaSearch] Found ${validImages.length} images for: ${query}`)
    
    return NextResponse.json({ images: validImages })
    
  } catch (error) {
    console.error('[WikimediaSearch] Error:', error)
    return NextResponse.json(
      { error: 'Failed to search Wikimedia' },
      { status: 500 }
    )
  }
}
