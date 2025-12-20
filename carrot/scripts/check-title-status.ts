/**
 * Check title status in database
 */

import { prisma } from '@/lib/prisma'

async function checkTitleStatus() {
  const poorTitles = ['10.1017/chol9780521772488.005', 'book part', 'Untitled']
  
  for (const poorTitle of poorTitles) {
    const items = await prisma.discoveredContent.findMany({
      where: { title: poorTitle },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        sourceUrl: true
      }
    })
    
    console.log(`\n"${poorTitle}": ${items.length} items`)
    items.slice(0, 5).forEach(item => {
      console.log(`  ${item.id}: updated ${item.updatedAt.toISOString()}`)
    })
  }
}

checkTitleStatus().catch(console.error)

