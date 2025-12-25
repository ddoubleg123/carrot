/**
 * Test extracting a NEW book from Anna's Archive
 * This will verify the full extraction process works smoothly
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

import { extractBookContent } from './extract-annas-archive-book'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'
import * as path from 'path'

const prisma = new PrismaClient()

async function testNewBook() {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`TESTING EXTRACTION OF NEW BOOK FROM ANNA'S ARCHIVE`)
  console.log(`${'='.repeat(80)}\n`)
  
  // Use a different book related to Israel that we haven't downloaded yet
  const testBook = {
    title: "The Israel Lobby and U.S. Foreign Policy",
    url: "https://annas-archive.org/md5/e7891e1e0be97e7c52f9c7be4c8b9b9d"
  }
  
  console.log(`Book: ${testBook.title}`)
  console.log(`URL: ${testBook.url}\n`)
  
  // First, check if we already have this book
  const existing = await prisma.discoveredContent.findFirst({
    where: {
      OR: [
        { sourceUrl: testBook.url },
        { 
          metadata: {
            path: ['annasArchiveUrl'],
            equals: testBook.url
          }
        }
      ]
    },
    select: {
      id: true,
      title: true,
      textContent: true,
      sourceUrl: true
    }
  })
  
  if (existing) {
    console.log(`⚠️  Book already exists in database (ID: ${existing.id})`)
    console.log(`   Title: ${existing.title}`)
    console.log(`   Has text content: ${existing.textContent ? 'Yes (' + existing.textContent.length + ' chars)' : 'No'}`)
    
    // Try a different book
    console.log(`\n🔄 Trying a different book...`)
    const testBook2 = {
      title: "Six Days of War: June 1967 and the Making of the Modern Middle East",
      url: "https://annas-archive.org/md5/a3f8e9d0b1c2d4e5f6a7b8c9d0e1f2a3"
    }
    
    // Just use the first one for now
    console.log(`Proceeding with: ${testBook.title}\n`)
  } else {
    console.log(`✅ Book not found in database - proceeding with extraction\n`)
  }
  
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
        console.log(`📄 Status message received (not full text)`)
        console.log(`   Content preview: ${extractedContent.substring(0, 200)}...`)
      }
      
      // Check if book was saved to database
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
          metadata: true
        }
      })
      
      if (savedBook) {
        console.log(`\n✅ Book saved to database:`)
        console.log(`   ID: ${savedBook.id}`)
        console.log(`   Title: ${savedBook.title}`)
        console.log(`   Text content length: ${savedBook.textContent?.length || 0} chars`)
        console.log(`   Content length: ${savedBook.content?.length || 0} chars`)
      } else {
        console.log(`\n⚠️  Book NOT found in database after extraction`)
      }
      
      // Check if PDF file was saved
      const dataDir = path.join(process.cwd(), 'data', 'pdfs')
      try {
        const files = await fs.readdir(dataDir)
        const pdfFiles = files.filter(f => f.endsWith('.pdf'))
        console.log(`\n📁 PDF files in data/pdfs: ${pdfFiles.length}`)
        if (pdfFiles.length > 0) {
          console.log(`   Recent PDFs:`)
          for (const pdf of pdfFiles.slice(-5)) {
            const stats = await fs.stat(path.join(dataDir, pdf))
            console.log(`   - ${pdf} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${new Date(stats.mtime).toLocaleString()})`)
          }
        }
      } catch (e) {
        console.log(`\n📁 Could not check PDF directory: ${e}`)
      }
      
    } else {
      console.log(`❌ No content extracted`)
    }
    
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testNewBook().catch(console.error)

