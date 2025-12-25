/**
 * Extract 10 books from Anna's Archive related to Israel
 * Ensures heroes are created and audits the results
 */

import 'dotenv/config'
import { extractBookContent } from './extract-annas-archive-book'
import { searchAnnasArchive } from '../src/lib/discovery/annasArchiveSource'
import { PrismaClient } from '@prisma/client'
import { upsertHero } from '../src/lib/discovery/heroUpsert'
import * as fs from 'fs/promises'
import * as path from 'path'

const prisma = new PrismaClient()

// Progress logging
const progressFile = path.join(process.cwd(), 'data', 'extraction-progress.log')
async function logProgress(message: string) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  await fs.appendFile(progressFile, logMessage).catch(() => {})
  console.log(message)
}

interface BookResult {
  title: string
  url: string
  extracted: boolean
  contentLength: number
  pdfDownloaded: boolean
  pdfPath?: string
  pdfSize?: number
  heroCreated: boolean
  heroId?: string
  error?: string
}

async function extract10IsraelBooks() {
  // Clear progress file
  await fs.writeFile(progressFile, '').catch(() => {})
  
  await logProgress('='.repeat(80))
  await logProgress('EXTRACTING 10 ISRAEL BOOKS FROM ANNA\'S ARCHIVE')
  await logProgress('='.repeat(80))
  await logProgress('')
  
  const results: BookResult[] = []
  const skipUrls: string[] = []
  
  try {
    // Step 1: Search for Israel books
    await logProgress('📚 STEP 1: Searching for Israel books...')
    const searchResults = await searchAnnasArchive({
      query: 'Israel',
      limit: 50
    })
    
    if (!searchResults || searchResults.length === 0) {
      await logProgress('❌ No search results found')
      return
    }
    
    await logProgress(`Found ${searchResults.length} results`)
    await logProgress('')
    
    // Step 2: Process up to 10 books
    console.log('📥 STEP 2: Extracting books (up to 10)...\n')
    console.log('⏳ This will take several minutes - extracting PDFs and creating heroes...\n')
    
    let processed = 0
    const targetCount = 10
    
    for (const book of searchResults) {
      if (processed >= targetCount) {
        break
      }
      
      // Skip if we've already processed this URL
      if (skipUrls.includes(book.url)) {
        continue
      }
      
      // Check if we already have this book with substantial content
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
          select: { 
            id: true, 
            title: true, 
            textContent: true,
            content: true
          }
        })
        
        if (existing && existing.textContent && existing.textContent.length > 1000) {
          console.log(`⏭️  [${processed + 1}/${targetCount}] Skipping: "${book.title}" (already has ${existing.textContent.length} chars)`)
          continue
        }
      } catch (dbError) {
        // Continue if DB check fails
      }
      
      processed++
      console.log(`\n${'─'.repeat(80)}`)
      console.log(`📖 [${processed}/${targetCount}] Processing: "${book.title}"`)
      console.log(`   URL: ${book.url}`)
      console.log(`   Author: ${book.author || 'Unknown'}`)
      console.log(`   ⏳ Starting extraction...`)
      console.log()
      
      const result: BookResult = {
        title: book.title,
        url: book.url,
        extracted: false,
        contentLength: 0,
        pdfDownloaded: false,
        heroCreated: false
      }
      
      try {
        // Extract book content
        const startTime = Date.now()
        const extractedContent = await extractBookContent(book.url)
        const duration = Date.now() - startTime
        
        if (extractedContent) {
          result.extracted = true
          result.contentLength = extractedContent.length
          console.log(`   ✅ Content extracted: ${extractedContent.length} chars (${(duration / 1000).toFixed(1)}s)`)
        } else {
          console.log(`   ⚠️  No content extracted`)
        }
        
        // Check for PDF file
        const md5Match = book.url.match(/\/md5\/([a-f0-9]{32})/i)
        const identifierMatch = book.url.match(/\/details\/([^\/]+)/)
        
        if (identifierMatch) {
          const identifier = identifierMatch[1]
          const pdfPath = path.join(process.cwd(), 'data', 'pdfs', `${identifier}.pdf`)
          
          try {
            const stats = await fs.stat(pdfPath)
            result.pdfDownloaded = true
            result.pdfPath = pdfPath
            result.pdfSize = stats.size
            console.log(`   ✅ PDF found: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
          } catch (e) {
            // PDF doesn't exist
          }
        }
        
        // Check database entry and create hero if needed
        try {
          const dbEntry = await prisma.discoveredContent.findFirst({
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
              title: true,
              textContent: true,
              summary: true,
              canonicalUrl: true,
              patchId: true
            }
          })
          
          if (dbEntry) {
            console.log(`   ✅ Database entry found: ${dbEntry.id}`)
            
            // Check if hero exists
            const existingHero = await prisma.hero.findUnique({
              where: { contentId: dbEntry.id },
              select: { id: true, status: true }
            })
            
            if (existingHero) {
              result.heroCreated = true
              result.heroId = existingHero.id
              console.log(`   ✅ Hero already exists: ${existingHero.id} (status: ${existingHero.status})`)
            } else {
              // Create hero if we have substantial content
              if (dbEntry.textContent && dbEntry.textContent.length > 500) {
                try {
                  const patch = await prisma.patch.findUnique({
                    where: { handle: 'israel' },
                    select: { id: true }
                  })
                  
                  if (patch) {
                    const heroResult = await upsertHero({
                      patchId: patch.id,
                      contentId: dbEntry.id,
                      url: dbEntry.canonicalUrl || book.url,
                      canonicalUrl: dbEntry.canonicalUrl || book.url,
                      title: dbEntry.title,
                      summary: dbEntry.summary || dbEntry.textContent.substring(0, 500),
                      sourceDomain: new URL(book.url).hostname,
                      extractedText: dbEntry.textContent,
                      traceId: `annas-archive-${Date.now()}`
                    })
                    
                    result.heroCreated = heroResult.created
                    result.heroId = heroResult.heroId
                    console.log(`   ✅ Hero ${heroResult.created ? 'created' : 'exists'}: ${heroResult.heroId}`)
                  } else {
                    console.log(`   ⚠️  Patch "israel" not found, skipping hero creation`)
                  }
                } catch (heroError: any) {
                  console.log(`   ⚠️  Hero creation failed: ${heroError.message}`)
                  result.error = `Hero creation: ${heroError.message}`
                }
              } else {
                console.log(`   ⏭️  Skipping hero creation (content too short: ${dbEntry.textContent?.length || 0} chars)`)
              }
            }
          } else {
            console.log(`   ⚠️  No database entry found after extraction`)
          }
        } catch (dbError: any) {
          console.log(`   ⚠️  Database check failed: ${dbError.message}`)
          result.error = `Database: ${dbError.message}`
        }
        
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`)
        result.error = error.message
      }
      
      results.push(result)
      skipUrls.push(book.url)
      
      // Small delay between books
      if (processed < targetCount) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }
    
    // Step 3: Audit results
    console.log('\n' + '='.repeat(80))
    console.log('AUDIT RESULTS')
    console.log('='.repeat(80))
    console.log()
    
    const successful = results.filter(r => r.extracted && r.contentLength > 500)
    const withPdfs = results.filter(r => r.pdfDownloaded)
    const withHeroes = results.filter(r => r.heroCreated)
    
    console.log(`📊 SUMMARY:`)
    console.log(`   Total processed: ${results.length}`)
    console.log(`   Successfully extracted: ${successful.length} (${(successful.length / results.length * 100).toFixed(1)}%)`)
    console.log(`   PDFs downloaded: ${withPdfs.length} (${(withPdfs.length / results.length * 100).toFixed(1)}%)`)
    console.log(`   Heroes created: ${withHeroes.length} (${(withHeroes.length / results.length * 100).toFixed(1)}%)`)
    console.log()
    
    console.log(`📚 DETAILED RESULTS:`)
    results.forEach((result, idx) => {
      console.log(`\n${idx + 1}. "${result.title}"`)
      console.log(`   URL: ${result.url}`)
      console.log(`   Content: ${result.extracted ? `✅ ${result.contentLength} chars` : '❌ None'}`)
      console.log(`   PDF: ${result.pdfDownloaded ? `✅ ${(result.pdfSize! / 1024 / 1024).toFixed(2)} MB` : '❌ Not found'}`)
      console.log(`   Hero: ${result.heroCreated ? `✅ ${result.heroId}` : '❌ Not created'}`)
      if (result.error) {
        console.log(`   Error: ⚠️  ${result.error}`)
      }
    })
    
    // Step 4: Check PDF directory
    console.log(`\n📁 PDF DIRECTORY:`)
    const pdfDir = path.join(process.cwd(), 'data', 'pdfs')
    const pdfFiles = await fs.readdir(pdfDir).catch(() => [])
    console.log(`   Total PDFs: ${pdfFiles.length}`)
    
    const recentPdfs = []
    for (const pdf of pdfFiles) {
      const pdfPath = path.join(pdfDir, pdf)
      const stats = await fs.stat(pdfPath)
      const ageMinutes = (Date.now() - stats.mtime.getTime()) / 1000 / 60
      if (ageMinutes < 60) {
        recentPdfs.push({ name: pdf, size: stats.size, age: ageMinutes })
      }
    }
    
    if (recentPdfs.length > 0) {
      console.log(`   Recently downloaded (last hour):`)
      recentPdfs.forEach(pdf => {
        console.log(`      - ${pdf.name} (${(pdf.size / 1024 / 1024).toFixed(2)} MB, ${pdf.age.toFixed(1)} min ago)`)
      })
    }
    
    // Step 5: Check heroes in database
    console.log(`\n🎨 HEROES IN DATABASE:`)
    try {
      const patch = await prisma.patch.findUnique({
        where: { handle: 'israel' },
        select: { id: true }
      })
      
      if (patch) {
        const heroes = await prisma.hero.findMany({
          where: {
            content: {
              patchId: patch.id,
              sourceUrl: { contains: 'annas-archive.org' }
            }
          },
          select: {
            id: true,
            title: true,
            status: true,
            imageUrl: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        })
        
        console.log(`   Found ${heroes.length} heroes from Anna's Archive`)
        heroes.forEach((hero, idx) => {
          console.log(`   ${idx + 1}. ${hero.title}`)
          console.log(`      ID: ${hero.id}`)
          console.log(`      Status: ${hero.status}`)
          console.log(`      Image: ${hero.imageUrl ? '✅' : '❌'}`)
          console.log(`      Created: ${hero.createdAt.toISOString()}`)
        })
      }
    } catch (dbError: any) {
      console.log(`   ⚠️  Database check failed: ${dbError.message}`)
    }
    
    console.log('\n' + '='.repeat(80))
    console.log('✅ EXTRACTION COMPLETE')
    console.log('='.repeat(80))
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

extract10IsraelBooks().catch(console.error)

