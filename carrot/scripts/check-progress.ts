/**
 * Quick progress check for Anna's Archive extraction
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'
import * as path from 'path'

const prisma = new PrismaClient()

async function checkProgress() {
  console.log('='.repeat(80))
  console.log('PROGRESS CHECK: ANNA\'S ARCHIVE EXTRACTION')
  console.log('='.repeat(80))
  console.log()
  
  try {
    // Check database entries
    const bookCount = await prisma.discoveredContent.count({
      where: {
        sourceUrl: { contains: 'annas-archive.org' }
      }
    })
    
    console.log(`📚 Books in database: ${bookCount}`)
    
    // Check recent entries
    const recentBooks = await prisma.discoveredContent.findMany({
      where: {
        sourceUrl: { contains: 'annas-archive.org' }
      },
      select: {
        id: true,
        title: true,
        textContent: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    
    console.log(`\n📖 Recent books (last 10):`)
    recentBooks.forEach((book, idx) => {
      const contentLen = book.textContent?.length || 0
      const age = Math.round((Date.now() - book.createdAt.getTime()) / 1000 / 60)
      console.log(`   ${idx + 1}. ${book.title}`)
      console.log(`      Content: ${contentLen > 0 ? `${contentLen} chars` : 'None'}`)
      console.log(`      Age: ${age} minutes ago`)
    })
    
    // Check heroes
    const heroCount = await prisma.hero.count({
      where: {
        content: {
          sourceUrl: { contains: 'annas-archive.org' }
        }
      }
    })
    
    console.log(`\n🎨 Heroes created: ${heroCount}`)
    
    const recentHeroes = await prisma.hero.findMany({
      where: {
        content: {
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
      take: 10
    })
    
    console.log(`\n🎨 Recent heroes (last 10):`)
    recentHeroes.forEach((hero, idx) => {
      const age = Math.round((Date.now() - hero.createdAt.getTime()) / 1000 / 60)
      console.log(`   ${idx + 1}. ${hero.title}`)
      console.log(`      Status: ${hero.status}`)
      console.log(`      Image: ${hero.imageUrl ? '✅' : '❌'}`)
      console.log(`      Age: ${age} minutes ago`)
    })
    
    // Check PDFs
    const pdfDir = path.join(process.cwd(), 'data', 'pdfs')
    const pdfFiles = await fs.readdir(pdfDir).catch(() => [])
    
    console.log(`\n📁 PDF files: ${pdfFiles.length} total`)
    
    const recentPdfs = []
    for (const pdf of pdfFiles) {
      const pdfPath = path.join(pdfDir, pdf)
      const stats = await fs.stat(pdfPath)
      const ageMinutes = (Date.now() - stats.mtime.getTime()) / 1000 / 60
      if (ageMinutes < 120) { // Last 2 hours
        recentPdfs.push({ name: pdf, size: stats.size, age: ageMinutes })
      }
    }
    
    if (recentPdfs.length > 0) {
      console.log(`\n📥 Recently downloaded PDFs (last 2 hours):`)
      recentPdfs
        .sort((a, b) => b.age - a.age)
        .forEach((pdf, idx) => {
          console.log(`   ${idx + 1}. ${pdf.name}`)
          console.log(`      Size: ${(pdf.size / 1024 / 1024).toFixed(2)} MB`)
          console.log(`      Age: ${pdf.age.toFixed(1)} minutes ago`)
        })
    }
    
    console.log('\n' + '='.repeat(80))
    console.log('✅ Progress check complete')
    console.log('='.repeat(80))
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkProgress().catch(console.error)

