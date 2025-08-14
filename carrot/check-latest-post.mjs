import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestPost() {
  try {
    console.log('🔍 Checking latest audio post...\n');
    
    // Get the most recent post with audio
    const latestPost = await prisma.post.findFirst({
      where: {
        audioUrl: { not: null }
      },
      select: {
        id: true,
        content: true,
        transcriptionStatus: true,
        audioTranscription: true,
        audioUrl: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latestPost) {
      console.log('❌ No audio posts found');
      return;
    }

    console.log('📊 LATEST AUDIO POST:');
    console.log(`ID: ${latestPost.id}`);
    console.log(`Author: ${latestPost.author?.name || latestPost.author?.email || 'Unknown'}`);
    console.log(`Content: "${latestPost.content?.substring(0, 50)}..."`);
    console.log(`Transcription Status: ${latestPost.transcriptionStatus || 'null'}`);
    console.log(`Audio Transcription: ${latestPost.audioTranscription ? 'Present' : 'null'}`);
    console.log(`Created: ${latestPost.createdAt}`);
    console.log(`Updated: ${latestPost.updatedAt}`);
    console.log('');
    
    // Analyze audio URL
    if (latestPost.audioUrl) {
      console.log('🎵 AUDIO FILE DETAILS:');
      const url = new URL(latestPost.audioUrl);
      console.log(`Host: ${url.hostname}`);
      console.log(`Path: ${url.pathname}`);
      console.log(`Full URL: ${latestPost.audioUrl}`);
      console.log('');
    }
    
    // Test transcription trigger manually
    console.log('🧪 TESTING TRANSCRIPTION TRIGGER:');
    console.log(`Post ID: ${latestPost.id}`);
    console.log(`Audio URL: ${latestPost.audioUrl}`);
    
    if (latestPost.transcriptionStatus === 'pending') {
      console.log('✅ Transcription already triggered (status: pending)');
    } else if (latestPost.transcriptionStatus === 'completed') {
      console.log('✅ Transcription completed');
    } else {
      console.log('❌ Transcription not triggered (status: queued or null)');
      console.log('💡 Manual trigger needed');
    }
    
  } catch (error) {
    console.error('❌ Error checking latest post:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestPost();
