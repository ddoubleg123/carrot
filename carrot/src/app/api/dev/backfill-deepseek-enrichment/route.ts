import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { enrichContentWithDeepSeek } from '@/lib/summarize/enrichContent'
import { fetchWithProxy } from '@/lib/fetchProxy'
import { extractReadableContent } from '@/lib/readability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Backfill DeepSeek enrichment for content
 * POST /api/dev/backfill-deepseek-enrichment
 * Body: { patchHandle?: string, limit?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const patchHandle = body.patchHandle || 'israel'
    const limit = body.limit || 18

    console.log(`\n🤖 DeepSeek Enrichment Backfill for Patch: ${patchHandle}\n`)

    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle },
      select: { id: true, title: true, handle: true, tags: true }
    })

    if (!patch) {
      return NextResponse.json(
        { error: `Patch "${patchHandle}" not found` },
        { status: 404 }
      )
    }

    console.log(`✅ Found patch: ${patch.title} (${patch.handle})\n`)

    // Get all content for this patch
    const allContent = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        summary: true,
        facts: true,
        metadata: true,
        whyItMatters: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    console.log(`📊 Found ${allContent.length} content items to process\n`)

    let successCount = 0
    let failCount = 0
    let skipCount = 0
    const results: any[] = []
    const errors: any[] = []

    for (let i = 0; i < allContent.length; i++) {
      const content = allContent[i]
      const progress = `[${i + 1}/${allContent.length}]`
      
      console.log(`\n${progress} Processing: ${content.title.substring(0, 60)}...`)

      try {
        // Check if already enriched
        const metadata = (content.metadata as any) || {}
        if (metadata.aiEnriched === true && metadata.enrichedAt) {
          console.log(`   ⏭️  Already enriched, skipping`)
          skipCount++
          results.push({ id: content.id, status: 'skipped', reason: 'already_enriched' })
          continue
        }

        // Get article text
        let articleText = typeof metadata.rawText === 'string' ? metadata.rawText : ''

        // If we don't have article text, fetch it
        if (articleText.length < 500 && content.sourceUrl) {
          console.log(`   📥 Fetching article text...`)
          try {
            const response = await fetchWithProxy(content.sourceUrl, {
              timeout: 10000,
              userAgent: 'Mozilla/5.0 (compatible; CarrotBot/1.0)'
            })

            if (response.ok) {
              const html = await response.text()
              const readable = extractReadableContent(html, content.sourceUrl)
              articleText = readable.textContent
              metadata.rawText = articleText
            } else {
              console.log(`   ⚠️  Failed to fetch: HTTP ${response.status}`)
              failCount++
              errors.push({ id: content.id, error: `HTTP ${response.status}` })
              continue
            }
          } catch (fetchError: any) {
            console.log(`   ⚠️  Fetch error: ${fetchError.message}`)
            failCount++
            errors.push({ id: content.id, error: fetchError.message })
            continue
          }
        }

        if (articleText.length < 500) {
          console.log(`   ⚠️  Not enough content (${articleText.length} chars), skipping`)
          failCount++
          errors.push({ id: content.id, error: 'insufficient_content' })
          continue
        }

        // Enrich with DeepSeek
        console.log(`   🤖 Enriching with DeepSeek...`)
        const enrichmentResult = await enrichContentWithDeepSeek(
          articleText,
          content.title,
          content.sourceUrl || '',
          patch.tags || []
        )

        if (enrichmentResult.success && enrichmentResult.data) {
          console.log(`   ✅ Enrichment successful!`)

          // Update database
          const updatedMetadata = {
            ...metadata,
            aiEnriched: true,
            enrichedAt: new Date().toISOString(),
            summary150: enrichmentResult.data.summary,
            keyPoints: enrichmentResult.data.keyFacts.map(f => f.text),
            context: enrichmentResult.data.context,
            entities: enrichmentResult.data.entities
          }

          await prisma.discoveredContent.update({
            where: { id: content.id },
            data: {
              summary: enrichmentResult.data.summary,
              facts: enrichmentResult.data.keyFacts.map(f => ({
                label: 'Fact',
                value: f.text
              })),
              metadata: updatedMetadata as Prisma.JsonObject
            }
          })

          console.log(`   💾 Updated database`)
          console.log(`      Summary: ${enrichmentResult.data.summary.substring(0, 80)}...`)
          console.log(`      Key Facts: ${enrichmentResult.data.keyFacts.length}`)
          successCount++

          results.push({
            id: content.id,
            title: content.title,
            status: 'success',
            summaryLength: enrichmentResult.data.summary.length,
            keyFactsCount: enrichmentResult.data.keyFacts.length
          })

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000))

        } else {
          console.log(`   ❌ Enrichment failed:`, enrichmentResult.errors)
          failCount++
          errors.push({
            id: content.id,
            title: content.title,
            error: enrichmentResult.errors?.join(', ') || 'enrichment_failed'
          })
        }

      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`)
        failCount++
        errors.push({
          id: content.id,
          title: content.title,
          error: error.message
        })
      }
    }

    console.log(`\n\n📊 Backfill Summary:`)
    console.log(`   ✅ Success: ${successCount}`)
    console.log(`   ⏭️  Skipped: ${skipCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   📝 Total: ${allContent.length}\n`)

    return NextResponse.json({
      success: true,
      patch: patchHandle,
      processed: allContent.length,
      successful: successCount,
      skipped: skipCount,
      failed: failCount,
      results,
      errors
    })

  } catch (error: any) {
    console.error('❌ Backfill failed:', error)
    return NextResponse.json(
      { error: 'Backfill failed', details: error.message },
      { status: 500 }
    )
  }
}

