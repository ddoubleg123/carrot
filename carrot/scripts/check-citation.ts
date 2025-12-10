import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkCitation() {
  try {
    const citationId = 'cmip9so2u0561ox1t56gue2ye'
    
    console.log(`🔍 Checking citation: ${citationId}\n`)
    
    const citation = await prisma.wikipediaCitation.findUnique({
      where: { id: citationId },
      include: {
        monitoring: {
          select: {
            wikipediaTitle: true,
            wikipediaUrl: true,
            status: true,
            patch: {
              select: {
                id: true,
                title: true,
                handle: true
              }
            }
          }
        },
        savedContent: {
          select: {
            id: true,
            title: true,
            sourceUrl: true,
            canonicalUrl: true
          }
        }
      }
    })
    
    if (!citation) {
      console.log('❌ Citation not found')
      return
    }
    
    console.log('📊 Citation Details:')
    console.log('─'.repeat(60))
    console.log(`ID: ${citation.id}`)
    console.log(`Citation URL: ${citation.citationUrl}`)
    console.log(`Citation Title: ${citation.citationTitle || 'N/A'}`)
    console.log(`\nAI Priority Score: ${citation.aiPriorityScore ?? 'N/A'}`)
    console.log(`Relevance Decision: ${citation.relevanceDecision ?? 'N/A'}`)
    console.log(`Scan Status: ${citation.scanStatus}`)
    console.log(`Verification Status: ${citation.verificationStatus}`)
    console.log(`\nContent Text Length: ${citation.contentText?.length ?? 0} chars`)
    console.log(`Last Scanned At: ${citation.lastScannedAt?.toISOString() ?? 'N/A'}`)
    console.log(`Created At: ${citation.createdAt.toISOString()}`)
    
    if (citation.verificationFailureReason) {
      console.log(`\n⚠️ Verification Failure Reason: ${citation.verificationFailureReason}`)
    }
    
    console.log(`\n📄 Source Wikipedia Page:`)
    console.log(`  Title: ${citation.monitoring?.wikipediaTitle}`)
    console.log(`  URL: ${citation.monitoring?.wikipediaUrl}`)
    console.log(`  Status: ${citation.monitoring?.status}`)
    console.log(`\n🏷️ Patch:`)
    console.log(`  Title: ${citation.monitoring?.patch?.title}`)
    console.log(`  Handle: ${citation.monitoring?.patch?.handle}`)
    
    if (citation.savedContent) {
      console.log(`\n✅ Saved Content:`)
      console.log(`  ID: ${citation.savedContent.id}`)
      console.log(`  Title: ${citation.savedContent.title}`)
      console.log(`  URL: ${citation.savedContent.sourceUrl}`)
    } else {
      console.log(`\n❌ Not saved to DiscoveredContent`)
    }
    
    // Show first 500 chars of content if available
    if (citation.contentText) {
      console.log(`\n📝 Content Preview (first 500 chars):`)
      console.log('─'.repeat(60))
      console.log(citation.contentText.substring(0, 500))
      if (citation.contentText.length > 500) {
        console.log(`\n... (${citation.contentText.length - 500} more characters)`)
      }
    }
    
    // Analyze why it might have been denied
    console.log(`\n🔍 Analysis:`)
    console.log('─'.repeat(60))
    
    if (!citation.aiPriorityScore) {
      console.log('❌ No AI Priority Score - citation may have failed before scoring')
    } else if (citation.aiPriorityScore < 60) {
      console.log(`❌ AI Priority Score (${citation.aiPriorityScore}) is below threshold (60)`)
    } else {
      console.log(`✅ AI Priority Score (${citation.aiPriorityScore}) meets threshold (60)`)
    }
    
    if (!citation.contentText || citation.contentText.length < 500) {
      console.log(`❌ Content too short (${citation.contentText?.length ?? 0} chars, need 500+)`)
    } else if (citation.contentText.length < 600) {
      console.log(`⚠️ Content length (${citation.contentText.length} chars) may have prevented AI scoring (need 600+)`)
    } else {
      console.log(`✅ Content length (${citation.contentText.length} chars) is sufficient`)
    }
    
    if (citation.verificationStatus === 'failed') {
      console.log(`❌ Verification failed: ${citation.verificationFailureReason || 'Unknown reason'}`)
    }
    
    if (citation.relevanceDecision === 'denied' && citation.aiPriorityScore && citation.aiPriorityScore >= 60) {
      console.log(`\n⚠️ POTENTIAL ISSUE: Citation has good AI score (${citation.aiPriorityScore}) but was denied!`)
      console.log(`   This suggests the content may have failed a different check (e.g., isArticle check, saveAsContent logic)`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCitation()

