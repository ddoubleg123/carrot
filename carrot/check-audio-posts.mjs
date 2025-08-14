import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAudioPosts() {
  try {
    console.log('🔍 Analyzing audio posts and transcription status...\n');
    
    // Get all audio posts with detailed info
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

    console.log(`📊 TOTAL AUDIO POSTS: ${audioPosts.length}\n`);

    if (audioPosts.length === 0) {
      console.log('❌ No audio posts found in database');
      return;
    }

    // Analyze hosting locations
    const hostingAnalysis = {};
    
    audioPosts.forEach((post, index) => {
      console.log(`--- Audio Post ${index + 1} ---`);
      console.log(`ID: ${post.id}`);
      console.log(`Author: ${post.author?.name || post.author?.email || 'Unknown'}`);
      console.log(`Content: "${post.content?.substring(0, 50)}..."`);
      console.log(`Transcription Status: ${post.transcriptionStatus || 'null'}`);
      console.log(`Audio Transcription: ${post.audioTranscription ? 'Present (' + post.audioTranscription.length + ' chars)' : 'null'}`);
      
      // Analyze audio URL hosting
      if (post.audioUrl) {
        let host = 'Unknown';
        try {
          const url = new URL(post.audioUrl);
          host = url.hostname;
          
          if (host.includes('firebasestorage.app')) {
            host = 'Firebase Storage';
          } else if (host.includes('googleapis.com')) {
            host = 'Google Cloud Storage';
          } else if (host.includes('localhost')) {
            host = 'Local Development';
          }
        } catch (e) {
          host = 'Invalid URL';
        }
        
        console.log(`Audio Host: ${host}`);
        console.log(`Audio URL: ${post.audioUrl.substring(0, 80)}...`);
        
        // Count hosting types
        hostingAnalysis[host] = (hostingAnalysis[host] || 0) + 1;
      } else {
        console.log(`Audio URL: null`);
      }
      
      console.log(`Created: ${post.createdAt}`);
      console.log(`Updated: ${post.updatedAt}`);
      console.log('');
    });

    // Summary
    console.log('📊 HOSTING ANALYSIS:');
    Object.entries(hostingAnalysis).forEach(([host, count]) => {
      console.log(`  ${host}: ${count} audio file(s)`);
    });
    
    console.log('\n🔧 TRANSCRIPTION SERVICE STATUS:');
    console.log(`Service URL: ${process.env.TRANSCRIPTION_SERVICE_URL || 'Not configured'}`);
    
    // Check status distribution
    const statusCounts = {};
    audioPosts.forEach(post => {
      const status = post.transcriptionStatus || 'null';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('\n📈 TRANSCRIPTION STATUS DISTRIBUTION:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} post(s)`);
    });
    
  } catch (error) {
    console.error('❌ Error analyzing audio posts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAudioPosts();
