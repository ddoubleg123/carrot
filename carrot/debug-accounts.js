const { PrismaClient } = require('@prisma/client');

async function debugAccounts() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== DEBUGGING ACCOUNT LINKAGE ===');
    
    // Check the specific Google account that's causing issues
    const googleAccount = await prisma.account.findFirst({
      where: {
        providerAccountId: '104032037834946442063',
        provider: 'google'
      },
      include: {
        user: true
      }
    });
    
    console.log('Google Account 104032037834946442063:', JSON.stringify(googleAccount, null, 2));
    
    // Check all accounts for both users
    const danielGmailUser = await prisma.user.findUnique({
      where: { email: 'danielgouldman@gmail.com' },
      include: { accounts: true }
    });
    
    const danielCarrotUser = await prisma.user.findUnique({
      where: { email: 'daniel@gotcarrot.com' },
      include: { accounts: true }
    });
    
    console.log('\n=== danielgouldman@gmail.com accounts ===');
    console.log(JSON.stringify(danielGmailUser?.accounts, null, 2));
    
    console.log('\n=== daniel@gotcarrot.com accounts ===');
    console.log(JSON.stringify(danielCarrotUser?.accounts, null, 2));
    
    // Check for duplicate providerAccountId links
    const duplicateLinks = await prisma.account.groupBy({
      by: ['providerAccountId', 'provider'],
      having: {
        providerAccountId: {
          _count: {
            gt: 1
          }
        }
      },
      _count: {
        providerAccountId: true
      }
    });
    
    console.log('\n=== DUPLICATE PROVIDER ACCOUNT IDs ===');
    console.log(JSON.stringify(duplicateLinks, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAccounts();
