import { NextRequest, NextResponse } from 'next/server'
import { canonicalizeUrl } from '@/lib/canonicalize'
import { fetchWithProxy } from '@/lib/fetchProxy'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
  }

  const canonical = canonicalizeUrl(url)

  try {
    // Try HEAD request first
    let response = await fetchWithProxy(canonical, {
      method: 'HEAD',
      timeout: 5000,
      userAgent: 'Mozilla/5.0 (compatible; CarrotLinkVerifier/1.0)'
    })

    // If HEAD not allowed, try GET
    if (!response.ok && response.status === 405) {
      response = await fetchWithProxy(canonical, {
        method: 'GET',
        timeout: 5000,
        userAgent: 'Mozilla/5.0 (compatible; CarrotLinkVerifier/1.0)'
      })
      
      // Consume body to prevent hanging
      if (response.body) {
        await response.text()
      }
    }

    const result = {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      checkedAt: new Date().toISOString()
    }

    // If link is broken, try to get archive URL
    if (!response.ok && response.status >= 400) {
      // Request archive (fire-and-forget)
      fetch(`https://web.archive.org/save/${encodeURIComponent(canonical)}`, { 
        method: 'GET' 
      }).catch(e => console.warn('Archive request failed:', e))
      
      return NextResponse.json({
        ...result,
        archiveUrl: `https://web.archive.org/web/*/${encodeURIComponent(canonical)}`
      })
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error(`[LinkVerify] Error verifying ${url}:`, error)
    
    // Request archive for failed links
    fetch(`https://web.archive.org/save/${encodeURIComponent(canonical)}`, { 
      method: 'GET' 
    }).catch(e => console.warn('Archive request failed:', e))
    
    return NextResponse.json({
      ok: false,
      status: 500,
      finalUrl: canonical,
      checkedAt: new Date().toISOString(),
      archiveUrl: `https://web.archive.org/web/*/${encodeURIComponent(canonical)}`
    })
  }
}