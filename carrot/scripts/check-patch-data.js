const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPatchData() {
  try {
    console.log('🔍 Checking patch data for clean-energy-revolution...\n');
    
    // Get the patch
    const patch = await prisma.patch.findUnique({
      where: { handle: 'clean-energy-revolution' },
      include: {
        sources: true,
        facts: true,
        events: true,
        posts: true
      }
    });

    if (!patch) {
      console.log('❌ Patch not found');
      return;
    }

    console.log(`✅ Patch found: ${patch.name}`);
    console.log(`📊 Sources: ${patch.sources.length}`);
    console.log(`📊 Facts: ${patch.facts.length}`);
    console.log(`📊 Events: ${patch.events.length}`);
    console.log(`📊 Posts: ${patch.posts.length}\n`);

    // Check for invalid URLs in sources
    console.log('🔍 Checking source URLs...');
    const invalidSources = patch.sources.filter(source => {
      if (!source.url) return true;
      try {
        new URL(source.url);
        return false;
      } catch {
        return true;
      }
    });

    if (invalidSources.length > 0) {
      console.log(`❌ Found ${invalidSources.length} sources with invalid URLs:`);
      invalidSources.forEach(source => {
        console.log(`  - "${source.title}": "${source.url}"`);
      });
    } else {
      console.log('✅ All source URLs are valid');
    }

    // Check for invalid URLs in events
    console.log('\n🔍 Checking event source URLs...');
    const eventsWithInvalidSources = patch.events.filter(event => {
      if (!event.sourceIds || event.sourceIds.length === 0) return false;
      
      // Check if any referenced sources have invalid URLs
      return event.sourceIds.some(sourceId => {
        const source = patch.sources.find(s => s.id === sourceId);
        if (!source || !source.url) return true;
        try {
          new URL(source.url);
          return false;
        } catch {
          return true;
        }
      });
    });

    if (eventsWithInvalidSources.length > 0) {
      console.log(`❌ Found ${eventsWithInvalidSources.length} events with invalid source URLs`);
    } else {
      console.log('✅ All event source URLs are valid');
    }

  } catch (error) {
    console.error('❌ Error checking patch data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPatchData();
