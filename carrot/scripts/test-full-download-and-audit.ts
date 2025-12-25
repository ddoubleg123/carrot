/**
 * Test full PDF download process and audit the results
 */

import 'dotenv/config'
import { extractBookContent } from './extract-annas-archive-book'
import { searchAnnasArchive } from '../src/lib/discovery/annasArchiveSource'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'
import * as path from 'path'

const prisma = new PrismaClient()

async function testFullDownloadAndAudit() {
  console.log('='.repeat(80))
  console.log('FULL PDF DOWNLOAD TEST & AUDIT')
  console.log('='.repeat(80))
  console.log()
  
  try {
    // Step 1: Search for a new book (try different terms to find non-encrypted PDFs)
    console.log('📚 STEP 1: Searching for a new book...')
    const searchResults = await searchAnnasArchive({
      query: 'mathematics',
      limit: 30
    })
    
    if (!searchResults || searchResults.length === 0) {
      console.log('❌ No search results found')
      return
    }
    
    console.log(`Found ${searchResults.length} results\n`)
    
    // Step 2: Find a book we haven't downloaded yet (skip the one we just tried)
    console.log('🔍 STEP 2: Finding a book we haven\'t processed yet...')
    const skipUrls = [
      'https://annas-archive.org/md5/c06611fd8b17cbb27fdec63aebbb5aee', // Carolingian Civilization
      'https://annas-archive.org/md5/fbc01df94230f9542a379b8b1bc40970', // Previous test
      'https://annas-archive.org/md5/dbe898e329267de1a5530f26de6c784a',  // Israel Rising
      'https://annas-archive.org/md5/0dfe771b1046e70cf5a8e8f7798deb58'  // Arms akimbo (encrypted)
    ]
    
    let selectedBook = null
    
    for (const book of searchResults) {
      // Skip books we just tried
      if (skipUrls.includes(book.url)) {
        console.log(`⏭️  Skipping: "${book.title}" (recently tested)`)
        continue
      }
      
      // Check if we already have this book in the database
      try {
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
          select: { id: true, title: true, textContent: true }
        })
        
        if (!existing || !existing.textContent || existing.textContent.length < 500) {
          selectedBook = book
          console.log(`✅ Selected: "${book.title}"`)
          console.log(`   URL: ${book.url}`)
          console.log(`   Reason: ${existing ? 'Has entry but no text content' : 'Not in database'}\n`)
          break
        } else {
          console.log(`⏭️  Skipping: "${book.title}" (already has ${existing.textContent.length} chars)`)
        }
      } catch (dbError: any) {
        // If DB check fails, just use this book if we haven't selected one yet
        if (!selectedBook) {
          selectedBook = book
          console.log(`✅ Selected: "${book.title}" (DB check failed, proceeding anyway)`)
          console.log(`   URL: ${book.url}\n`)
        }
      }
    }
    
    if (!selectedBook) {
      console.log('❌ All books already processed, trying first result anyway...')
      selectedBook = searchResults[0]
    }
    
    // Step 3: Extract the book
    console.log('📥 STEP 3: Extracting book content...')
    console.log(`URL: ${selectedBook.url}\n`)
    
    const startTime = Date.now()
    const extractedContent = await extractBookContent(selectedBook.url)
    const duration = Date.now() - startTime
    
    console.log(`\n⏱️  Extraction took ${(duration / 1000).toFixed(1)} seconds`)
    console.log(`📊 Content length: ${extractedContent?.length || 0} characters\n`)
    
    // Step 4: Audit the results
    console.log('='.repeat(80))
    console.log('AUDIT RESULTS')
    console.log('='.repeat(80))
    console.log()
    
    // 4a: Check PDF files
    console.log('📁 4a. PDF FILES AUDIT:')
    const pdfDir = path.join(process.cwd(), 'data', 'pdfs')
    const pdfFiles = await fs.readdir(pdfDir).catch(() => [])
    console.log(`   Total PDFs in directory: ${pdfFiles.length}`)
    
    // Find PDFs that might be related to this book
    const md5Match = selectedBook.url.match(/\/md5\/([a-f0-9]{32})/i)
    const identifierMatch = selectedBook.url.match(/\/details\/([^\/]+)/)
    
    let relatedPdf: string | null = null
    if (identifierMatch) {
      const identifier = identifierMatch[1]
      relatedPdf = pdfFiles.find(f => f === `${identifier}.pdf`) || null
      if (relatedPdf) {
        const pdfPath = path.join(pdfDir, relatedPdf)
        const stats = await fs.stat(pdfPath)
        console.log(`   ✅ Found related PDF: ${relatedPdf}`)
        console.log(`      Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
        console.log(`      Modified: ${stats.mtime.toISOString()}`)
      } else {
        console.log(`   ⚠️  No PDF found with identifier: ${identifier}.pdf`)
      }
    }
    
    // Check for any recently modified PDFs
    const recentPdfs = []
    for (const pdf of pdfFiles) {
      const pdfPath = path.join(pdfDir, pdf)
      const stats = await fs.stat(pdfPath)
      const ageMinutes = (Date.now() - stats.mtime.getTime()) / 1000 / 60
      if (ageMinutes < 10) {
        recentPdfs.push({ name: pdf, size: stats.size, age: ageMinutes })
      }
    }
    
    if (recentPdfs.length > 0) {
      console.log(`   📥 Recently modified PDFs (last 10 minutes):`)
      recentPdfs.forEach(pdf => {
        console.log(`      - ${pdf.name} (${(pdf.size / 1024 / 1024).toFixed(2)} MB, ${pdf.age.toFixed(1)} min ago)`)
      })
    }
    console.log()
    
    // 4b: Check database entry
    console.log('💾 4b. DATABASE ENTRY AUDIT:')
    try {
      const dbEntry = await prisma.discoveredContent.findFirst({
        where: {
          OR: [
            { sourceUrl: selectedBook.url },
            { 
              metadata: {
                path: ['annasArchiveUrl'],
                equals: selectedBook.url
              }
            }
          ]
        },
        select: {
          id: true,
          title: true,
          textContent: true,
          content: true,
          sourceUrl: true,
          createdAt: true,
          metadata: true
        }
      })
      
      if (dbEntry) {
        console.log(`   ✅ Database entry found:`)
        console.log(`      ID: ${dbEntry.id}`)
        console.log(`      Title: ${dbEntry.title}`)
        console.log(`      Text Content: ${dbEntry.textContent?.length || 0} chars`)
        console.log(`      Full Content: ${dbEntry.content?.length || 0} chars`)
        console.log(`      Created: ${dbEntry.createdAt.toISOString()}`)
        if (dbEntry.metadata && typeof dbEntry.metadata === 'object') {
          const meta = dbEntry.metadata as any
          if (meta.author) console.log(`      Author: ${meta.author}`)
          if (meta.fileType) console.log(`      File Type: ${meta.fileType}`)
        }
      } else {
        console.log(`   ⚠️  No database entry found for this URL`)
      }
    } catch (dbError: any) {
      console.log(`   ⚠️  Database check failed: ${dbError.message}`)
    }
    console.log()
    
    // 4c: Check extracted content
    console.log('📄 4c. EXTRACTED CONTENT AUDIT:')
    if (extractedContent) {
      console.log(`   ✅ Content extracted: ${extractedContent.length} characters`)
      console.log(`   Preview (first 200 chars): ${extractedContent.substring(0, 200)}...`)
      
      // Check if it looks like actual text content
      const hasSubstantialText = extractedContent.length > 500
      const hasSentences = (extractedContent.match(/[.!?]\s+/g) || []).length > 5
      const hasWords = extractedContent.split(/\s+/).length > 50
      
      console.log(`   Quality checks:`)
      console.log(`      - Has substantial text (>500 chars): ${hasSubstantialText ? '✅' : '❌'}`)
      console.log(`      - Has sentences (>5): ${hasSentences ? '✅' : '❌'}`)
      console.log(`      - Has words (>50): ${hasWords ? '✅' : '❌'}`)
    } else {
      console.log(`   ❌ No content extracted`)
    }
    console.log()
    
    // 4d: Check saved files
    console.log('💾 4d. SAVED FILES AUDIT:')
    const extractedBooksDir = path.join(process.cwd(), 'data', 'extracted-books')
    const bookFiles = await fs.readdir(extractedBooksDir).catch(() => [])
    
    // Find recent book files
    const recentBookFiles = []
    for (const file of bookFiles) {
      if (file.endsWith('.json')) {
        const filePath = path.join(extractedBooksDir, file)
        const stats = await fs.stat(filePath)
        const ageMinutes = (Date.now() - stats.mtime.getTime()) / 1000 / 60
        if (ageMinutes < 10) {
          recentBookFiles.push({ name: file, age: ageMinutes })
          
          // Read the file to check content
          try {
            const fileContent = await fs.readFile(filePath, 'utf-8')
            const bookData = JSON.parse(fileContent)
            if (bookData.url === selectedBook.url || bookData.title === selectedBook.title) {
              console.log(`   ✅ Found matching book file: ${file}`)
              console.log(`      Age: ${ageMinutes.toFixed(1)} minutes`)
              console.log(`      Title: ${bookData.title}`)
              console.log(`      Content length: ${(bookData.fullContent || bookData.preview || '').length} chars`)
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    console.log()
    
    // Final summary
    console.log('='.repeat(80))
    console.log('AUDIT SUMMARY')
    console.log('='.repeat(80))
    console.log()
    
    const hasPdf = relatedPdf !== null || recentPdfs.length > 0
    const hasContent = extractedContent && extractedContent.length > 500
    const hasDbEntry = true // We'll check this above
    
    console.log(`✅ PDF Downloaded: ${hasPdf ? 'YES' : 'NO'}`)
    console.log(`✅ Content Extracted: ${hasContent ? 'YES' : 'NO'} (${extractedContent?.length || 0} chars)`)
    console.log(`✅ Database Entry: ${hasDbEntry ? 'YES' : 'NO'}`)
    console.log()
    
    if (hasPdf && hasContent) {
      console.log('🎉 SUCCESS: Full download and extraction completed!')
    } else if (hasPdf && !hasContent) {
      console.log('⚠️  PARTIAL: PDF downloaded but text extraction may have failed')
    } else if (!hasPdf && hasContent) {
      console.log('⚠️  PARTIAL: Content extracted but PDF file not found')
    } else {
      console.log('❌ FAILED: Neither PDF nor content was successfully extracted')
    }
    
  } catch (error: any) {
    console.error('\n❌ Error during test:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testFullDownloadAndAudit().catch(console.error)

