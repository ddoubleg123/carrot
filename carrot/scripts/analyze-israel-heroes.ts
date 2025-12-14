/**
 * Analyze heroes for Israel patch
 * Count expected vs actual heroes and export to Excel
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function analyzeIsraelHeroes() {
  try {
    console.log('🔍 Analyzing Israel Patch Heroes\n')

    // Find the Israel patch
    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel' },
      select: { id: true, title: true, handle: true }
    })

    if (!patch) {
      throw new Error('Israel patch not found')
    }

    console.log(`✅ Found patch: ${patch.title} (${patch.handle})\n`)

    // Get all content for this patch
    const allContent = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        canonicalUrl: true,
        summary: true,
        textContent: true,
        content: true,
        relevanceScore: true,
        qualityScore: true,
        importanceScore: true,
        whyItMatters: true,
        facts: true,
        quotes: true,
        metadata: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`📊 Total Content Items: ${allContent.length}`)

    // Get all heroes for this content
    const heroes = await prisma.hero.findMany({
      where: {
        contentId: { in: allContent.map(c => c.id) }
      },
      select: {
        id: true,
        contentId: true,
        imageUrl: true,
        title: true,
        status: true,
        excerpt: true,
        updatedAt: true
      }
    })

    console.log(`📊 Total Heroes: ${heroes.length}`)
    console.log(`📊 Expected Heroes: ${allContent.length}`)
    console.log(`📊 Missing Heroes: ${allContent.length - heroes.length}\n`)

    // Get Wikipedia monitoring info for citations
    const contentIds = allContent.map(c => c.id)
    const citations = await prisma.wikipediaCitation.findMany({
      where: {
        savedContentId: { in: contentIds }
      },
      select: {
        id: true,
        savedContentId: true,
        citationUrl: true,
        citationTitle: true,
        aiPriorityScore: true,
        relevanceDecision: true,
        monitoring: {
          select: {
            wikipediaTitle: true,
            wikipediaUrl: true
          }
        }
      }
    })

    // Create a map of contentId -> citation info
    const citationMap = new Map<string, typeof citations[0]>()
    citations.forEach(citation => {
      if (citation.savedContentId) {
        citationMap.set(citation.savedContentId, citation)
      }
    })

    // Prepare data for Excel
    const rows = allContent.map((content) => {
      const hero = heroes.find(h => h.contentId === content.id)
      const citation = citationMap.get(content.id)
      
      // Extract text content (prefer textContent, fallback to content)
      const textContent = content.textContent || content.content || ''
      const textPreview = textContent.substring(0, 500) // First 500 chars
      const textLength = textContent.length

      // Extract metadata
      const metadata = content.metadata as any || {}
      const urlSlug = metadata.urlSlug || 'N/A'
      const sourceType = metadata.sourceType || content.sourceUrl || 'N/A'

      return {
        'Content ID': content.id,
        'Title': content.title || 'Untitled',
        'Source URL': content.sourceUrl || 'N/A',
        'Canonical URL': content.canonicalUrl || 'N/A',
        'URL Slug': urlSlug,
        'Has Hero': hero ? 'Yes' : 'No',
        'Hero Status': hero?.status || 'N/A',
        'Hero Image URL': hero?.imageUrl?.substring(0, 100) || 'N/A',
        'Hero Image Source': hero?.imageUrl?.includes('wikimedia') ? 'Wikimedia' :
                           hero?.imageUrl?.includes('via.placeholder') ? 'Placeholder' :
                           hero?.imageUrl?.includes('favicon') ? 'Favicon' :
                           hero?.imageUrl ? 'Other' : 'N/A',
        'Wikipedia Page': citation?.monitoring?.wikipediaTitle || 'N/A',
        'Wikipedia URL': citation?.monitoring?.wikipediaUrl || 'N/A',
        'Citation URL': citation?.citationUrl || 'N/A',
        'Citation Title': citation?.citationTitle || 'N/A',
        'AI Priority Score': citation?.aiPriorityScore ?? 'N/A',
        'Relevance Decision': citation?.relevanceDecision || 'N/A',
        'Relevance Score': content.relevanceScore ?? 'N/A',
        'Quality Score': content.qualityScore ?? 'N/A',
        'Importance Score': content.importanceScore ?? 'N/A',
        'Summary': content.summary || 'N/A',
        'Why It Matters': content.whyItMatters || 'N/A',
        'Text Length': textLength,
        'Text Preview': textPreview,
        'Has Facts': content.facts && Array.isArray(content.facts) && content.facts.length > 0 ? 'Yes' : 'No',
        'Facts Count': content.facts && Array.isArray(content.facts) ? content.facts.length : 0,
        'Has Quotes': content.quotes && Array.isArray(content.quotes) && content.quotes.length > 0 ? 'Yes' : 'No',
        'Quotes Count': content.quotes && Array.isArray(content.quotes) ? content.quotes.length : 0,
        'Created At': content.createdAt.toISOString(),
        'Updated At': content.updatedAt.toISOString()
      }
    })

    // Create workbook
    const workbook = XLSX.utils.book_new()
    
    // Add main data sheet
    const worksheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Content')

    // Add summary sheet
    const summary = [
      { Metric: 'Total Content Items', Value: allContent.length },
      { Metric: 'Total Heroes', Value: heroes.length },
      { Metric: 'Expected Heroes', Value: allContent.length },
      { Metric: 'Missing Heroes', Value: allContent.length - heroes.length },
      { Metric: 'Hero Coverage', Value: `${((heroes.length / allContent.length) * 100).toFixed(1)}%` },
      { Metric: 'Heroes with Wikimedia Images', Value: heroes.filter(h => h.imageUrl?.includes('wikimedia')).length },
      { Metric: 'Heroes with Placeholder Images', Value: heroes.filter(h => h.imageUrl?.includes('placeholder')).length },
      { Metric: 'Heroes with Favicon Images', Value: heroes.filter(h => h.imageUrl?.includes('favicon')).length },
      { Metric: 'Heroes with Other Images', Value: heroes.filter(h => h.imageUrl && !h.imageUrl.includes('wikimedia') && !h.imageUrl.includes('placeholder') && !h.imageUrl.includes('favicon')).length },
      { Metric: 'Content with Wikipedia Citations', Value: citations.length },
      { Metric: 'Content with AI Scores', Value: citations.filter(c => c.aiPriorityScore !== null).length },
      { Metric: 'Average AI Score', Value: citations.filter(c => c.aiPriorityScore !== null).length > 0 
        ? (citations.filter(c => c.aiPriorityScore !== null).reduce((sum, c) => sum + (c.aiPriorityScore || 0), 0) / citations.filter(c => c.aiPriorityScore !== null).length).toFixed(1)
        : 'N/A' },
      { Metric: 'Content with High Scores (>=60)', Value: citations.filter(c => (c.aiPriorityScore || 0) >= 60).length },
      { Metric: 'Content with Relevance Scores', Value: allContent.filter(c => c.relevanceScore !== null).length },
      { Metric: 'Average Relevance Score', Value: allContent.filter(c => c.relevanceScore !== null).length > 0
        ? (allContent.filter(c => c.relevanceScore !== null).reduce((sum, c) => sum + (c.relevanceScore || 0), 0) / allContent.filter(c => c.relevanceScore !== null).length).toFixed(2)
        : 'N/A' }
    ]

    const summarySheet = XLSX.utils.json_to_sheet(summary)
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

    // Add hero breakdown sheet
    const heroBreakdown = heroes.map(hero => {
      const content = allContent.find(c => c.id === hero.contentId)
      const citation = citationMap.get(hero.contentId || '')
      
      return {
        'Hero ID': hero.id,
        'Content ID': hero.contentId,
        'Content Title': content?.title || 'N/A',
        'Hero Status': hero.status,
        'Hero Image URL': hero.imageUrl?.substring(0, 100) || 'N/A',
        'Image Source': hero.imageUrl?.includes('wikimedia') ? 'Wikimedia' :
                       hero.imageUrl?.includes('via.placeholder') ? 'Placeholder' :
                       hero.imageUrl?.includes('favicon') ? 'Favicon' :
                       hero.imageUrl ? 'Other' : 'N/A',
        'Wikipedia Page': citation?.monitoring?.wikipediaTitle || 'N/A',
        'AI Priority Score': citation?.aiPriorityScore ?? 'N/A',
        'Updated At': hero.updatedAt.toISOString()
      }
    })

    const heroSheet = XLSX.utils.json_to_sheet(heroBreakdown)
    XLSX.utils.book_append_sheet(workbook, heroSheet, 'Heroes')

    // Ensure exports directory exists
    const exportsDir = path.join(process.cwd(), 'exports')
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true })
    }

    // Generate filename
    const filename = `israel-content-heroes-${new Date().toISOString().split('T')[0]}.xlsx`
    const filepath = path.join(exportsDir, filename)

    // Write file
    XLSX.writeFile(workbook, filepath)

    console.log(`\n✅ Excel export complete!`)
    console.log(`📁 File saved to: ${filepath}\n`)

    console.log(`📊 Summary:`)
    console.log(`   Total Content Items: ${allContent.length}`)
    console.log(`   Total Heroes: ${heroes.length}`)
    console.log(`   Expected Heroes: ${allContent.length}`)
    console.log(`   Missing Heroes: ${allContent.length - heroes.length}`)
    console.log(`   Hero Coverage: ${((heroes.length / allContent.length) * 100).toFixed(1)}%`)
    console.log(`   Heroes with Wikimedia: ${heroes.filter(h => h.imageUrl?.includes('wikimedia')).length}`)
    console.log(`   Content with Wikipedia Citations: ${citations.length}`)
    console.log(`   Content with AI Scores: ${citations.filter(c => c.aiPriorityScore !== null).length}`)

  } catch (error: any) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

analyzeIsraelHeroes()
  .then(() => {
    console.log('\n✨ Analysis complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Analysis failed:', error)
    process.exit(1)
  })

