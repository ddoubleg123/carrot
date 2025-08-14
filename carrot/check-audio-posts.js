const { PrismaClient } = require('@prisma/client');

async function checkAudioPosts() {
  const prisma = new PrismaClient();
  
  try {
    const posts = await prisma.post.findMany({
      where: {
        audioUrl: {
          not: null
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 3,
      select: {
        id: true,
        content: true,
        audioUrl: true,
        transcriptionText: true,
        transcriptionStatus: true,
        createdAt: true
      }
    });
    
    console.log('Latest Audio Posts:');
    console.log(JSON.stringify(posts, null, 2));
    
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAudioPosts();
