import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load Prisma DATABASE_URL from local env
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
  const content = process.argv.slice(2).join(' ').trim();
  if (!content) {
    console.error('Usage: node scripts/delete-posts-by-content.mjs "<exact content>"');
    process.exit(1);
  }

  try {
    const posts = await prisma.post.findMany({
      where: { content },
      select: { id: true, userId: true, createdAt: true }
    });

    if (posts.length === 0) {
      console.log('No posts found matching content.');
      return;
    }

    console.log(`Found ${posts.length} post(s):`, posts.map(p => p.id));

    const del = await prisma.post.deleteMany({ where: { content } });
    console.log(`Deleted ${del.count} post(s) with content: ${JSON.stringify(content)}`);
  } catch (e) {
    console.error('Failed to delete posts:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
