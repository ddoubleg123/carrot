// Test script to check if patch "israel-14" exists in the database
const { PrismaClient } = require('@prisma/client');

async function testPatchExists() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing if patch "israel-14" exists...');
    
    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel-14' },
      select: { 
        id: true, 
        handle: true, 
        name: true, 
        description: true,
        tags: true,
        _count: {
          select: {
            sources: true,
            discoveredContent: true
          }
        }
      }
    });
    
    if (patch) {
      console.log('✅ Patch found:', {
        id: patch.id,
        handle: patch.handle,
        name: patch.name,
        description: patch.description,
        tags: patch.tags,
        sourceCount: patch._count.sources,
        discoveredContentCount: patch._count.discoveredContent
      });
      
      // Check if there are any sources
      const sources = await prisma.source.findMany({
        where: { patchId: patch.id },
        select: { id: true, title: true, url: true, createdAt: true }
      });
      
      console.log('📚 Sources found:', sources.length);
      sources.forEach(source => {
        console.log(`  - ${source.title} (${source.url})`);
      });
      
      // Check if there are any discovered content
      const discoveredContent = await prisma.discoveredContent.findMany({
        where: { patchId: patch.id },
        select: { id: true, title: true, sourceUrl: true, createdAt: true }
      });
      
      console.log('🔍 Discovered content found:', discoveredContent.length);
      discoveredContent.forEach(content => {
        console.log(`  - ${content.title} (${content.sourceUrl})`);
      });
      
    } else {
      console.log('❌ Patch "israel-14" not found');
      
      // List all available patches
      const allPatches = await prisma.patch.findMany({
        select: { handle: true, name: true },
        take: 10
      });
      
      console.log('📋 Available patches:');
      allPatches.forEach(p => {
        console.log(`  - ${p.handle}: ${p.name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing patch:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPatchExists();
