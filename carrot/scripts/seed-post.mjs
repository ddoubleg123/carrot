import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const skipEmails = (process.env.SKIP_ONBOARD_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
  const fallbackEmail = skipEmails[0] || 'dev@example.com';

  let user = await prisma.user.findFirst({ where: { email: { in: skipEmails.length ? skipEmails : [fallbackEmail] } } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: fallbackEmail,
        name: 'Dev User',
        image: null,
        isOnboarded: true,
        emailVerified: new Date(),
      },
    });
    console.log('Created user:', user.email);
  } else {
    console.log('Found user:', user.email);
  }

  const post = await prisma.post.create({
    data: {
      userId: user.id,
      content: 'Test post from seed-post.mjs',
      gradientDirection: 'to-r',
      gradientFromColor: '#ff7e5f',
      gradientToColor: '#feb47b',
      audioUrl: null,
      videoUrl: null,
    },
  });

  console.log('Created post id:', post.id);

  const count = await prisma.post.count();
  console.log('Total posts now:', count);
}

main().catch((e) => {
  console.error('Seed error:', e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
