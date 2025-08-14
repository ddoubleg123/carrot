const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Querying database for audio posts with transcriptions...\n');
    
    // Get all posts with audio URLs
    const audioPosts = await prisma.post.findMany({
      where: {
        audioUrl: {
          not: null
        }
      },
      select: {
        id: true,
        content: true,
        audioUrl: true,
        audioTranscription: true,
        transcriptionStatus: true,
        createdAt: true,
        User: {
          select: {
            username: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    console.log(`Found ${audioPosts.length} audio posts:\n`);
    
    audioPosts.forEach((post, index) => {
      console.log(`=== POST ${index + 1} ===`);
      console.log(`ID: ${post.id}`);
      console.log(`Status: ${post.transcriptionStatus || 'None'}`);
      console.log(`Has Transcription: ${post.audioTranscription ? 'YES' : 'NO'}`);
      if (post.audioTranscription) {
        console.log(`Transcription: "${post.audioTranscription.substring(0, 100)}${post.audioTranscription.length > 100 ? '...' : ''}"`);
      }
      console.log('---');
    });
    
    // Summary statistics
    const statusCounts = audioPosts.reduce((acc, post) => {
      const status = post.transcriptionStatus || 'null';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Transcription Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} posts`);
    });
    
    const withTranscription = audioPosts.filter(p => p.audioTranscription).length;
    console.log(`\n📝 Posts with actual transcription text: ${withTranscription}/${audioPosts.length}`);
    
  } catch (error) {
    console.error('❌ Database query failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
