#!/usr/bin/env tsx
/**
 * Check Citation Titles
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkCitationTitles(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  const citations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved'
    },
    select: {
      id: true,
      citationTitle: true,
      citationUrl: true
    },
    take: 10
  })

  console.log(`\n📋 Checking citation titles for ${citations.length} saved citations:\n`)

  let hasTitle = 0
  let noTitle = 0

  citations.forEach((citation, i) => {
    const hasTitleValue = citation.citationTitle && citation.citationTitle !== 'Untitled' && citation.citationTitle.length > 0
    if (hasTitleValue) hasTitle++
    else noTitle++

    console.log(`${i + 1}. ${citation.citationTitle || '(null)'}`)
    console.log(`   URL: ${citation.citationUrl.substring(0, 70)}...`)
    console.log(`   Status: ${hasTitleValue ? '✅ Has title' : '⚠️  No title'}`)
    console.log()
  })

  console.log(`\n📊 Summary:`)
  console.log(`   Total: ${citations.length}`)
  console.log(`   With titles: ${hasTitle}`)
  console.log(`   Without titles: ${noTitle}`)

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

checkCitationTitles(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

