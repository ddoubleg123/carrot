#!/usr/bin/env tsx
/**
 * Fix Missing Citation Heroes
 * Creates DiscoveredContent entries for saved citations that don't have them
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { canonicalizeUrlFast } from '../src/lib/discovery/canonicalize'

const prisma = new PrismaClient()

async function fixMissingHeroes(patchHandle: string, dryRun: boolean = true) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true, handle: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  console.log(`\n🔧 Fixing missing citation heroes for: ${patch.title}\n`)

  // Get all saved citations
  const savedCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved'
    },
    select: {
      id: true,
      citationTitle: true,
      citationUrl: true,
      contentText: true,
      aiPriorityScore: true
    }
  })

  // Get all DiscoveredContent (check all, not just by metadata)
  const discoveredContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id
    },
    select: {
      sourceUrl: true,
      canonicalUrl: true,
      metadata: true
    }
  })

  const discoveredUrls = new Set(
    discoveredContent.flatMap(dc => [dc.sourceUrl, dc.canonicalUrl].filter(Boolean))
  )

  // Find missing ones
  const missing = savedCitations.filter(citation => {
    const url = citation.citationUrl
    const canonical = canonicalizeUrlFast(url) || url
    return !discoveredUrls.has(url) && !discoveredUrls.has(canonical)
  })

  console.log(`📊 Found ${missing.length} missing heroes\n`)

  let created = 0
  let skipped = 0

  for (const citation of missing) {
    const url = citation.citationUrl
    const canonical = canonicalizeUrlFast(url) || url
    
    // Check if already exists (by canonical URL)
    const existing = await prisma.discoveredContent.findFirst({
      where: {
        patchId: patch.id,
        OR: [
          { canonicalUrl: canonical },
          { sourceUrl: canonical },
          { sourceUrl: url }
        ]
      }
    })

    if (existing) {
      console.log(`⏭️  Already exists: ${citation.citationTitle || 'Untitled'}`)
      skipped++
      continue
    }

    // Check if we have content
    if (!citation.contentText || citation.contentText.length < 200) {
      console.log(`⚠️  Skipping (no content): ${citation.citationTitle || 'Untitled'}`)
      skipped++
      continue
    }

    const title = citation.citationTitle || 'Untitled'
    const content = citation.contentText
    const domain = new URL(url).hostname.replace('www.', '')

    console.log(`✅ Creating: ${title}`)
    console.log(`   URL: ${url.substring(0, 60)}...`)
    console.log(`   Content: ${content.length} chars\n`)

    if (!dryRun) {
      try {
        const saved = await prisma.discoveredContent.create({
          data: {
            patchId: patch.id,
            title,
            summary: content.substring(0, 500),
            sourceUrl: url,
            canonicalUrl: canonical,
            domain,
            type: 'article',
            category: 'article',
            relevanceScore: citation.aiPriorityScore ? citation.aiPriorityScore / 100 : 0.5,
            qualityScore: 0,
            textContent: content,
            content: content,
            facts: [],
            quotes: [],
            provenance: [url],
            metadata: {
              source: 'wikipedia-citation',
              aiScore: citation.aiPriorityScore,
              citationId: citation.id,
              fixedBy: 'fix-missing-citation-heroes'
            } as any
          }
        })

        // Enqueue for agent feeding
        try {
          const { enqueueDiscoveredContent, calculateContentHash } = await import('../src/lib/agent/feedWorker')
          const contentHash = calculateContentHash(title, content.substring(0, 240), content)
          await enqueueDiscoveredContent(saved.id, patch.id, contentHash, 0)
          console.log(`   🤖 Enqueued for agent feeding`)
        } catch (error) {
          console.warn(`   ⚠️  Failed to enqueue:`, error)
        }

        created++
      } catch (error) {
        console.error(`   ❌ Failed to create:`, error)
        skipped++
      }
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Missing citations: ${missing.length}`)
  console.log(`   Would create: ${created}`)
  console.log(`   Would skip: ${skipped}`)
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}\n`)

  if (dryRun) {
    console.log('💡 Run with --live to create missing heroes\n')
  }

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'
const live = args.includes('--live')

fixMissingHeroes(patchHandle, !live)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

