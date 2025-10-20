import { NextRequest, NextResponse } from 'next/server'

interface VerificationResult {
  ok: boolean
  finalUrl: string
  status: number
  archivedUrl?: string
  checkedAt: string
}

// Simple in-memory cache (in production, use Redis)
const verificationCache = new Map<string, VerificationResult>()

function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    
    // Remove UTM parameters
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
    utmParams.forEach(param => parsed.searchParams.delete(param))
    
    // Remove fragments
    parsed.hash = ''
    
    // Normalize host (remove www)
    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.substring(4)
    }
    
    return parsed.toString()
  } catch {
    return url
  }
}

async function verifyUrl(url: string): Promise<VerificationResult> {
  const canonicalUrl = canonicalizeUrl(url)
  const cacheKey = `link:verify:${Buffer.from(canonicalUrl).toString('base64')}`
  
  // Check cache first
  const cached = verificationCache.get(cacheKey)
  if (cached && Date.now() - new Date(cached.checkedAt).getTime() < 3600000) { // 1 hour
    return cached
  }
  
  try {
    // Try HEAD request first
    let response = await fetch(canonicalUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000)
    })
    
    // If HEAD fails or returns 405, try GET
    if (!response.ok && (response.status === 405 || response.status >= 500)) {
      response = await fetch(canonicalUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000)
      })
    }
    
    const result: VerificationResult = {
      ok: response.ok,
      finalUrl: response.url,
      status: response.status,
      checkedAt: new Date().toISOString()
    }
    
    // If status >= 400, try to archive it
    if (response.status >= 400) {
      try {
        // Fire-and-forget archive request
        fetch(`https://web.archive.org/save/${canonicalUrl}`, {
          method: 'POST',
          signal: AbortSignal.timeout(2000)
        }).catch(() => {}) // Ignore errors
        
        // Set archived URL (this is a best guess)
        result.archivedUrl = `https://web.archive.org/web/*/${canonicalUrl}`
      } catch {
        // Archive failed, continue without it
      }
    }
    
    // Cache the result
    verificationCache.set(cacheKey, result)
    
    return result
  } catch (error) {
    const result: VerificationResult = {
      ok: false,
      finalUrl: canonicalUrl,
      status: 0,
      checkedAt: new Date().toISOString()
    }
    
    // Cache the error result for shorter time
    verificationCache.set(cacheKey, result)
    
    return result
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
  }
  
  try {
    const result = await verifyUrl(url)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Link verification error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
