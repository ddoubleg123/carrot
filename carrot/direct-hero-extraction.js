const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the resolveHero function directly
const { resolveHero } = require('./src/lib/media/resolveHero');

async function directHeroExtraction() {
  try {
    console.log('🚀 Starting DIRECT hero image extraction for Houston Rockets...');
    
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
    
    // Get the first 3 Houston Rockets sources that need hero images
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
      take: 3 // Start with just 3 to test
    });
    
    console.log(`📊 Found ${sourcesNeedingHero.length} Houston Rockets sources needing hero images`);
    
    if (sourcesNeedingHero.length === 0) {
      console.log('✅ All Houston Rockets sources already have hero images!');
      return;
    }
    
    console.log('\n🎯 Processing these sources directly:');
    sourcesNeedingHero.forEach((source, i) => {
      console.log(`${i+1}. ${source.title}`);
      console.log(`   URL: ${source.url}`);
    });
    
    // Process each source directly using resolveHero
    const results = [];
    let successful = 0;
    let failed = 0;
    
    for (const source of sourcesNeedingHero) {
      try {
        console.log(`\n🎯 Processing: ${source.title}`);
        console.log(`   URL: ${source.url}`);
        
        // Call resolveHero directly
        const heroResult = await resolveHero({
          url: source.url,
          type: 'article' // Default type
        });
        
        console.log(`   ✅ Hero resolved: ${heroResult.source}`);
        console.log(`   📸 Hero URL: ${heroResult.hero ? heroResult.hero.substring(0, 80) + '...' : 'NULL'}`);
        
        // Update the source with the hero data
        const updatedCiteMeta = {
          ...(source.citeMeta || {}),
          mediaAssets: {
            hero: heroResult.hero,
            blurDataURL: heroResult.blurDataURL,
            dominant: heroResult.dominant,
            source: heroResult.source,
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
          heroSource: heroResult.source,
          hasHero: !!heroResult.hero
        });
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
    
    console.log('\n🎉 Direct hero extraction completed!');
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

directHeroExtraction();
