const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Investigating Google Account mixing vulnerability...');
  
  // Check the problematic providerAccountId
  const problematicAccountId = '104032037834946442063';
  
  console.log(`\n1. Checking Account table for providerAccountId: ${problematicAccountId}`);
  const accounts = await prisma.account.findMany({
    where: {
      providerAccountId: problematicAccountId,
      provider: 'google'
    },
    include: {
      user: true
    }
  });
  
  console.log('Found accounts:', JSON.stringify(accounts, null, 2));
  
  // Check both users
  console.log('\n2. Checking User table for both emails:');
  const danielGotCarrot = await prisma.user.findUnique({
    where: { email: 'daniel@gotcarrot.com' },
    include: { accounts: true }
  });
  
  const danielGmail = await prisma.user.findUnique({
    where: { email: 'danielgouldman@gmail.com' },
    include: { accounts: true }
  });
  
  console.log('daniel@gotcarrot.com user:', JSON.stringify(danielGotCarrot, null, 2));
  console.log('danielgouldman@gmail.com user:', JSON.stringify(danielGmail, null, 2));
  
  // CRITICAL FIX: Remove the incorrect account link
  if (accounts.length > 0) {
    console.log('\n🚨 CRITICAL ISSUE FOUND: providerAccountId is linked to wrong user!');
    
    for (const account of accounts) {
      if (account.user.email !== 'daniel@gotcarrot.com') {
        console.log(`❌ Account ${account.id} links providerAccountId ${problematicAccountId} to wrong user: ${account.user.email}`);
        console.log('🔧 FIXING: Deleting incorrect account link...');
        
        await prisma.account.delete({
          where: { id: account.id }
        });
        
        console.log('✅ Deleted incorrect account link');
      } else {
        console.log(`✅ Account ${account.id} correctly links to ${account.user.email}`);
      }
    }
  }
  
  // Verify the fix
  console.log('\n3. Verifying fix - checking accounts again:');
  const accountsAfter = await prisma.account.findMany({
    where: {
      providerAccountId: problematicAccountId,
      provider: 'google'
    },
    include: {
      user: true
    }
  });
  
  console.log('Accounts after fix:', JSON.stringify(accountsAfter, null, 2));
  
  if (accountsAfter.length === 0) {
    console.log('✅ SUCCESS: Problematic account link removed. daniel@gotcarrot.com will now create a new, correct account link on next login.');
  } else if (accountsAfter.length === 1 && accountsAfter[0].user.email === 'daniel@gotcarrot.com') {
    console.log('✅ SUCCESS: Account correctly linked to daniel@gotcarrot.com');
  } else {
    console.log('❌ ISSUE: Unexpected state after fix');
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
