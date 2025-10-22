const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSpecificItem() {
  const itemId = 'cmh09ajs60061u12beocsu9js'; // The item that was clicked
  
  const item = await prisma.discoveredContent.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      title: true,
      metadata: true,
    },
  });

  if (!item) {
    console.error('Item not found');
    return;
  }

  console.log('Item details:');
  console.log(`- ID: ${item.id}`);
  console.log(`- Title: ${item.title}`);
  console.log(`- contentUrl: ${item.metadata?.contentUrl || 'undefined'}`);
  console.log(`- urlSlug: ${item.metadata?.urlSlug || 'undefined'}`);
}

checkSpecificItem()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
