const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function isBase64Image(val) {
  return typeof val === 'string' && val.startsWith('data:image');
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, image: true, profilePhoto: true },
  });
  let updated = 0;
  for (const user of users) {
    let update = {};
    if (isBase64Image(user.image)) update.image = null;
    if (isBase64Image(user.profilePhoto)) update.profilePhoto = null;
    if (Object.keys(update).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: update });
      updated++;
      console.log(`Updated user ${user.email} (${user.id})`);
    }
  }
  console.log(`Done. Updated ${updated} user(s) with base64 images.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
