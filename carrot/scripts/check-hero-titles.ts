#!/usr/bin/env tsx
/**
 * Check Hero Titles
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTitles(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  const items = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  console.log(`\n📋 Checking titles for ${items.length} items:\n`)

  let untitledCount = 0
  let emptyTitleCount = 0
  let nullTitleCount = 0

  items.forEach((item, i) => {
    const isUntitled = item.title === 'Untitled' || item.title === 'Untitled Content'
    const isEmpty = item.title === ''
    const isNull = item.title === null

    if (isUntitled) untitledCount++
    if (isEmpty) emptyTitleCount++
    if (isNull) nullTitleCount++

    console.log(`${i + 1}. ${item.title || '(null)'}`)
    console.log(`   URL: ${item.sourceUrl?.substring(0, 60)}...`)
    console.log(`   Status: ${isUntitled ? '⚠️  Untitled' : isEmpty ? '⚠️  Empty' : isNull ? '⚠️  Null' : '✅ Has title'}`)
    console.log()
  })

  console.log(`\n📊 Summary:`)
  console.log(`   Total checked: ${items.length}`)
  console.log(`   Untitled: ${untitledCount}`)
  console.log(`   Empty: ${emptyTitleCount}`)
  console.log(`   Null: ${nullTitleCount}`)
  console.log(`   Valid titles: ${items.length - untitledCount - emptyTitleCount - nullTitleCount}`)

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

checkTitles(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

