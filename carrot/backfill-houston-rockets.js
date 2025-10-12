const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillHoustonRockets() {
  try {
    console.log('🚀 Starting Houston Rockets hero image backfill...');
    
    // Find the Houston Rockets patch
    const patch = await prisma.patch.findFirst({
      where: { 
        OR: [
          { handle: 'houston-rockets-6' },
          { name: { contains: 'Houston Rockets', mode: 'insensitive' } }
        ]
      }
    });
    
    if (!patch) {
      console.log('❌ Houston Rockets patch not found');
      return;
    }
    
    console.log('✅ Found patch:', patch.name, '(ID:', patch.id, ')');
    
    // Get ALL sources for this patch
    const sources = await prisma.source.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        title: true,
        url: true,
        citeMeta: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📊 Found ${sources.length} sources for Houston Rockets patch`);
    
    if (sources.length === 0) {
      console.log('🚨 No sources found for Houston Rockets patch!');
      return;
    }
    
    // Check which sources need hero images
    const sourcesNeedingHero = sources.filter(source => {
      const mediaAssets = source.citeMeta?.mediaAssets;
      return !mediaAssets || !mediaAssets.hero;
    });
    
    console.log(`📸 Sources needing hero images: ${sourcesNeedingHero.length}`);
    console.log(`📸 Sources already with hero images: ${sources.length - sourcesNeedingHero.length}`);
    
    if (sourcesNeedingHero.length === 0) {
      console.log('✅ All Houston Rockets sources already have hero images!');
      return;
    }
    
    console.log('\n🎯 Sources that need hero images:');
    sourcesNeedingHero.forEach((source, i) => {
      console.log(`${i+1}. ${source.title}`);
      console.log(`   URL: ${source.url}`);
      console.log(`   Created: ${source.createdAt.toISOString()}`);
    });
    
    console.log('\n🚀 Running hero extraction on these sources...');
    console.log('This will take a few minutes as we process each URL...');
    
    // Call the backfill API
    const response = await fetch('https://carrot-app.onrender.com/api/dev/backfill-sources-hero', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    console.log('\n🎉 Backfill completed!');
    console.log('Results:', JSON.stringify(result, null, 2));
    
    // Verify the results
    console.log('\n🔍 Verifying results...');
    const updatedSources = await prisma.source.findMany({
      where: { 
        patchId: patch.id,
        citeMeta: {
          path: ['mediaAssets', 'hero'],
          not: null
        }
      },
      select: {
        id: true,
        title: true,
        citeMeta: true
      }
    });
    
    console.log(`✅ Sources now with hero images: ${updatedSources.length}`);
    
    updatedSources.forEach((source, i) => {
      const mediaAssets = source.citeMeta?.mediaAssets;
      console.log(`${i+1}. ${source.title}`);
      console.log(`   Hero source: ${mediaAssets?.source || 'unknown'}`);
      console.log(`   Has hero: ${!!mediaAssets?.hero}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillHoustonRockets();
