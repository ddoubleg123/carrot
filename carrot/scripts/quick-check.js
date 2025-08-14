const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickCheck() {
  try {
    const userCount = await prisma.user.count();
    const sessionCount = await prisma.session.count();
    const postCount = await prisma.post.count();
    
    console.log(`Users: ${userCount}, Sessions: ${sessionCount}, Posts: ${postCount}`);
    
    if (userCount === 0) {
      console.log('🚨 CRITICAL: No users in database! This explains the foreign key errors.');
    }
    
    // Get first user if exists
    if (userCount > 0) {
      const firstUser = await prisma.user.findFirst();
      console.log(`First user: ${firstUser.id} (${firstUser.email || firstUser.name})`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickCheck();
