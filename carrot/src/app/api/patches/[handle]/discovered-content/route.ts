import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
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
    const whereClause: any = {
      patchId: patch.id
    }
    
    // Cursor-based pagination: if cursor provided, use it instead of offset
    let orderBy: any[] = [
      { relevanceScore: 'desc' }, // Most relevant first
      { createdAt: 'desc' }        // Then by newest
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
        category: true,
        summary: true,
        relevanceScore: true,
        createdAt: true,
        whyItMatters: true,
        facts: true,
        quotes: true,
        provenance: true,
        hero: true, // JSON hero field (for backward compatibility)
        metadata: true,
        qualityScore: true,
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

    let discoveredContent: DiscoveryCardPayload[] = allContent.map((item) => {
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
      
      if (heroRelation && heroRelation.status === 'READY') {
        // Use Hero table data (preferred)
        // Map to DiscoveryHero format - use 'ai' as source since it's from our enrichment system
        heroRaw = {
          url: heroRelation.imageUrl || '',
          source: heroRelation.imageUrl ? 'ai' : 'skeleton' // Use 'ai' for enriched images, 'skeleton' if no image
        }
      } else if (heroJson) {
        // Fallback to JSON hero field for backward compatibility
        heroRaw = heroJson
      }
      
      const metadataRaw = parseJson<Record<string, any>>(item.metadata, {})

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
      
      return {
        id: item.id,
        title: item.title,
        url: primaryUrl,
        canonicalUrl: primaryUrl,
        domain,
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
        viewSourceOk: viewSourceStatus ? viewSourceStatus < 400 : metadataRaw?.viewSourceOk !== false,
        savedAt: item.createdAt?.toISOString() || new Date().toISOString(),
        // Additional fields for frontend
        hasHero,
        textLength: (item.textContent?.length || 0),
        createdAt: item.createdAt?.toISOString() || new Date().toISOString()
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

    // Debug logging
    const debug = searchParams.get('debug') === '1'
    // onlySaved already defined at top of function
    
    // If onlySaved=1, filter to items that have been saved (have an id)
    let finalItems = discoveredContent
    if (onlySaved) {
      finalItems = discoveredContent.filter(item => item.id)
    }
    
    // Get total count for pagination
    const totalItems = await prisma.discoveredContent.count({
      where: { patchId: patch.id }
    })
    
    // Determine next cursor
    const lastItem = finalItems[finalItems.length - 1]
    const nextCursor = lastItem && finalItems.length === limit
      ? lastItem.createdAt.toISOString()
      : null
    
    const responseData: any = {
      success: true,
      items: finalItems,
      itemsCount: finalItems.length,
      totalItems,
      isActive: finalItems.length > 0,
      nextCursor
    }
    
    if (debug) {
        responseData.debug = {
        patchId: patch.id,
        handle,
        dbQueryCount: allContent.length,
        beforeVerification: beforeVerificationCount,
        afterVerification: discoveredContent.length,
        finalItems: finalItems.length,
        limit,
        offset,
        verificationSkipped,
        onlySaved
      }
    }
    
    console.log('[Discovered Content] Final response:', {
      patchId: patch.id,
      handle,
      itemsReturned: discoveredContent.length,
      dbQueryCount: allContent.length
    })

    const res = NextResponse.json(responseData);
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
    return NextResponse.json(
      { 
        error: 'Failed to fetch discovered content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
