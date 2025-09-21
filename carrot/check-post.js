const { PrismaClient } = require('@prisma/client');

async function checkPost() {
  const prisma = new PrismaClient();
  
  try {
    const post = await prisma.post.findUnique({
      where: { id: 'cmfsf09je0001rh2jt4rsgrke' },
      include: { User: true }
    });
    
    console.log('Post data:');
    console.log(JSON.stringify(post, null, 2));
    
    if (post) {
      console.log('\nImage URLs field:');
      console.log('imageUrls:', post.imageUrls);
      console.log('Type:', typeof post.imageUrls);
      
      if (post.imageUrls) {
        try {
          const parsed = JSON.parse(post.imageUrls);
          console.log('Parsed imageUrls:', parsed);
        } catch (e) {
          console.log('Failed to parse imageUrls as JSON:', e.message);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPost();
