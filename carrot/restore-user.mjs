import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const user = await prisma.user.create({
    data: {
      email: 'danielgouldman@gmail.com',
      name: 'Daniel Gouldman',
      username: 'daniel',
      isOnboarded: true,
      profilePhoto: '/default-avatar.png',
    }
  });
  
  console.log('✅ User account restored:');
  console.log('ID:', user.id);
  console.log('Email:', user.email);
  console.log('Username:', user.username);
  console.log('Name:', user.name);
  console.log('Onboarded:', user.isOnboarded);
} catch (error) {
  console.error('❌ Error restoring user:', error);
} finally {
  await prisma.$disconnect();
}
