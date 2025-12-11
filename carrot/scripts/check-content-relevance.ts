/**
 * Check why a specific content item is on a patch and what DeepSeek says about relevance
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkContentRelevance(contentId: string) {
  try {
    console.log(`\n🔍 Checking Content Relevance for: ${contentId}\n`)

    // Find the content
    const content = await prisma.discoveredContent.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        canonicalUrl: true,
        summary: true,
        relevanceScore: true,
        qualityScore: true,
        importanceScore: true,
        whyItMatters: true,
        metadata: true,
        patch: {
          select: {
            id: true,
            title: true,
            handle: true,
            tags: true
          }
        }
      }
    })

    if (!content) {
      console.error(`❌ Content not found: ${contentId}`)
      return
    }

    console.log(`✅ Found Content:`)
    console.log(`   Title: ${content.title}`)
    console.log(`   URL: ${content.sourceUrl}`)
    console.log(`   Patch: ${content.patch.title} (${content.patch.handle})`)
    console.log(`   Patch Tags: ${content.patch.tags.join(', ') || 'None'}\n`)

    console.log(`📊 Relevance Scores:`)
    console.log(`   Relevance Score: ${content.relevanceScore ?? 'N/A'}`)
    console.log(`   Quality Score: ${content.qualityScore ?? 'N/A'}`)
    console.log(`   Importance Score: ${content.importanceScore ?? 'N/A'}\n`)

    // Check Wikipedia citation that led to this
    const citation = await prisma.wikipediaCitation.findFirst({
      where: { savedContentId: contentId },
      select: {
        id: true,
        citationTitle: true,
        citationUrl: true,
        aiPriorityScore: true,
        relevanceDecision: true,
        contentText: true,
        monitoring: {
          select: {
            wikipediaTitle: true,
            wikipediaUrl: true
          }
        }
      }
    })

    if (citation) {
      console.log(`📚 Wikipedia Citation Source:`)
      console.log(`   Wikipedia Page: ${citation.monitoring.wikipediaTitle}`)
      console.log(`   Citation URL: ${citation.citationUrl}`)
      console.log(`   Citation Title: ${citation.citationTitle}`)
      console.log(`   AI Priority Score: ${citation.aiPriorityScore ?? 'N/A'}`)
      console.log(`   Relevance Decision: ${citation.relevanceDecision ?? 'N/A'}`)
      console.log(`   Content Text Length: ${citation.contentText?.length ?? 0} chars\n`)
    } else {
      console.log(`⚠️  No Wikipedia citation found for this content\n`)
    }

    // Check metadata for AI enrichment info
    const metadata = content.metadata as any || {}
    console.log(`🤖 AI Enrichment Info:`)
    console.log(`   AI Enriched: ${metadata.aiEnriched ? 'Yes' : 'No'}`)
    console.log(`   Enriched At: ${metadata.enrichedAt || 'N/A'}`)
    console.log(`   Summary: ${content.summary?.substring(0, 200) || 'N/A'}...\n`)

    // Check whyItMatters
    if (content.whyItMatters) {
      console.log(`💡 Why It Matters:`)
      console.log(`   ${content.whyItMatters.substring(0, 300)}...\n`)
    }

    // Analyze the title and URL for relevance clues
    console.log(`🔍 Relevance Analysis:`)
    const titleLower = content.title.toLowerCase()
    const urlLower = content.sourceUrl?.toLowerCase() || ''
    const patchTags = content.patch.tags.map(t => t.toLowerCase())
    const patchTitle = content.patch.title.toLowerCase()
    
    const israelKeywords = ['israel', 'israeli', 'palestine', 'palestinian', 'gaza', 'west bank', 'jerusalem', 'tel aviv', 'hebrew', 'jewish', 'zionism', 'hamas', 'idf']
    const foundKeywords = israelKeywords.filter(keyword => 
      titleLower.includes(keyword) || urlLower.includes(keyword)
    )
    
    if (foundKeywords.length > 0) {
      console.log(`   ✅ Found Israel-related keywords: ${foundKeywords.join(', ')}`)
    } else {
      console.log(`   ⚠️  No obvious Israel-related keywords found in title or URL`)
    }

    // Check if it matches patch tags
    const matchingTags = patchTags.filter(tag => 
      titleLower.includes(tag) || urlLower.includes(tag)
    )
    
    if (matchingTags.length > 0) {
      console.log(`   ✅ Matches patch tags: ${matchingTags.join(', ')}`)
    } else {
      console.log(`   ⚠️  Does not match any patch tags`)
    }

    console.log(`\n📝 Summary:`)
    console.log(`   This content was likely included because:`)
    if (citation) {
      console.log(`   - It was cited on Wikipedia page: "${citation.monitoring.wikipediaTitle}"`)
      console.log(`   - AI Priority Score: ${citation.aiPriorityScore ?? 'N/A'}`)
    }
    if (content.relevanceScore !== null) {
      console.log(`   - Relevance Score: ${content.relevanceScore}`)
    }
    if (foundKeywords.length > 0) {
      console.log(`   - Contains keywords: ${foundKeywords.join(', ')}`)
    }
    if (foundKeywords.length === 0 && matchingTags.length === 0) {
      console.log(`   ⚠️  WARNING: No obvious connection to Israel found!`)
      console.log(`   - This might be incorrectly included`)
    }

  } catch (error: any) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

const contentId = process.argv[2] || 'cmixnl348001ho22bjp5ftnk3'

checkContentRelevance(contentId)
  .then(() => {
    console.log('\n✨ Check complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error)
    process.exit(1)
  })

