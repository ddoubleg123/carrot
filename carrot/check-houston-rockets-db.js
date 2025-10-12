const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHoustonRocketsDB() {
  try {
    console.log('🔍 Checking Houston Rockets sources in database...');
    
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
      orderBy: { createdAt: 'desc' },
      take: 10 // Check first 10
    });
    
    console.log(`📊 Found ${sources.length} Houston Rockets sources in database`);
    
    sources.forEach((source, i) => {
      console.log(`\n${i+1}. ${source.title}`);
      console.log(`   ID: ${source.id}`);
      console.log(`   URL: ${source.url}`);
      console.log(`   Created: ${source.createdAt.toISOString()}`);
      
      if (source.citeMeta) {
        console.log(`   📸 CiteMeta: EXISTS`);
        const mediaAssets = source.citeMeta.mediaAssets;
        
        if (mediaAssets) {
          console.log(`   📸 MediaAssets: EXISTS`);
          console.log(`   📸 Hero: ${mediaAssets.hero ? 'EXISTS' : 'NULL'}`);
          console.log(`   📸 Source: ${mediaAssets.source || 'unknown'}`);
          console.log(`   📸 License: ${mediaAssets.license || 'unknown'}`);
          
          if (mediaAssets.hero) {
            console.log(`   📸 Hero URL: ${mediaAssets.hero.substring(0, 80)}...`);
          }
        } else {
          console.log(`   📸 MediaAssets: NULL`);
        }
      } else {
        console.log(`   📸 CiteMeta: NULL`);
      }
    });
    
    // Count sources with hero images
    const sourcesWithHero = sources.filter(source => {
      return source.citeMeta?.mediaAssets?.hero;
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`- Total sources: ${sources.length}`);
    console.log(`- Sources with hero images: ${sourcesWithHero.length}`);
    console.log(`- Sources needing hero images: ${sources.length - sourcesWithHero.length}`);
    
    if (sourcesWithHero.length > 0) {
      console.log('\n✅ SUCCESS: Houston Rockets sources have hero images in database!');
      console.log('The issue might be in the API response mapping.');
    } else {
      console.log('\n❌ ISSUE: Houston Rockets sources do NOT have hero images in database.');
      console.log('The backfill process did not work for Houston Rockets sources.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkHoustonRocketsDB();
