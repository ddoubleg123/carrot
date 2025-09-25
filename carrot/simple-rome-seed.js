const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedRome() {
  try {
    console.log('🏛️ Creating Rome patch...');

    // Create the Rome patch
    const romePatch = await prisma.patch.upsert({
      where: { handle: 'rome' },
      update: {},
      create: {
        handle: 'rome',
        name: 'Rome',
        description: 'Explore the eternal city through its rich history, culture, and enduring legacy that shaped Western civilization.',
        theme: 'marble',
        tags: ['history', 'culture', 'architecture', 'empire', 'civilization'],
        createdBy: 'seed-user-1',
        createdAt: new Date(),
      }
    });

    console.log('✅ Rome patch created:', romePatch.id);
    console.log('🏛️ Rome patch is ready!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedRome();
