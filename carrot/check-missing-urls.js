const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMissingUrls() {
  console.log('Checking for items without content URLs...');
  
  const chicagoBullsPatch = await prisma.patch.findUnique({
    where: { handle: 'chicago-bulls' },
  });

  if (!chicagoBullsPatch) {
    console.error('Chicago Bulls patch not found.');
    return;
  }

  const items = await prisma.discoveredContent.findMany({
    where: {
      patchId: chicagoBullsPatch.id,
    },
    select: {
      id: true,
      title: true,
      metadata: true,
    },
  });

  const itemsWithoutUrls = items.filter(item => {
    const metadata = item.metadata || {};
    return !metadata.contentUrl || !metadata.urlSlug;
  });

  console.log(`Total items: ${items.length}`);
  console.log(`Items without content URLs: ${itemsWithoutUrls.length}`);
  
  if (itemsWithoutUrls.length > 0) {
    console.log('\nItems missing content URLs:');
    itemsWithoutUrls.forEach(item => {
      console.log(`- ID: ${item.id}`);
      console.log(`  Title: ${item.title}`);
      console.log(`  contentUrl: ${item.metadata?.contentUrl || 'undefined'}`);
      console.log(`  urlSlug: ${item.metadata?.urlSlug || 'undefined'}`);
      console.log('');
    });
  }
}

checkMissingUrls()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
