const { PrismaClient } = require('@prisma/client');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function checkTranscriptionStatus() {
  try {
    console.log('🔍 Checking transcription status in database...\n');
    
    // Get all audio posts
    const audioPosts = await prisma.post.findMany({
      where: {
        audioUrl: {
          not: null
        }
      },
      select: {
        id: true,
        content: true,
        transcriptionStatus: true,
        audioTranscription: true,
        audioUrl: true,
        createdAt: true,
        author: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    if (audioPosts.length === 0) {
      console.log('❌ No audio posts found in database');
      return;
    }

    console.log(`✅ Found ${audioPosts.length} audio post(s):\n`);

    audioPosts.forEach((post, index) => {
      console.log(`--- Audio Post ${index + 1} ---`);
      console.log(`ID: ${post.id}`);
      console.log(`Author: ${post.author?.name || post.author?.email || 'Unknown'}`);
      console.log(`Content: ${post.content?.substring(0, 50)}...`);
      console.log(`Transcription Status: ${post.transcriptionStatus || 'null'}`);
      console.log(`Audio Transcription: ${post.audioTranscription ? post.audioTranscription.substring(0, 100) + '...' : 'null'}`);
      console.log(`Audio URL: ${post.audioUrl ? 'Present' : 'null'}`);
      console.log(`Created: ${post.createdAt}`);
      console.log('');
    });

    // Check transcription service environment
    console.log('🔧 Environment Check:');
    console.log(`TRANSCRIPTION_SERVICE_URL: ${process.env.TRANSCRIPTION_SERVICE_URL || 'Not set (using localhost:8080)'}`);
    
  } catch (error) {
    console.error('❌ Error checking transcription status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTranscriptionStatus();
