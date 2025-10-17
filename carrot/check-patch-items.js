require('dotenv').config({path:'.env.local'});
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPatch() {
  const patch = await prisma.patch.findUnique({
    where: { handle: 'chicago-bulls' },
    select: { id: true, name: true }
  });
  
  if (!patch) {
    console.log('❌ Patch not found');
    return;
  }
  
  console.log(`✅ Found patch: ${patch.name}`);
  
  const items = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      status: true,
      mediaAssets: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  console.log(`\n📊 Total items in patch: ${items.length}\n`);
  
  items.forEach((item, i) => {
    const hasHero = item.mediaAssets?.hero ? '✅' : '❌';
    console.log(`${i+1}. ${hasHero} [${item.status}] ${item.title.substring(0, 60)}`);
    if (item.mediaAssets?.hero) {
      console.log(`   Hero: ${item.mediaAssets.hero.substring(0, 80)}...`);
    }
  });
  
  await prisma.$disconnect();
}

checkPatch().catch(console.error);

