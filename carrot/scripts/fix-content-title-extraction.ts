/**
 * Fix content title and re-extract content for a specific item
 */

import { PrismaClient } from '@prisma/client'
import { extractReadableContent } from '@/lib/readability'
import { fetchWithProxy } from '@/lib/fetchProxy'

const prisma = new PrismaClient()

async function fixContentItem(contentId: string) {
  try {
    console.log(`\n🔧 Fixing Content Item: ${contentId}\n`)

    // Get the content
    const content = await prisma.discoveredContent.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        summary: true,
        metadata: true
      }
    })

    if (!content) {
      console.error(`❌ Content not found: ${contentId}`)
      return
    }

    console.log(`✅ Found content:`)
    console.log(`   Current Title: ${content.title}`)
    console.log(`   URL: ${content.sourceUrl}\n`)

    // Fetch and re-extract
    console.log(`📥 Fetching page...`)
    const response = await fetchWithProxy(content.sourceUrl || '', {
      timeout: 10000,
      userAgent: 'Mozilla/5.0 (compatible; CarrotBot/1.0)'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    console.log(`✅ Fetched ${html.length} characters\n`)

    // Extract with improved readability
    console.log(`🔍 Extracting content...`)
    const readable = extractReadableContent(html, content.sourceUrl || '')

    console.log(`📊 Extraction Results:`)
    console.log(`   New Title: "${readable.title}"`)
    console.log(`   Text Length: ${readable.textContent.length} chars`)
    console.log(`   Excerpt: ${readable.excerpt.substring(0, 150)}...\n`)

    // Update the content
    const metadata = (content.metadata as any) || {}
    metadata.extractedAt = new Date().toISOString()
    metadata.extractedTitle = readable.title
    metadata.extractedTextLength = readable.textContent.length

    await prisma.discoveredContent.update({
      where: { id: contentId },
      data: {
        title: readable.title, // Update title
        summary: readable.excerpt.substring(0, 500), // Update summary with cleaned excerpt
        metadata: metadata
      }
    })

    console.log(`✅ Updated content:`)
    console.log(`   Title: "${readable.title}"`)
    console.log(`   Summary: ${readable.excerpt.substring(0, 100)}...`)
    console.log(`\n✨ Fix complete!`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

const contentId = process.argv[2] || 'cmixnl348001ho22bjp5ftnk3'

fixContentItem(contentId)
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error)
    process.exit(1)
  })

