/**
 * Check MediaAssets Structure
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMediaAssets() {
  console.log('🔍 Checking mediaAssets structure...\n');

  const items = await prisma.discoveredContent.findMany({
    where: { 
      patchId: 'cmgnz2p5l0001qe29l4ziitf7',
      status: 'ready'
    },
    select: {
      id: true,
      title: true,
      mediaAssets: true
    },
    take: 3
  });

  console.log('MediaAssets for first 3 items:');
  items.forEach((item, idx) => {
    console.log(`\n${idx + 1}. ${item.title}`);
    console.log('MediaAssets:', JSON.stringify(item.mediaAssets, null, 2));
  });

  await prisma.$disconnect();
}

checkMediaAssets().catch(console.error);
