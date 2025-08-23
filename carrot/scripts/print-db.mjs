import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  const postCount = await prisma.post.count();
  const latest = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { User: { select: { id: true, email: true, name: true } } }
  });

  const out = {
    ok: true,
    env: {
      cwd: process.cwd(),
      DATABASE_URL: process.env.DATABASE_URL,
    },
    counts: { users: userCount, posts: postCount },
    latest
  };
  const outPath = path.join(process.cwd(), 'debug_db.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('Wrote', outPath);
}

main().catch((e) => {
  console.error('DB debug error:', e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
