const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function generateUrlSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

function generateContentUrl(urlSlug) {
  return `/chicago-bulls/content/${urlSlug}`;
}

async function generateMissingUrls() {
  console.log('Generating content URLs for missing items...');
  
  const chicagoBullsPatch = await prisma.patch.findUnique({
    where: { handle: 'chicago-bulls' },
  });

  if (!chicagoBullsPatch) {
    console.error('Chicago Bulls patch not found.');
    return;
  }

  // Find items without content URLs
  const itemsWithoutUrls = await prisma.discoveredContent.findMany({
    where: {
      patchId: chicagoBullsPatch.id,
    },
    select: {
      id: true,
      title: true,
      metadata: true,
    },
  });

  // Filter items that don't have contentUrl or urlSlug
  const filteredItems = itemsWithoutUrls.filter(item => {
    const metadata = item.metadata || {};
    return !metadata.contentUrl || !metadata.urlSlug;
  });

  console.log(`Found ${filteredItems.length} items without content URLs`);

  let updated = 0;
  for (const item of filteredItems) {
    try {
      const urlSlug = generateUrlSlug(item.title);
      const contentUrl = generateContentUrl(urlSlug);
      
      const updatedMetadata = {
        ...(item.metadata || {}),
        contentUrl,
        urlSlug
      };

      await prisma.discoveredContent.update({
        where: { id: item.id },
        data: {
          metadata: updatedMetadata
        }
      });

      updated++;
      console.log(`✅ Updated: ${item.title.substring(0, 50)}...`);
    } catch (error) {
      console.error(`❌ Failed to update ${item.id}:`, error.message);
    }
  }

  console.log(`\n✅ Successfully updated ${updated} items with content URLs`);
}

generateMissingUrls()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
