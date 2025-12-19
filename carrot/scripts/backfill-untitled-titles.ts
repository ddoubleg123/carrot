#!/usr/bin/env tsx
/**
 * Backfill Untitled Titles
 * Updates DiscoveredContent items with "Untitled" titles by extracting from citations
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillTitles(patchHandle: string, dryRun: boolean = true) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  // Find all DiscoveredContent items with "Untitled" title
  const untitledItems = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      OR: [
        { title: 'Untitled' },
        { title: 'Untitled Content' }
      ]
    }
  })

  console.log(`\n📋 Found ${untitledItems.length} items with "Untitled" titles\n`)

  let updated = 0
  let notFound = 0
  let noTitle = 0

  for (const item of untitledItems) {
    // Try to find the citation that created this content
    // Match by URL (exact or normalized)
    let citation = await prisma.wikipediaCitation.findFirst({
      where: {
        monitoring: { patchId: patch.id },
        OR: [
          { citationUrl: item.sourceUrl },
          { citationUrl: item.canonicalUrl },
          { citationUrl: { contains: new URL(item.sourceUrl || item.canonicalUrl || '').pathname } }
        ],
        relevanceDecision: 'saved'
      },
      select: {
        id: true,
        citationTitle: true,
        citationUrl: true
      }
    })

    // If not found, try matching by domain + path
    if (!citation && item.sourceUrl) {
      try {
        const url = new URL(item.sourceUrl)
        const domain = url.hostname.replace('www.', '')
        const path = url.pathname
        citation = await prisma.wikipediaCitation.findFirst({
          where: {
            monitoring: { patchId: patch.id },
            citationUrl: { contains: domain },
            relevanceDecision: 'saved'
          },
          select: {
            id: true,
            citationTitle: true,
            citationUrl: true
          }
        })
      } catch (e) {
        // URL parsing failed, continue
      }
    }

    if (citation && citation.citationTitle && citation.citationTitle !== 'Untitled') {
      console.log(`✅ Found citation: "${citation.citationTitle}"`)
      console.log(`   Updating: ${item.id}`)
      console.log(`   Old title: ${item.title || '(null)'}`)
      console.log(`   New title: ${citation.citationTitle}\n`)

      if (!dryRun) {
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { title: citation.citationTitle }
        })
      }
      updated++
    } else {
      // Try to extract from URL
      try {
        const url = new URL(item.sourceUrl || item.canonicalUrl || '')
        const hostname = url.hostname.replace('www.', '')
        const pathParts = url.pathname.split('/').filter(p => p.length > 0)
        const lastPart = pathParts[pathParts.length - 1] || hostname
        
        // Decode URL-encoded title
        const decodedTitle = decodeURIComponent(lastPart)
          .replace(/[-_]/g, ' ')
          .replace(/\.[^.]+$/, '') // Remove file extension
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
          .substring(0, 100)

        if (decodedTitle && decodedTitle.length > 5) {
          console.log(`📝 Extracted from URL: "${decodedTitle}"`)
          console.log(`   Updating: ${item.id}\n`)

          if (!dryRun) {
            await prisma.discoveredContent.update({
              where: { id: item.id },
              data: { title: decodedTitle }
            })
          }
          updated++
        } else {
          console.log(`⚠️  No title found for: ${item.id}`)
          console.log(`   URL: ${item.sourceUrl?.substring(0, 60)}...\n`)
          noTitle++
        }
      } catch (error) {
        console.log(`⚠️  Could not extract from URL: ${item.id}`)
        console.log(`   URL: ${item.sourceUrl?.substring(0, 60)}...\n`)
        noTitle++
      }
      notFound++
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Total untitled items: ${untitledItems.length}`)
  console.log(`   Found in citations: ${updated - (untitledItems.length - notFound - noTitle)}`)
  console.log(`   Extracted from URL: ${untitledItems.length - notFound - noTitle - (updated - (untitledItems.length - notFound - noTitle))}`)
  console.log(`   No title available: ${noTitle}`)
  console.log(`   Would update: ${updated}`)
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}\n`)

  if (dryRun) {
    console.log('💡 Run with --live to apply updates\n')
  }

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'
const live = args.includes('--live')

backfillTitles(patchHandle, !live)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

