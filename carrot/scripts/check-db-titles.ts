/**
 * Check title status in database
 */

import { prisma } from '@/lib/prisma'

async function checkTitles() {
  const items = await prisma.discoveredContent.findMany({
    where: {
      OR: [
        { title: { contains: 'doi.org' } },
        { title: { contains: 'cambridge.org' } },
        { title: 'Untitled' }
      ]
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      sourceUrl: true
    },
    take: 20
  })
  
  console.log(`Found ${items.length} items with poor titles:`)
  items.forEach(item => {
    console.log(`  ${item.id}: "${item.title}" (updated: ${item.updatedAt.toISOString()})`)
  })
}

checkTitles().catch(console.error)

