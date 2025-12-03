/**
 * API route to extract URLs from Wikipedia for testing
 * GET /api/test/extraction
 */

import { NextResponse } from 'next/server'
import { extractAllExternalUrls } from '@/lib/discovery/wikiUtils'

export async function GET() {
  try {
    // Fetch the Apartheid Wikipedia page
    const response = await fetch('https://en.wikipedia.org/wiki/Apartheid', {
      headers: {
        'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)'
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch Wikipedia page: ${response.status}` },
        { status: response.status }
      )
    }

    const html = await response.text()
    
    // Extract URLs
    const citations = extractAllExternalUrls(html, 'https://en.wikipedia.org/wiki/Apartheid')
    
    // Separate by type
    const wikipediaUrls = citations.filter(c => c.url.includes('wikipedia.org'))
    const externalUrls = citations.filter(c => !c.url.includes('wikipedia.org'))
    
    // Group by section
    const bySection = citations.reduce((acc, cit) => {
      const section = cit.context || 'Unknown'
      if (!acc[section]) acc[section] = []
      acc[section].push(cit)
      return acc
    }, {} as Record<string, typeof citations>)

    return NextResponse.json({
      success: true,
      total: citations.length,
      wikipedia: wikipediaUrls.length,
      external: externalUrls.length,
      sections: Object.keys(bySection).length,
      urls: citations,
      bySection,
      extractedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[Test Extraction] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract URLs' },
      { status: 500 }
    )
  }
}

