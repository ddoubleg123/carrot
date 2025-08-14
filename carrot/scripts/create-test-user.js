const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('🔧 Creating test user for authentication fix...');
    
    // Create a test user that matches the current session
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        isOnboarded: true,
        username: 'testuser',
        image: null
      }
    });
    
    console.log('✅ Test user created:', testUser);
    console.log('📝 User ID:', testUser.id);
    console.log('📧 Email:', testUser.email);
    
    // Verify user was created
    const userCount = await prisma.user.count();
    console.log(`📊 Total users in database: ${userCount}`);
    
    return testUser;
    
  } catch (error) {
    console.error('💥 Failed to create test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
