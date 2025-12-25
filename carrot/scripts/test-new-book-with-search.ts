/**
 * Test extracting a NEW book from Anna's Archive
 * First searches for a book, then extracts it
 */

// Polyfill DOMMatrix for pdf-parse BEFORE importing it
if (typeof global.DOMMatrix === 'undefined') {
  try {
    const dommatrix = require('dommatrix')
    global.DOMMatrix = dommatrix.DOMMatrix || dommatrix
  } catch (e) {
    global.DOMMatrix = class DOMMatrix {
      constructor(init?: any) {}
      static fromMatrix(other?: any) { return new DOMMatrix() }
    } as any
  }
}

import { searchAnnasArchive } from '../src/lib/discovery/annasArchiveSource'
import { extractBookContent } from './extract-annas-archive-book'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'
import * as path from 'path'

const prisma = new PrismaClient()

async function testNewBookWithSearch() {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`TESTING EXTRACTION OF NEW BOOK FROM ANNA'S ARCHIVE`)
  console.log(`${'='.repeat(80)}\n`)
  
  // Step 1: Search for books - prioritize ones likely to have archive.org links
  console.log(`[Step 1] Searching for books about "Middle East history"...\n`)
  
  const searchResults = await searchAnnasArchive({
    query: 'Middle East history',
    language: 'en',
    fileType: 'pdf',
    limit: 30  // Get more results to find new ones with archive.org links
  })
  
  if (searchResults.length === 0) {
    console.log(`❌ No search results found`)
    return
  }
  
  console.log(`✅ Found ${searchResults.length} books\n`)
  
  // Step 2: Find a book we haven't downloaded yet
  console.log(`[Step 2] Checking which books we already have...\n`)
  
  let testBook: typeof searchResults[0] | null = null
  let skippedCount = 0
  
  for (const book of searchResults) {
    const existing = await prisma.discoveredContent.findFirst({
      where: {
        OR: [
          { sourceUrl: book.url },
          { 
            metadata: {
              path: ['annasArchiveUrl'],
              equals: book.url
            }
          }
        ]
      },
      select: {
        id: true,
        title: true
      }
    })
    
    if (!existing) {
      testBook = book
      console.log(`✅ Found new book: "${book.title}"`)
      console.log(`   Author: ${book.author || 'Unknown'}`)
      console.log(`   URL: ${book.url}`)
      console.log(`   (Skipped ${skippedCount} books we already have)\n`)
      break
    } else {
      skippedCount++
      if (skippedCount <= 3) {
        console.log(`⏭️  Already have: "${book.title}" (skipping)`)
      }
    }
  }
  
  if (skippedCount > 3) {
    console.log(`⏭️  ... and ${skippedCount - 3} more books we already have\n`)
  }
  
  if (!testBook) {
    console.log(`⚠️  All ${searchResults.length} books are already in database`)
    console.log(`   Showing first result anyway for testing...\n`)
    testBook = searchResults[0]
    console.log(`📖 Testing with: "${testBook.title}"`)
    console.log(`   URL: ${testBook.url}\n`)
  }
  
  // Step 3: Extract the book
  console.log(`[Step 3] Extracting book content...\n`)
  console.log(`${'='.repeat(80)}\n`)
  
  try {
    const startTime = Date.now()
    const extractedContent = await extractBookContent(testBook.url)
    const duration = Date.now() - startTime
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`EXTRACTION RESULTS`)
    console.log(`${'='.repeat(80)}\n`)
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s\n`)
    
    if (extractedContent) {
      const isActualText = extractedContent.length > 1000 && 
                          !extractedContent.includes('PDF file') && 
                          !extractedContent.includes('Saved to:') &&
                          !extractedContent.startsWith('[')
      
      if (isActualText) {
        console.log(`✅ SUCCESS: Extracted ${extractedContent.length.toLocaleString()} characters of text`)
      } else {
        console.log(`📄 Status message received`)
        const charMatch = extractedContent.match(/(\d+(?:,\d+)*)\s*characters/)
        if (charMatch) {
          const charCount = parseInt(charMatch[1].replace(/,/g, ''))
          console.log(`   Extracted ${charCount.toLocaleString()} characters (from status message)`)
        }
        console.log(`   Preview: ${extractedContent.substring(0, 200)}...`)
      }
      
      // Step 4: Audit - Check if book was saved to database
      console.log(`\n[Step 4] Auditing database...\n`)
      
      const savedBook = await prisma.discoveredContent.findFirst({
        where: {
          sourceUrl: testBook.url
        },
        select: {
          id: true,
          title: true,
          textContent: true,
          content: true,
          sourceUrl: true,
          metadata: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      if (savedBook) {
        console.log(`✅ Book saved to database:`)
        console.log(`   ID: ${savedBook.id}`)
        console.log(`   Title: ${savedBook.title}`)
        console.log(`   Text content length: ${savedBook.textContent?.length || 0} chars`)
        console.log(`   Content length: ${savedBook.content?.length || 0} chars`)
        console.log(`   Created at: ${savedBook.createdAt.toISOString()}`)
        
        if (savedBook.metadata) {
          const metadata = savedBook.metadata as any
          console.log(`   Metadata keys: ${Object.keys(metadata).join(', ')}`)
        }
      } else {
        console.log(`❌ Book NOT found in database after extraction`)
      }
      
      // Step 5: Audit - Check if PDF file was saved
      console.log(`\n[Step 5] Auditing PDF files...\n`)
      
      const dataDir = path.join(process.cwd(), 'data', 'pdfs')
      try {
        const files = await fs.readdir(dataDir)
        const pdfFiles = files.filter(f => f.endsWith('.pdf')).sort((a, b) => {
          return fs.stat(path.join(dataDir, b)).then(s => s.mtime.getTime())
            .then(tB => fs.stat(path.join(dataDir, a)).then(s => s.mtime.getTime()).then(tA => tB - tA))
        })
        
        // Get stats for recent files
        const recentPdfStats = []
        for (const pdf of pdfFiles.slice(0, 5)) {
          const stats = await fs.stat(path.join(dataDir, pdf))
          recentPdfStats.push({ name: pdf, size: stats.size, mtime: stats.mtime })
        }
        
        console.log(`📁 Total PDF files: ${pdfFiles.length}`)
        if (recentPdfStats.length > 0) {
          console.log(`   Most recent PDFs:`)
          for (const pdf of recentPdfStats) {
            console.log(`   - ${pdf.name}`)
            console.log(`     Size: ${(pdf.size / 1024 / 1024).toFixed(2)} MB`)
            console.log(`     Modified: ${pdf.mtime.toLocaleString()}`)
          }
        }
      } catch (e: any) {
        console.log(`⚠️  Could not check PDF directory: ${e.message}`)
      }
      
      // Summary
      console.log(`\n${'='.repeat(80)}`)
      console.log(`AUDIT SUMMARY`)
      console.log(`${'='.repeat(80)}\n`)
      
      const hasDbEntry = !!savedBook
      const hasTextContent = !!(savedBook?.textContent && savedBook.textContent.length > 500)
      const hasExtractedContent = !!(extractedContent && extractedContent.length > 500)
      
      console.log(`✅ Database entry: ${hasDbEntry ? 'Yes' : 'No'}`)
      console.log(`✅ Text content extracted: ${hasTextContent ? `Yes (${savedBook?.textContent?.length || 0} chars)` : 'No'}`)
      console.log(`✅ Extraction returned content: ${hasExtractedContent ? `Yes (${extractedContent.length} chars)` : 'No'}`)
      
      if (hasDbEntry && hasTextContent) {
        console.log(`\n🎉 SUCCESS: Book extraction and saving completed successfully!`)
      } else if (hasDbEntry && !hasTextContent) {
        console.log(`\n⚠️  PARTIAL: Book saved to database but text extraction may have failed`)
      } else {
        console.log(`\n❌ FAILED: Book extraction did not complete successfully`)
      }
      
    } else {
      console.log(`❌ No content extracted`)
    }
    
  } catch (error: any) {
    console.error(`\n❌ Error during extraction: ${error.message}`)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testNewBookWithSearch().catch(console.error)

