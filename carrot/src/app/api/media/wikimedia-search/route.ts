/**
 * Wikimedia Commons Search API
 * Searches for images related to Chicago Bulls content
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 5 } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }
    
    console.log(`[WikimediaSearch] Searching for: ${query}`)
    
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
    
    // Process search results
    const images = data.query.search.map((result: any) => {
      const title = result.title
      const snippet = result.snippet
      
      // Extract image URL (thumbnail)
      const thumbnailMatch = snippet.match(/src="([^"]+)"/)
      const thumbnailUrl = thumbnailMatch ? thumbnailMatch[1] : null
      
      // Construct full image URL
      const imageUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replace('File:', ''))}`
      
      return {
        title: title.replace('File:', ''),
        url: imageUrl,
        thumbnail: thumbnailUrl,
        snippet: snippet.replace(/<[^>]+>/g, '').substring(0, 200)
      }
    }).filter((img: any) => img.thumbnail) // Only include images with thumbnails
    
    console.log(`[WikimediaSearch] Found ${images.length} images for: ${query}`)
    
    return NextResponse.json({ images })
    
  } catch (error) {
    console.error('[WikimediaSearch] Error:', error)
    return NextResponse.json(
      { error: 'Failed to search Wikimedia' },
      { status: 500 }
    )
  }
}
