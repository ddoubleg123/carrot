import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load local env for Prisma DATABASE_URL
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node scripts/delete-post.mjs <postId>');
    process.exit(1);
  }
  try {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      console.log(`Post ${id} not found (already deleted).`);
      return;
    }
    await prisma.post.delete({ where: { id } });
    console.log(`Deleted post ${id}.`);
  } catch (e) {
    console.error('Failed to delete post:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
