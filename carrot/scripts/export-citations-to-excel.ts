import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function exportCitationsToExcel() {
  try {
    console.log('🔍 Querying citations for Israel patch...')
    
    // Find the Israel patch
    const patch = await prisma.patch.findFirst({
      where: { handle: 'israel' },
      select: { id: true, title: true, handle: true }
    })

    if (!patch) {
      throw new Error('Israel patch not found')
    }

    console.log(`✅ Found patch: ${patch.title} (${patch.handle})`)

    // Query all citations with monitoring info
    const citations = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: {
          patchId: patch.id
        }
      },
      include: {
        monitoring: {
          select: {
            wikipediaTitle: true,
            wikipediaUrl: true,
            status: true
          }
        },
        savedContent: {
          select: {
            id: true,
            title: true,
            canonicalUrl: true
          }
        }
      },
      orderBy: [
        { aiPriorityScore: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'asc' }
      ]
    })

    console.log(`📊 Found ${citations.length} citations`)

    // Transform to Excel format
    const rows = citations.map((citation, index) => {
      const monitoring = citation.monitoring
      const savedContent = citation.savedContent

      return {
        'Row #': index + 1,
        'Citation ID': citation.id,
        'Source Wikipedia Page': monitoring.wikipediaTitle || 'N/A',
        'Source Wikipedia URL': monitoring.wikipediaUrl || 'N/A',
        'Wikipedia Page Status': monitoring.status || 'N/A',
        'Citation URL': citation.citationUrl,
        'Citation Title': citation.citationTitle || 'N/A',
        'Citation Context': citation.citationContext ? citation.citationContext.substring(0, 200) : 'N/A',
        'Source Number': citation.sourceNumber,
        'DeepSeek AI Priority Score': citation.aiPriorityScore ?? 'Not Scored',
        'Verification Status': citation.verificationStatus,
        'Scan Status': citation.scanStatus,
        'Relevance Decision': citation.relevanceDecision || 'Pending',
        'Saved Content ID': savedContent?.id || 'Not Saved',
        'Saved Content Title': savedContent?.title || 'N/A',
        'Saved Content URL': savedContent?.canonicalUrl || 'N/A',
        'Content Text Length': citation.contentText ? citation.contentText.length : 0,
        'Has Content Text': citation.contentText ? 'Yes' : 'No',
        'Last Verified At': citation.lastVerifiedAt ? citation.lastVerifiedAt.toISOString() : 'Never',
        'Last Scanned At': citation.lastScannedAt ? citation.lastScannedAt.toISOString() : 'Never',
        'Error Message': citation.errorMessage || 'None',
        'Created At': citation.createdAt.toISOString(),
        'Updated At': citation.updatedAt.toISOString(),
        // Computed fields for analysis
        'Can Be Reprocessed': (
          citation.relevanceDecision === 'denied' && 
          citation.aiPriorityScore !== null && 
          citation.aiPriorityScore >= 60
        ) ? 'Yes (High Score Denied)' : 
        (citation.relevanceDecision === 'saved' && !savedContent) ? 'Yes (Failed Save)' :
        (citation.relevanceDecision === null) ? 'Yes (No Decision)' : 'No',
        'Days Since Created': Math.floor((Date.now() - citation.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        'Days Since Last Scanned': citation.lastScannedAt 
          ? Math.floor((Date.now() - citation.lastScannedAt.getTime()) / (1000 * 60 * 60 * 24))
          : 'Never Scanned'
      }
    })

    // Create workbook
    const workbook = XLSX.utils.book_new()
    
    // Add main data sheet
    const worksheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Citations')

    // Add summary sheet
    const summary = [
      { Metric: 'Total Citations', Value: citations.length },
      { Metric: 'With AI Priority Score', Value: citations.filter(c => c.aiPriorityScore !== null).length },
      { Metric: 'High Scores (>=60)', Value: citations.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore >= 60).length },
      { Metric: 'Medium Scores (40-59)', Value: citations.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore >= 40 && c.aiPriorityScore < 60).length },
      { Metric: 'Low Scores (<40)', Value: citations.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore < 40).length },
      { Metric: 'Relevance Decision: Saved', Value: citations.filter(c => c.relevanceDecision === 'saved').length },
      { Metric: 'Relevance Decision: Denied', Value: citations.filter(c => c.relevanceDecision === 'denied').length },
      { Metric: 'Relevance Decision: Pending', Value: citations.filter(c => c.relevanceDecision === null).length },
      { Metric: 'Verification Status: Verified', Value: citations.filter(c => c.verificationStatus === 'verified').length },
      { Metric: 'Verification Status: Pending', Value: citations.filter(c => c.verificationStatus === 'pending').length },
      { Metric: 'Verification Status: Failed', Value: citations.filter(c => c.verificationStatus === 'failed').length },
      { Metric: 'Scan Status: Scanned', Value: citations.filter(c => c.scanStatus === 'scanned').length },
      { Metric: 'Scan Status: Not Scanned', Value: citations.filter(c => c.scanStatus === 'not_scanned').length },
      { Metric: 'Scan Status: Scanning', Value: citations.filter(c => c.scanStatus === 'scanning').length },
      { Metric: 'Has Content Text', Value: citations.filter(c => c.contentText !== null).length },
      { Metric: 'Saved to DiscoveredContent', Value: citations.filter(c => c.savedContentId !== null).length },
      { Metric: 'High Score Denied (Reprocessable)', Value: citations.filter(c => 
        c.relevanceDecision === 'denied' && 
        c.aiPriorityScore !== null && 
        c.aiPriorityScore >= 60
      ).length },
      { Metric: 'Failed Save (Reprocessable)', Value: citations.filter(c => 
        c.relevanceDecision === 'saved' && 
        c.savedContentId === null
      ).length },
      { Metric: 'No Decision (Processable)', Value: citations.filter(c => c.relevanceDecision === null).length }
    ]

    const summarySheet = XLSX.utils.json_to_sheet(summary)
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

    // Add breakdown by Wikipedia page
    const pageBreakdown = citations.reduce((acc, citation) => {
      const pageTitle = citation.monitoring.wikipediaTitle || 'Unknown'
      if (!acc[pageTitle]) {
        acc[pageTitle] = {
          'Wikipedia Page': pageTitle,
          'Total Citations': 0,
          'Saved': 0,
          'Denied': 0,
          'Pending': 0,
          'High Scores (>=60)': 0,
          'With Content Text': 0
        }
      }
      acc[pageTitle]['Total Citations']++
      if (citation.relevanceDecision === 'saved') acc[pageTitle]['Saved']++
      if (citation.relevanceDecision === 'denied') acc[pageTitle]['Denied']++
      if (citation.relevanceDecision === null) acc[pageTitle]['Pending']++
      if (citation.aiPriorityScore !== null && citation.aiPriorityScore >= 60) acc[pageTitle]['High Scores (>=60)']++
      if (citation.contentText) acc[pageTitle]['With Content Text']++
      return acc
    }, {} as Record<string, any>)

    const pageBreakdownSheet = XLSX.utils.json_to_sheet(Object.values(pageBreakdown))
    XLSX.utils.book_append_sheet(workbook, pageBreakdownSheet, 'By Wikipedia Page')

    // Write file
    const outputDir = path.join(process.cwd(), 'exports')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const filename = `israel-citations-export-${new Date().toISOString().split('T')[0]}.xlsx`
    const filepath = path.join(outputDir, filename)
    
    XLSX.writeFile(workbook, filepath)

    console.log(`\n✅ Export complete!`)
    console.log(`📁 File saved to: ${filepath}`)
    console.log(`\n📊 Summary:`)
    console.log(`   Total Citations: ${citations.length}`)
    console.log(`   With AI Score: ${citations.filter(c => c.aiPriorityScore !== null).length}`)
    console.log(`   Saved: ${citations.filter(c => c.relevanceDecision === 'saved').length}`)
    console.log(`   Denied: ${citations.filter(c => c.relevanceDecision === 'denied').length}`)
    console.log(`   Pending: ${citations.filter(c => c.relevanceDecision === null).length}`)
    console.log(`   High Score Denied (Reprocessable): ${citations.filter(c => 
      c.relevanceDecision === 'denied' && 
      c.aiPriorityScore !== null && 
      c.aiPriorityScore >= 60
    ).length}`)
    console.log(`   Failed Save (Reprocessable): ${citations.filter(c => 
      c.relevanceDecision === 'saved' && 
      c.savedContentId === null
    ).length}`)

  } catch (error) {
    console.error('❌ Error exporting citations:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the export
exportCitationsToExcel()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })

