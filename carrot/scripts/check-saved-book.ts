/**
 * Check what was saved for the Israel Rising book
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkBook() {
  try {
    const book = await prisma.discoveredContent.findFirst({
      where: {
        title: {
          contains: 'Israel Rising'
        }
      },
      select: {
        id: true,
        title: true,
        summary: true,
        textContent: true,
        content: true,
        metadata: true,
        createdAt: true
      }
    })
    
    if (!book) {
      console.log('Book not found')
      return
    }
    
    console.log('=== SAVED BOOK DATA ===\n')
    console.log(`ID: ${book.id}`)
    console.log(`Title: ${book.title}`)
    console.log(`Created: ${book.createdAt}`)
    console.log(`\nSummary length: ${book.summary?.length || 0} chars`)
    console.log(`TextContent length: ${book.textContent?.length || 0} chars`)
    console.log(`Content length: ${book.content?.length || 0} chars`)
    console.log(`\nSummary (first 200 chars):`)
    console.log(book.summary?.substring(0, 200) || 'None')
    console.log(`\nTextContent (first 200 chars):`)
    console.log(book.textContent?.substring(0, 200) || 'None')
    console.log(`\nContent (first 200 chars):`)
    console.log(book.content?.substring(0, 200) || 'None')
    console.log(`\nMetadata:`)
    console.log(JSON.stringify(book.metadata, null, 2))
    
    // Calculate total characters saved
    const totalChars = (book.summary?.length || 0) + 
                      (book.textContent?.length || 0) + 
                      (book.content?.length || 0)
    console.log(`\n=== TOTAL CHARACTERS SAVED ===`)
    console.log(`Total: ${totalChars} chars`)
    console.log(`  - Summary: ${book.summary?.length || 0} chars`)
    console.log(`  - TextContent: ${book.textContent?.length || 0} chars`)
    console.log(`  - Content: ${book.content?.length || 0} chars`)
    
  } catch (error: any) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkBook().catch(console.error)

