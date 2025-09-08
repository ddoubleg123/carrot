const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const u = await prisma.user.upsert({
      where: { email: 'danielgouldman@gmail.com' },
      update: {},
      create: {
        email: 'danielgouldman@gmail.com',
        name: 'Daniel Gouldman',
        username: 'daniel',
        image: null,
        isOnboarded: false,
      },
    });
    console.log('Upserted user:', u);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
