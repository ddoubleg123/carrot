/**
 * Test the full discovery flow for Israel patch
 * Simulates hitting "start discovery" button
 */

import { prisma } from '../src/lib/prisma'
import { seedFrontierFromPlan, generateGuideSnapshot } from '../src/lib/discovery/planner'
import { MultiSourceOrchestrator } from '../src/lib/discovery/multiSourceOrchestrator'

async function testDiscoveryFlow() {
  const patchHandle = 'israel'
  
  console.log(`\n=== TESTING DISCOVERY FLOW FOR ISRAEL PATCH ===\n`)
  
  // Step 1: Get the patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      guide: true
    }
  })
  
  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    return
  }
  
  console.log(`Patch: ${patch.title}`)
  console.log(`Description: ${patch.description || 'None'}`)
  console.log(`Tags: ${patch.tags.join(', ')}\n`)
  
  // Step 2: Generate or get discovery plan
  let plan = patch.guide as any
  if (!plan || !plan.seedCandidates) {
    console.log('Generating discovery plan...')
    const entity = {} as { name?: string; aliases?: string[] }
    const topic = patch.title
    const aliases = patch.tags.filter((t): t is string => typeof t === 'string')
    
    plan = await generateGuideSnapshot(topic, aliases)
    console.log(`✅ Generated plan with ${plan.seedCandidates?.length || 0} seed candidates\n`)
  } else {
    console.log(`Using existing plan with ${plan.seedCandidates?.length || 0} seed candidates\n`)
  }
  
  // Step 3: Run MultiSourceOrchestrator (this happens in seedFrontierFromPlan)
  console.log('=== STEP 3: Running MultiSourceOrchestrator ===\n')
  
  const orchestrator = new MultiSourceOrchestrator()
  const discoveryResult = await orchestrator.discover(
    patch.title,
    patch.description || '',
    patch.tags.filter((t): t is string => typeof t === 'string')
  )
  
  console.log(`\n✅ MultiSourceOrchestrator Results:`)
  console.log(`  - Wikipedia pages: ${discoveryResult.stats.wikipediaPages}`)
  console.log(`  - Wikipedia citations: ${discoveryResult.stats.wikipediaCitations}`)
  console.log(`  - News articles: ${discoveryResult.stats.newsArticles}`)
  console.log(`  - Anna's Archive books: ${discoveryResult.stats.annasArchiveBooks}`)
  console.log(`  - Total sources: ${discoveryResult.stats.totalSources}`)
  console.log(`  - Duplicates removed: ${discoveryResult.stats.duplicatesRemoved}\n`)
  
  // Step 4: Search Anna's Archive directly (bypass relevance filtering for testing)
  const { searchAnnasArchive } = await import('../src/lib/discovery/annasArchiveSource')
  
  console.log(`\n=== Searching Anna's Archive Directly ===\n`)
  const annasArchiveResults = await searchAnnasArchive({ 
    query: 'Israel',
    language: 'en',
    fileType: 'pdf',
    limit: 10
  })
  
  console.log(`\n=== Anna's Archive Books Found ===`)
  console.log(`Found ${annasArchiveResults.length} books:\n`)
  
  annasArchiveResults.forEach((book, idx) => {
    console.log(`${idx + 1}. ${book.title}`)
    console.log(`   Author: ${book.author || 'Unknown'}`)
    console.log(`   Year: ${book.year || 'Unknown'}`)
    console.log(`   URL: ${book.url}`)
    console.log(`   File Type: ${book.fileType || 'Unknown'}\n`)
  })
  
  // Convert to DiscoveredSource format for extraction
  const annasArchiveBooks = annasArchiveResults.map(book => ({
    type: 'book' as const,
    title: book.title,
    url: book.url,
    description: book.preview || `${book.title}${book.author ? ` by ${book.author}` : ''}`,
    content: book.preview || '',
    metadata: {
      author: book.author,
      year: book.year,
      isbn: book.isbn,
      fileType: book.fileType,
      source: book.source || "Anna's Archive"
    },
    relevanceScore: 100, // Skip relevance for testing
    source: "Anna's Archive"
  }))
  
  // Step 5: Now test PDF extraction for the first 2 books
  if (annasArchiveBooks.length >= 2) {
    console.log(`\n=== STEP 5: Testing PDF Extraction ===\n`)
    
    const { extractBookContent } = await import('./extract-annas-archive-book')
    
    const pdfResults: Array<{ title: string; url: string; textLength: number; fileName?: string }> = []
    
    for (let i = 0; i < Math.min(2, annasArchiveBooks.length); i++) {
      const book = annasArchiveBooks[i]
      console.log(`\n--- Extracting Book ${i + 1}/2: ${book.title} ---`)
      console.log(`Author: ${book.metadata.author || 'Unknown'}`)
      console.log(`URL: ${book.url}\n`)
      
      try {
        const extractedContent = await extractBookContent(book.url)
        
        if (extractedContent) {
          // Check if it's actual extracted text or a status message
          const isActualText = extractedContent.length > 1000 && !extractedContent.includes('PDF file') && !extractedContent.includes('Saved to:')
          
          let textLength: number
          let fileName: string | undefined
          
          if (isActualText) {
            // It's actual extracted text
            textLength = extractedContent.length
            console.log(`\n✅ Successfully extracted ${textLength.toLocaleString()} characters of text`)
          } else {
            // It's a status message - try to extract info
            console.log(`\n📄 Status: ${extractedContent.substring(0, 200)}...`)
            
            // Try to extract character count from message
            const charMatch = extractedContent.match(/(\d+(?:,\d+)*)\s*characters/)
            textLength = charMatch ? parseInt(charMatch[1].replace(/,/g, '')) : extractedContent.length
            
            // Try to extract file path
            const pathMatch = extractedContent.match(/(?:Saved to:|Path:)\s*([^\n]+)/)
            if (pathMatch) {
              fileName = pathMatch[1].split(/[/\\]/).pop() || undefined
            } else {
              // Try to extract from URL
              const urlMatch = extractedContent.match(/URL:\s*([^\s\n]+)/)
              if (urlMatch) {
                const url = urlMatch[1]
                fileName = url.split('/').pop()?.split('?')[0] || undefined
              }
            }
          }
          
          pdfResults.push({
            title: book.title,
            url: book.url,
            textLength,
            fileName
          })
        } else {
          console.log(`❌ No content extracted`)
        }
      } catch (error: any) {
        console.error(`❌ Error extracting book: ${error.message}`)
        console.error(error.stack)
      }
      
      // Add delay between extractions
      if (i < Math.min(2, annasArchiveBooks.length) - 1) {
        console.log(`\nWaiting 5 seconds before next extraction...`)
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
    
    // Step 6: Final Summary
    console.log(`\n\n=== FINAL RESULTS ===\n`)
    console.log(`Successfully extracted text from ${pdfResults.length} PDFs:\n`)
    
    pdfResults.forEach((result, idx) => {
      console.log(`PDF ${idx + 1}:`)
      console.log(`  Title: ${result.title}`)
      console.log(`  File: ${result.fileName || 'N/A'}`)
      console.log(`  Characters extracted: ${result.textLength.toLocaleString()}`)
      console.log(`  URL: ${result.url}\n`)
    })
    
    if (pdfResults.length === 2) {
      console.log(`✅ SUCCESS: Extracted text from 2 PDFs as requested!`)
      console.log(`\nSummary:`)
      console.log(`  PDF 1: "${pdfResults[0].title}" - ${pdfResults[0].textLength.toLocaleString()} characters`)
      console.log(`  PDF 2: "${pdfResults[1].title}" - ${pdfResults[1].textLength.toLocaleString()} characters`)
    } else {
      console.log(`⚠️  Only extracted ${pdfResults.length} PDFs (requested 2)`)
    }
  } else {
    console.log(`\n⚠️  Not enough Anna's Archive books found (found ${annasArchiveBooks.length}, need 2)`)
  }
  
  await prisma.$disconnect()
}

testDiscoveryFlow().catch(console.error)

