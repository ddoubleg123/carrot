const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPatch() {
  try {
    console.log('Checking if patch exists...');
    
    const patch = await prisma.patch.findUnique({
      where: { handle: 'term-limits-politicians' },
      include: {
        _count: {
          select: {
            members: true,
            posts: true,
            events: true,
            sources: true,
          }
        }
      }
    });

    if (patch) {
      console.log('✅ Patch found:', {
        id: patch.id,
        name: patch.name,
        handle: patch.handle,
        counts: patch._count
      });
    } else {
      console.log('❌ Patch not found');
      
      // Check if any patches exist
      const allPatches = await prisma.patch.findMany({
        select: { id: true, name: true, handle: true }
      });
      console.log('Available patches:', allPatches);
    }
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPatch();
