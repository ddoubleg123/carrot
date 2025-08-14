const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Analyzing transcription grammar cleanup...\n');
    
    // Get the most recent audio posts with transcriptions
    const posts = await prisma.post.findMany({
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
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`Found ${posts.length} posts with transcriptions\n`);
    
    posts.forEach((post, i) => {
      console.log(`POST ${i + 1}:`);
      console.log(`ID: ${post.id}`);
      console.log(`Status: ${post.transcriptionStatus}`);
      console.log(`Transcription:`);
      console.log(`"${post.audioTranscription}"`);
      
      // Analyze for grammar issues
      const text = post.audioTranscription;
      const issues = [];
      
      if (!text.match(/^[A-Z]/)) issues.push('Missing capitalization at start');
      if (!text.match(/[.!?]$/)) issues.push('Missing punctuation at end');
      if (text.includes(' i ')) issues.push('Lowercase "i" found');
      if (text.match(/\b[a-z]+\s+[.!?]/)) issues.push('Lowercase word before punctuation');
      
      console.log(`Grammar Issues: ${issues.length > 0 ? issues.join(', ') : 'None detected'}`);
      console.log('---\n');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
