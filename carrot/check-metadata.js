const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMetadata() {
  console.log('Checking metadata for Chicago Bulls content...');
  
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
    take: 5
  });

  console.log(`Found ${items.length} items:`);
  items.forEach(item => {
    const metadata = item.metadata || {};
    console.log(`- ID: ${item.id}`);
    console.log(`  Title: ${item.title}`);
    console.log(`  contentUrl: ${metadata.contentUrl || 'undefined'}`);
    console.log(`  urlSlug: ${metadata.urlSlug || 'undefined'}`);
    console.log('');
  });
}

checkMetadata()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
