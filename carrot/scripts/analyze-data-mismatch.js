const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeData() {
  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: 'chicago-bulls' },
      select: { id: true }
    });
    
    console.log('=== DATABASE ANALYSIS ===');
    console.log('Patch ID:', patch.id);
    
    // Check sources table
    const sources = await prisma.source.findMany({
      where: { patchId: patch.id },
      select: { id: true, title: true, url: true, citeMeta: true },
      take: 3
    });
    console.log('\nSources count:', sources.length);
    console.log('First source:', sources[0]);
    
    // Check discoveredContent table  
    const discovered = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: { id: true, title: true, sourceUrl: true, metadata: true },
      take: 3
    });
    console.log('\nDiscoveredContent count:', discovered.length);
    console.log('First discovered:', discovered[0]);
    
    // Check if there are URL matches between tables
    console.log('\n=== URL MATCHING ANALYSIS ===');
    const sourceUrls = sources.map(s => s.url);
    const discoveredUrls = discovered.map(d => d.sourceUrl);
    
    console.log('Source URLs:', sourceUrls);
    console.log('Discovered URLs:', discoveredUrls);
    
    const matchingUrls = sourceUrls.filter(url => discoveredUrls.includes(url));
    console.log('Matching URLs:', matchingUrls.length);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeData();
