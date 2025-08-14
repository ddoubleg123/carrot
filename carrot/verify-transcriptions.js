const { PrismaClient } = require('@prisma/client');

async function verifyTranscriptions() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking database for audio posts with transcriptions...\n');
    
    // Get all posts with audio and transcription
    const audioPosts = await prisma.post.findMany({
      where: {
        AND: [
          { audioUrl: { not: null } },
          { audioTranscription: { not: null } }
        ]
      },
      select: {
        id: true,
        audioUrl: true,
        audioTranscription: true,
        transcriptionStatus: true,
        createdAt: true,
        User: {
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

    if (audioPosts.length === 0) {
      console.log('❌ No audio posts with transcriptions found in database');
      return;
    }

    console.log(`✅ Found ${audioPosts.length} audio post(s) with transcriptions:\n`);

    audioPosts.forEach((post, index) => {
      console.log(`--- Post ${index + 1} ---`);
      console.log(`ID: ${post.id}`);
      console.log(`User: ${post.User.name || post.User.email}`);
      console.log(`Created: ${post.createdAt.toISOString()}`);
      console.log(`Audio URL: ${post.audioUrl?.substring(0, 80)}...`);
      console.log(`Transcription Status: ${post.transcriptionStatus || 'unknown'}`);
      console.log(`Transcription Text:`);
      console.log(`"${post.audioTranscription}"`);
      console.log('');
      
      // Check for signs of cleanup (proper punctuation, capitalization)
      const text = post.audioTranscription;
      const hasProperCapitalization = /^[A-Z]/.test(text);
      const hasProperPunctuation = /[.!?]$/.test(text);
      const hasCommas = text.includes(',');
      const hasMultipleSentences = (text.match(/[.!?]/g) || []).length > 1;
      
      console.log(`📝 Text Analysis:`);
      console.log(`  - Starts with capital: ${hasProperCapitalization ? '✅' : '❌'}`);
      console.log(`  - Ends with punctuation: ${hasProperPunctuation ? '✅' : '❌'}`);
      console.log(`  - Contains commas: ${hasCommas ? '✅' : '❌'}`);
      console.log(`  - Multiple sentences: ${hasMultipleSentences ? '✅' : '❌'}`);
      
      if (hasProperCapitalization && hasProperPunctuation) {
        console.log(`  🎯 LIKELY CLEANED UP TEXT`);
      } else {
        console.log(`  ⚠️  LIKELY RAW TRANSCRIPTION`);
      }
      console.log('\n' + '='.repeat(60) + '\n');
    });

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTranscriptions();
