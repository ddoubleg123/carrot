const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillHoustonRocketsTargeted() {
  try {
    console.log('🚀 Starting TARGETED Houston Rockets hero image backfill...');
    
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
    
    // Get Houston Rockets sources that need hero images
    const sourcesNeedingHero = await prisma.source.findMany({
      where: { 
        patchId: patch.id,
        OR: [
          { citeMeta: { equals: null } },
          { citeMeta: { path: ['mediaAssets'], equals: null } },
          { citeMeta: { path: ['mediaAssets', 'hero'], equals: null } }
        ]
      },
      select: {
        id: true,
        title: true,
        url: true,
        citeMeta: true
      },
      take: 5 // Process 5 at a time to avoid overwhelming the system
    });
    
    console.log(`📊 Found ${sourcesNeedingHero.length} Houston Rockets sources needing hero images`);
    
    if (sourcesNeedingHero.length === 0) {
      console.log('✅ All Houston Rockets sources already have hero images!');
      return;
    }
    
    console.log('\n🎯 Processing these sources:');
    sourcesNeedingHero.forEach((source, i) => {
      console.log(`${i+1}. ${source.title}`);
      console.log(`   URL: ${source.url}`);
    });
    
    // Process each source individually using the resolveHero function
    const results = [];
    let successful = 0;
    let failed = 0;
    
    for (const source of sourcesNeedingHero) {
      try {
        console.log(`\n🎯 Processing: ${source.title}`);
        console.log(`   URL: ${source.url}`);
        
        // Call the resolveHero API endpoint
        const heroResponse = await fetch('https://carrot-app.onrender.com/api/dev/resolve-hero', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: source.url,
            type: 'article' // Default type
          })
        });
        
        if (!heroResponse.ok) {
          throw new Error(`Hero resolution failed: ${heroResponse.status}`);
        }
        
        const heroResult = await heroResponse.json();
        
        if (!heroResult.success) {
          throw new Error(`Hero resolution failed: ${heroResult.error}`);
        }
        
        console.log(`   ✅ Hero resolved: ${heroResult.heroSource}`);
        
        // Update the source with the hero data
        const updatedCiteMeta = {
          ...(source.citeMeta || {}),
          mediaAssets: {
            hero: heroResult.hero,
            blurDataURL: heroResult.blurDataURL,
            dominant: heroResult.dominant,
            source: heroResult.heroSource,
            license: heroResult.license || 'source'
          }
        };
        
        await prisma.source.update({
          where: { id: source.id },
          data: { citeMeta: updatedCiteMeta }
        });
        
        console.log(`   💾 Updated source ${source.id} with hero data`);
        
        successful++;
        results.push({
          id: source.id,
          title: source.title,
          url: source.url,
          success: true,
          heroSource: heroResult.heroSource
        });
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`   ❌ Failed to process ${source.title}:`, error.message);
        failed++;
        results.push({
          id: source.id,
          title: source.title,
          url: source.url,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log('\n🎉 Houston Rockets backfill completed!');
    console.log(`📊 Summary: ${successful} successful, ${failed} failed`);
    
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
    
    console.log(`✅ Houston Rockets sources now with hero images: ${updatedSources.length}`);
    
    if (updatedSources.length > 0) {
      console.log('\n🎯 Sources with hero images:');
      updatedSources.forEach((source, i) => {
        const mediaAssets = source.citeMeta?.mediaAssets;
        console.log(`${i+1}. ${source.title}`);
        console.log(`   Hero source: ${mediaAssets?.source || 'unknown'}`);
        console.log(`   Has hero: ${!!mediaAssets?.hero}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillHoustonRocketsTargeted();
