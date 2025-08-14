import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyTranscription() {
  try {
    console.log('🔍 Checking transcription status...\n');
    
    // Get recent audio posts
    const posts = await prisma.post.findMany({
      where: {
        audioUrl: { not: null }
      },
      select: {
        id: true,
        content: true,
        transcriptionStatus: true,
        audioTranscription: true,
        createdAt: true,
        author: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    if (posts.length === 0) {
      console.log('❌ No audio posts found');
      return;
    }

    console.log(`✅ Found ${posts.length} audio post(s):\n`);
    
    posts.forEach((post, i) => {
      console.log(`--- Post ${i + 1} ---`);
      console.log(`ID: ${post.id}`);
      console.log(`Author: ${post.author?.name || post.author?.email || 'Unknown'}`);
      console.log(`Content: "${post.content?.substring(0, 40)}..."`);
      console.log(`Status: ${post.transcriptionStatus || 'null'}`);
      console.log(`Transcription: ${post.audioTranscription ? 'Present' : 'null'}`);
      console.log(`Created: ${new Date(post.createdAt).toLocaleString()}`);
      console.log('');
    });

    // Environment check
    console.log('🔧 Environment:');
    console.log(`TRANSCRIPTION_SERVICE_URL: ${process.env.TRANSCRIPTION_SERVICE_URL || 'localhost:8080 (default)'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTranscription();
