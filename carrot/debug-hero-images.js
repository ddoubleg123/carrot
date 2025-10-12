const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugHeroImages() {
  try {
    console.log('🔍 COMPREHENSIVE HERO IMAGE DEBUGGING...\n');
    
    // 1. Find the Houston Rockets patch
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
    
    // 2. Check ALL discovered content for this patch
    const allContent = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        title: true,
        type: true,
        sourceUrl: true,
        canonicalUrl: true,
        mediaAssets: true,
        status: true,
        createdAt: true,
        enrichedContent: true,
        metadata: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('\n📊 TOTAL DISCOVERED CONTENT ITEMS:', allContent.length);
    
    if (allContent.length === 0) {
      console.log('\n🚨 NO CONTENT FOUND! This explains the missing images.');
      console.log('The patch exists but has no discovered content items.');
      console.log('This is why you see no hero images - there\'s no content to display!');
      return;
    }
    
    // 3. Analyze each content item
    allContent.forEach((item, i) => {
      console.log(`\n${i+1}. "${item.title}"`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Type: ${item.type}`);
      console.log(`   Status: ${item.status}`);
      console.log(`   Created: ${item.createdAt.toISOString()}`);
      console.log(`   Source: ${item.sourceUrl?.substring(0, 60)}...`);
      console.log(`   Canonical: ${item.canonicalUrl?.substring(0, 60)}...`);
      
      // Check mediaAssets
      if (item.mediaAssets) {
        console.log(`   📸 MediaAssets: EXISTS`);
        const media = item.mediaAssets;
        console.log(`   📸 Hero: ${media.hero ? 'EXISTS' : 'NULL'}`);
        console.log(`   📸 Source: ${media.source || 'unknown'}`);
        console.log(`   📸 License: ${media.license || 'unknown'}`);
        
        if (media.hero) {
          console.log(`   📸 Hero URL: ${media.hero.substring(0, 100)}...`);
        }
        
        if (media.gallery && media.gallery.length > 0) {
          console.log(`   📸 Gallery: ${media.gallery.length} images`);
        }
      } else {
        console.log(`   📸 MediaAssets: NULL`);
      }
      
      // Check enrichedContent
      if (item.enrichedContent) {
        console.log(`   📝 EnrichedContent: EXISTS`);
        const enriched = item.enrichedContent;
        console.log(`   📝 Summary: ${enriched.summary150 ? 'EXISTS' : 'NULL'}`);
        console.log(`   📝 KeyPoints: ${enriched.keyPoints?.length || 0} points`);
      } else {
        console.log(`   📝 EnrichedContent: NULL`);
      }
      
      // Check metadata
      if (item.metadata) {
        console.log(`   📋 Metadata: EXISTS`);
        const meta = item.metadata;
        console.log(`   📋 Author: ${meta.author || 'unknown'}`);
        console.log(`   📋 PublishDate: ${meta.publishDate || 'unknown'}`);
        console.log(`   📋 Source: ${meta.source || 'unknown'}`);
      } else {
        console.log(`   📋 Metadata: NULL`);
      }
    });
    
    // 4. Check if there are any sources with mediaAssets
    console.log('\n🔍 CHECKING SOURCES FOR MEDIA ASSETS...');
    const sources = await prisma.source.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        url: true,
        citeMeta: true,
        createdAt: true
      }
    });
    
    console.log(`📊 Found ${sources.length} sources`);
    
    sources.forEach((source, i) => {
      console.log(`\n${i+1}. Source: ${source.url.substring(0, 60)}...`);
      if (source.citeMeta) {
        const meta = source.citeMeta;
        console.log(`   📸 CiteMeta: EXISTS`);
        console.log(`   📸 MediaAssets: ${meta.mediaAssets ? 'EXISTS' : 'NULL'}`);
        
        if (meta.mediaAssets) {
          const media = meta.mediaAssets;
          console.log(`   📸 Hero: ${media.hero ? 'EXISTS' : 'NULL'}`);
          if (media.hero) {
            console.log(`   📸 Hero URL: ${media.hero.substring(0, 100)}...`);
          }
        }
      } else {
        console.log(`   📸 CiteMeta: NULL`);
      }
    });
    
    console.log('\n🎯 SUMMARY:');
    console.log(`- Patch: ${patch.name}`);
    console.log(`- Discovered Content Items: ${allContent.length}`);
    console.log(`- Sources: ${sources.length}`);
    console.log(`- Items with MediaAssets: ${allContent.filter(item => item.mediaAssets).length}`);
    console.log(`- Items with Hero Images: ${allContent.filter(item => item.mediaAssets?.hero).length}`);
    
    if (allContent.length === 0) {
      console.log('\n🚨 ROOT CAUSE: No discovered content items exist for this patch!');
      console.log('This is why you see no hero images. The discovery system needs to be activated.');
    } else if (allContent.filter(item => item.mediaAssets?.hero).length === 0) {
      console.log('\n🚨 ROOT CAUSE: Content exists but no hero images were extracted!');
      console.log('The hero image extraction pipeline may have failed.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugHeroImages();
