const { PrismaClient } = require('@prisma/client');

async function testTranscriptionCleanup() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing transcription cleanup by examining recent posts...\n');
    
    // Get the most recent audio posts to analyze cleanup quality
    const recentPosts = await prisma.post.findMany({
      where: {
        AND: [
          { audioUrl: { not: null } },
          { audioTranscription: { not: null } }
        ]
      },
      select: {
        id: true,
        audioTranscription: true,
        transcriptionStatus: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5 // Just the 5 most recent
    });

    if (recentPosts.length === 0) {
      console.log('❌ No audio posts found');
      return;
    }

    console.log(`📊 Analyzing ${recentPosts.length} most recent audio posts:\n`);

    let cleanedCount = 0;
    let rawCount = 0;

    recentPosts.forEach((post, index) => {
      const text = post.audioTranscription;
      const hasProperStart = /^[A-Z]/.test(text);
      const hasProperEnd = /[.!?]$/.test(text);
      const isProperlyFormatted = hasProperStart && hasProperEnd;
      
      console.log(`${index + 1}. Post ${post.id.substring(0, 8)}...`);
      console.log(`   Status: ${post.transcriptionStatus}`);
      console.log(`   Text: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
      console.log(`   Analysis: ${isProperlyFormatted ? '✅ CLEANED' : '❌ RAW'}`);
      console.log('');
      
      if (isProperlyFormatted) {
        cleanedCount++;
      } else {
        rawCount++;
      }
    });

    console.log('📈 SUMMARY:');
    console.log(`✅ Properly cleaned transcriptions: ${cleanedCount}/${recentPosts.length}`);
    console.log(`❌ Raw/uncleaned transcriptions: ${rawCount}/${recentPosts.length}`);
    console.log(`📊 Cleanup success rate: ${Math.round((cleanedCount / recentPosts.length) * 100)}%`);
    
    if (rawCount > 0) {
      console.log('\n⚠️  ISSUE DETECTED: Some transcriptions are not being cleaned up properly');
      console.log('🔧 This suggests the LanguageTool cleanup pipeline is failing intermittently');
    } else {
      console.log('\n✅ All recent transcriptions appear to be properly cleaned');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTranscriptionCleanup();
