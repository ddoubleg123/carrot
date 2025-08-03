const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.deleteMany({
    where: { email: 'danielgouldman@gmail.com' },
  });
  console.log(`Deleted ${result.count} user(s) with email danielgouldman@gmail.com`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
