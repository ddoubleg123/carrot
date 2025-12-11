/**
 * Backfill all content with DeepSeek enrichment
 * Ensures all content has proper summaries and complete key facts
 */

// Load environment variables
try {
  // Try to load dotenv if available
  require('dotenv/config')
} catch {
  // dotenv not available, try manual load
  try {
    const fs = require('fs')
    const path = require('path')
    const envPath = path.join(__dirname, '..', '.env.local')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      envContent.split('\n').forEach((line: string) => {
        const match = line.match(/^([^=]+)=(.*)$/)
        if (match) {
          process.env[match[1].trim()] = match[2].trim()
        }
      })
    }
  } catch {}
}

import { PrismaClient, Prisma } from '@prisma/client'
import { enrichContentWithDeepSeek } from '@/lib/summarize/enrichContent'
import { fetchWithProxy } from '@/lib/fetchProxy'
import { extractReadableContent } from '@/lib/readability'

const prisma = new PrismaClient()

async function backfillDeepSeekEnrichment(patchHandle: string, limit?: number) {
  try {
    console.log(`\n🤖 DeepSeek Enrichment Backfill for Patch: ${patchHandle}\n`)

    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle },
      select: { id: true, title: true, handle: true, tags: true }
    })

    if (!patch) {
      console.error(`❌ Patch "${patchHandle}" not found`)
      return
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
              continue
            }
          } catch (fetchError: any) {
            console.log(`   ⚠️  Fetch error: ${fetchError.message}`)
            failCount++
            continue
          }
        }

        if (articleText.length < 500) {
          console.log(`   ⚠️  Not enough content (${articleText.length} chars), skipping`)
          failCount++
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

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000))

        } else {
          console.log(`   ❌ Enrichment failed:`, enrichmentResult.errors)
          failCount++
        }

      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`)
        failCount++
      }
    }

    console.log(`\n\n📊 Backfill Summary:`)
    console.log(`   ✅ Success: ${successCount}`)
    console.log(`   ⏭️  Skipped: ${skipCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   📝 Total: ${allContent.length}\n`)

  } catch (error: any) {
    console.error('❌ Backfill failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

const patchHandle = process.argv[2] || 'israel'
const limit = process.argv[3] ? parseInt(process.argv[3]) : undefined

backfillDeepSeekEnrichment(patchHandle, limit)
  .then(() => {
    console.log('\n✨ Backfill complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error)
    process.exit(1)
  })

