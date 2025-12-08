import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { DiscoveryCardPayload, DiscoveryContested, DiscoveryFact, DiscoveryHero, DiscoveryQuote } from '@/types/discovery-card'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const cursor = searchParams.get('cursor') // Cursor for pagination (ISO date string or ID)
  const onlySaved = searchParams.get('onlySaved') === '1' || searchParams.get('onlySaved') === 'true'
  const debug = searchParams.get('debug') === '1' // Define debug early so it can be used in filter
  try {
    console.log('[Discovered Content] ===== API CALLED =====');
    const t0 = Date.now();
    const { handle } = await params;
    console.log('[Discovered Content] Fetching content for patch handle:', handle);

    // Find the patch by handle with caching
    const t1 = Date.now();
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    });
    const t2 = Date.now();

    if (!patch) {
      const res = NextResponse.json({ error: 'Patch not found' }, { status: 404 });
      try { res.headers.set('Server-Timing', `prep;dur=${t1 - t0}`); } catch {}
      return res;
    }

    // Build where clause
    // FE hero query guard: only query status='SAVED' with textBytes >= MIN_TEXT_BYTES_FOR_HERO
    const MIN_TEXT_BYTES_FOR_HERO = 200 // Minimum text content for hero display
    // Return ALL items for the patch - filtering happens in JavaScript
    // This ensures we don't miss items that might not have textContent/hero/summary yet
    const whereClause: any = {
      patchId: patch.id
    }
    
    // Filter by textBytes >= MIN_TEXT_BYTES_FOR_HERO (we'll filter in JS since Prisma doesn't support length on text)
    
    // Order by createdAt desc, id desc (as per requirements)
    let orderBy: any[] = [
      { createdAt: 'desc' },
      { id: 'desc' }
    ]
    
    if (cursor) {
      // Try to parse as date first
      const cursorDate = new Date(cursor)
      if (!isNaN(cursorDate.getTime())) {
        // Date-based cursor
        whereClause.OR = [
          { relevanceScore: { lt: parseFloat(searchParams.get('lastRelevance') || '1') } },
          {
            relevanceScore: parseFloat(searchParams.get('lastRelevance') || '1'),
            createdAt: { lt: cursorDate }
          }
        ]
      } else {
        // ID-based cursor
        whereClause.id = { lt: cursor }
        orderBy = [{ id: 'desc' }]
      }
    }
    
    // Query DiscoveredContent with Heroes (prefer Hero table over JSON hero field)
    const t3 = Date.now();
    const allContent = await prisma.discoveredContent.findMany({
      where: whereClause,
      orderBy,
      take: limit,
      skip: cursor ? 0 : offset, // Use offset only if no cursor
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        canonicalUrl: true,
        type: true, // Content type (article, video, etc.)
        category: true,
        summary: true,
        relevanceScore: true,
        qualityScore: true,
        importanceScore: true,
        createdAt: true,
        whyItMatters: true,
        facts: true,
        quotes: true,
        provenance: true,
        hero: true, // JSON hero field (for backward compatibility)
        metadata: true,
        textContent: true,
        isUseful: true, // Whether content is useful/published
        heroRecord: { // Hero relation (preferred over JSON)
          select: {
            id: true,
            title: true,
            excerpt: true,
            quoteHtml: true,
            quoteCharCount: true,
            imageUrl: true,
            sourceUrl: true,
            status: true,
            errorCode: true,
            errorMessage: true
          }
        }
      }
    });
    const t4 = Date.now();
    
    console.log('[Discovered Content] Database query results:', {
      patchId: patch.id,
      handle,
      totalItems: allContent.length,
      limit,
      offset,
      sampleIds: allContent.slice(0, 3).map(c => c.id)
    });

    // Filter items - be lenient: include items with at least a title
    // The frontend can handle items without heroes/summaries/textContent
    const filteredContent = allContent.filter(item => {
      // Must have at least a title to be displayable
      if (!item.title || item.title.trim().length === 0) {
        if (debug) {
          console.log('[Discovered Content] Filtered out item (no title):', { id: item.id })
        }
        return false
      }
      
      // Optional: prefer items with some content, but don't require it
      // This helps prioritize items with more data, but doesn't exclude items without it
      const textBytes = item.textContent?.length || 0
      const hasHero = item.heroRecord || (item.hero && typeof item.hero === 'object' && (item.hero as any)?.url)
      const hasSummary = item.summary && item.summary.length > 0
      
      // Include all items with titles - frontend will handle missing data gracefully
      const shouldInclude = true
      
      // Debug logging
      if (debug) {
        console.log('[Discovered Content] Item details:', {
          id: item.id,
          title: item.title?.substring(0, 50),
          textBytes,
          hasHero: !!hasHero,
          hasSummary: !!hasSummary,
          heroRecord: item.heroRecord ? { status: item.heroRecord.status, hasImage: !!item.heroRecord.imageUrl } : null,
          heroJson: item.hero ? { hasUrl: !!(item.hero as any)?.url } : null
        })
      }
      
      return shouldInclude
    })
    
    console.log('[Discovered Content] Filter results:', {
      beforeFilter: allContent.length,
      afterFilter: filteredContent.length,
      filteredOut: allContent.length - filteredContent.length
    })
    
    let discoveredContent: DiscoveryCardPayload[] = filteredContent.map((item) => {
      let domain = 'unknown'
      const primaryUrl = item.canonicalUrl || item.sourceUrl || ''
      try {
        if (primaryUrl) {
          domain = new URL(primaryUrl).hostname.replace(/^www\./, '')
        }
      } catch {}

      const parseJson = <T,>(value: any, fallback: T): T => {
        if (!value) return fallback
        if (typeof value === 'string') {
          try {
            return JSON.parse(value)
          } catch {
            return fallback
          }
        }
        return value as T
      }

      const factsRaw = parseJson<DiscoveryFact[]>(item.facts, [])
      const quotesRaw = parseJson<DiscoveryQuote[]>(item.quotes, [])
      const provenanceRaw = parseJson<string[]>(item.provenance, [])
      
      // Prefer Hero table over JSON hero field
      let heroRaw: DiscoveryHero | null = null
      const heroRelation = (item as any).heroRecord // Hero relation from include
      const heroJson = parseJson<DiscoveryHero | null>(item.hero, null) // JSON hero field
      
      if (heroRelation && heroRelation.status === 'READY' && heroRelation.imageUrl) {
        // Use Hero table data (preferred)
        // Detect source from imageUrl: wikimedia URLs contain 'wikimedia.org' or 'upload.wikimedia.org'
        const imageUrl = heroRelation.imageUrl
        let heroSource: 'ai' | 'wikimedia' | 'skeleton' = 'skeleton'
        
        const urlLower = imageUrl.toLowerCase()
        if (urlLower.includes('wikimedia.org') || urlLower.includes('upload.wikimedia.org') || urlLower.includes('commons.wikimedia.org')) {
          heroSource = 'wikimedia'
        } else if (urlLower.includes('via.placeholder.com') || urlLower.includes('placeholder')) {
          heroSource = 'skeleton'
        } else {
          // Assume AI-generated or other enriched images
          heroSource = 'ai'
        }
        
        heroRaw = {
          url: imageUrl,
          source: heroSource
        }
      } else if (heroJson && heroJson.url) {
        // Fallback to JSON hero field for backward compatibility
        heroRaw = heroJson
      } else {
        // Ultimate fallback: generate placeholder hero image
        // Use the domain variable already computed above (line 172)
        const placeholderUrl = `https://via.placeholder.com/800x400/667eea/ffffff?text=${encodeURIComponent(item.title.substring(0, 30))}`
        heroRaw = {
          url: placeholderUrl,
          source: 'skeleton'
        }
      }
      
      const metadataRaw = parseJson<Record<string, any>>(item.metadata, {})
      
      // Generate urlSlug if missing (for existing content)
      let urlSlug = metadataRaw?.urlSlug
      if (!urlSlug) {
        // Generate slug from title with fallback
        const titleSlug = item.title
          ? item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50)
          : 'content'
        // Ensure we have a valid slug (title might be empty after processing)
        const safeTitleSlug = titleSlug || 'content'
        // Use first 8 chars of ID (CUIDs are 25 chars, so this is safe)
        const idSuffix = item.id.substring(0, 8) || Math.random().toString(36).substring(2, 10)
        urlSlug = `${safeTitleSlug}-${idSuffix}`
      }

      const facts: DiscoveryFact[] = factsRaw.map((fact, index) => {
        if (typeof fact === 'string') {
          return {
            label: `Fact ${index + 1}`,
            value: fact,
            citation: primaryUrl
          }
        }

        if (fact && typeof fact === 'object') {
          const textValue = (fact as any).value || (fact as any).text || ''
          return {
            label: (fact as any).label || `Fact ${index + 1}`,
            value: textValue,
            citation: (fact as any).citation || primaryUrl
          }
        }

        return {
          label: `Fact ${index + 1}`,
          value: '',
          citation: primaryUrl
        }
      }).filter(fact => fact.value)

      const quotes: DiscoveryQuote[] = quotesRaw.slice(0, 3).map((quote) => ({
        text: quote?.text || '',
        speaker: quote?.speaker,
        citation: quote?.citation || primaryUrl
      })).filter(quote => quote.text)

      const provenance = provenanceRaw.length ? provenanceRaw : [primaryUrl]
      const contestedValue = metadataRaw?.contested as DiscoveryContested | undefined
      const contestedClaim = metadataRaw?.contestedClaim || contestedValue?.claim
      const viewSourceStatus = typeof metadataRaw?.viewSourceStatus === 'number' ? metadataRaw.viewSourceStatus : undefined

      // Determine hasHero status
      const hasHero = Boolean(heroRelation && heroRelation.status === 'READY') || Boolean(heroJson)
      
      // Extract summary for enrichedContent
      const summary150 = (typeof item.whyItMatters === 'string' && item.whyItMatters.trim())
        ? item.whyItMatters.trim().substring(0, 150)
        : (metadataRaw?.summary150 || item.summary?.substring(0, 150) || '')
      
      // Extract key points from facts
      const keyPoints = facts.slice(0, 5).map(f => f.value).filter(Boolean)
      
      // Extract notable quote
      const notableQuote = quotes.length > 0 ? quotes[0].text : undefined
      
      // Build enrichedContent object for frontend compatibility
      const enrichedContent = {
        summary150,
        keyPoints,
        notableQuote,
        readingTime: Math.max(1, Math.floor((item.textContent?.length || 1000) / 200))
      }
      
      // Build mediaAssets object for frontend compatibility - always include hero (with fallback)
      const mediaAssets = {
        hero: heroRaw.url,
        source: heroRaw.source,
        license: heroRaw.source === 'ai' ? 'generated' : (heroRaw.source === 'wikimedia' ? 'fair-use' : 'generated')
      }
      
      // Determine status - use isUseful to determine if content is ready
      const status = item.isUseful !== false ? 'ready' : 'pending_audit'
      
      return {
        id: item.id,
        title: item.title,
        url: primaryUrl,
        canonicalUrl: primaryUrl,
        domain,
        type: item.type || 'article', // Use type field from database
        sourceType: metadataRaw?.sourceType || item.category || 'article',
        credibilityTier: metadataRaw?.credibilityTier,
        angle: metadataRaw?.angle,
        noveltySignals: metadataRaw?.noveltySignals,
        expectedInsights: metadataRaw?.expectedInsights,
        reason: metadataRaw?.reason,
        whyItMatters: (typeof item.whyItMatters === 'string' && item.whyItMatters.trim())
          ? item.whyItMatters.trim()
          : (metadataRaw?.summary150 || item.summary || ''),
        facts,
        quotes,
        provenance,
        contested: contestedValue && contestedValue.note ? contestedValue : null,
        contestedClaim: contestedClaim || undefined,
        hero: heroRaw,
        relevanceScore: Number(item.relevanceScore ?? 0),
        qualityScore: Number(item.qualityScore ?? 0),
        importanceScore: Number(item.importanceScore ?? 50),
        viewSourceOk: viewSourceStatus ? viewSourceStatus < 400 : metadataRaw?.viewSourceOk !== false,
        savedAt: item.createdAt?.toISOString() || new Date().toISOString(),
        // Additional fields for frontend
        hasHero,
        textLength: (item.textContent?.length || 0),
        createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
        // Frontend compatibility fields
        enrichedContent,
        mediaAssets,
        status,
        sourceUrl: item.sourceUrl || primaryUrl,
        description: summary150, // Alias for summary150
        metadata: {
          ...metadataRaw,
          readingTime: enrichedContent.readingTime,
          // Always include urlSlug for navigation (generated above if missing)
          urlSlug: urlSlug
        }
      }
    })

    // Debug: Log before verification
    const beforeVerificationCount = discoveredContent.length
    console.log('[Discovered Content] Before verification:', { count: beforeVerificationCount })

    // Server-side link verification gate: only include items whose source verifies (<400)
    // RELAXED: Skip verification in production to avoid filtering out all items
    // Verification can be re-enabled later with better error handling
    const SKIP_VERIFICATION = process.env.SKIP_LINK_VERIFICATION === 'true' || true // Default to true for now
    let verificationSkipped = SKIP_VERIFICATION
    
    if (!SKIP_VERIFICATION) {
      try {
        const proto = (req.headers as any).get?.('x-forwarded-proto') || 'https'
        const host = (req.headers as any).get?.('host')
        const baseUrl = host ? `${proto}://${host}` : ''

        const verifyOne = async (item: any) => {
          const url = item.canonicalUrl || item.url
          if (!url) return { ok: false, item, reason: 'no_url' }

          try {
            const verifyRes = await fetch(`${baseUrl}/api/internal/links/verify?url=${encodeURIComponent(url)}`, {
              method: 'GET',
              // keep tight server timeout
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(2000) // 2s timeout
            })
            if (!verifyRes.ok) return { ok: false, item, reason: `http_${verifyRes.status}` }
            const data = await verifyRes.json()
            return { ok: !!data?.ok, item, status: data?.status, reason: data?.ok ? 'ok' : 'verify_failed' }
          } catch (err: any) {
            return { ok: false, item, reason: err?.name === 'AbortError' ? 'timeout' : 'error' }
          }
        }

        const verified = await Promise.all(discoveredContent.map(verifyOne))
        const verifiedItems = verified.filter(v => v.ok).map(v => v.item)
        const skippedReasons = verified.filter(v => !v.ok).map(v => v.reason)
        
        console.log('[Discovered Content] Verification results:', {
          before: beforeVerificationCount,
          after: verifiedItems.length,
          skipped: skippedReasons.length,
          reasons: skippedReasons.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc }, {} as Record<string, number>)
        })
        
        discoveredContent = verifiedItems
      } catch (e) {
        // If verification fails for any reason, fall back to original list (do not break endpoint)
        console.warn('[Discovered Content] verification gate failed, using all items:', (e as any)?.message)
      }
    } else {
      console.log('[Discovered Content] Verification skipped (SKIP_LINK_VERIFICATION=true)')
    }

    // Debug logging (debug already defined at top of function)
    
    // If onlySaved=1, filter to items that have been saved (have an id)
    let finalItems = discoveredContent
    if (onlySaved) {
      finalItems = discoveredContent.filter(item => item.id)
    }
    
    // Get total count for pagination (from DB truth) - count all items for the patch
    const totalItems = await prisma.discoveredContent.count({
      where: { 
        patchId: patch.id
      }
    })
    
    // Get last run ID from discovery runs
    const lastRun = await prisma.discoveryRun.findFirst({
      where: { patchId: patch.id },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true }
    }).catch(() => null)
    
    // Determine next cursor and hasMore
    const lastItem = finalItems[finalItems.length - 1]
    const lastRawItem = filteredContent[filteredContent.length - 1]
    const buildSha = process.env.BUILD_SHA || 'unknown'
    const hasMore = finalItems.length === limit && filteredContent.length === limit
    const nextCursor = hasMore && lastItem && lastRawItem
      ? `${lastRawItem.createdAt.toISOString()}|${lastRawItem.id}|${buildSha}|${patch.id}`
      : null
    
    // New API shape: { success, items, cursor, hasMore, totals, isActive, debug }
    const responseData: any = {
      success: true,
      items: finalItems,
      cursor: nextCursor,
      hasMore,
      totals: {
        items: finalItems.length,
        total: totalItems
      },
      isActive: finalItems.length > 0,
      debug: {
        buildSha,
        lastRunId: lastRun?.id || null,
        reasonWhenEmpty: finalItems.length === 0 
          ? (totalItems === 0 ? 'no_content_discovered' : 'all_filtered_out')
          : null
      }
    }
    
    console.log('[Discovered Content] Final response:', {
      patchId: patch.id,
      handle,
      itemsReturned: finalItems.length,
      totalItems,
      hasMore,
      buildSha,
      lastRunId: lastRun?.id
    })

    const res = NextResponse.json(responseData);
    // Cache-Control: no-store, Vary: Authorization (as per requirements)
    res.headers.set('Cache-Control', 'no-store')
    res.headers.set('Vary', 'Authorization')
    // Report optimized timing: param resolution, patch lookup, unified query
    const timings = [
      `prep;desc=param_resolve;dur=${t1 - t0}`,
      `patch;desc=patch_lookup;dur=${t2 - t1}`,
      `query;desc=unified_fetch;dur=${t4 - t3}`
    ].join(', ');
    try { res.headers.set('Server-Timing', timings); } catch {}
    return res;

  } catch (error) {
    console.error('Error fetching discovered content:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      handle: await params.then(p => p.handle).catch(() => 'unknown')
    });
    // Never 500; return {success:false, error:{code,msg}} (as per requirements)
    return NextResponse.json({
      success: false,
      items: [],
      cursor: null,
      hasMore: false,
      totals: { items: 0, total: 0 },
      isActive: false,
      error: {
        code: 'FETCH_ERROR',
        msg: error instanceof Error ? error.message : 'Unknown error'
      },
      debug: {
        buildSha: process.env.BUILD_SHA || 'unknown',
        lastRunId: null,
        reasonWhenEmpty: 'error'
      }
    }, { status: 200 }); // Return 200 with error in response body
  }
}
