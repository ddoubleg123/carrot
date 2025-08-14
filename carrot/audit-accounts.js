const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function auditAccounts() {
  console.log('🔍 AUDITING ACCOUNT TABLE FOR DUPLICATE PROVIDER ACCOUNT IDs...\n');

  try {
    // Get all accounts
    const accounts = await prisma.account.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    console.log(`📊 Total accounts found: ${accounts.length}\n`);

    // Group by providerAccountId
    const groupedByProviderAccountId = {};
    accounts.forEach(account => {
      const key = `${account.provider}-${account.providerAccountId}`;
      if (!groupedByProviderAccountId[key]) {
        groupedByProviderAccountId[key] = [];
      }
      groupedByProviderAccountId[key].push(account);
    });

    // Find duplicates
    const duplicates = Object.entries(groupedByProviderAccountId)
      .filter(([key, accounts]) => accounts.length > 1);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate providerAccountId entries found.');
    } else {
      console.log(`🚨 CRITICAL: Found ${duplicates.length} duplicate providerAccountId entries:\n`);
      
      duplicates.forEach(([key, accounts]) => {
        console.log(`🔥 DUPLICATE: ${key}`);
        accounts.forEach(account => {
          console.log(`   - Account ID: ${account.id}`);
          console.log(`   - User ID: ${account.userId}`);
          console.log(`   - User Email: ${account.user?.email || 'N/A'}`);
          console.log(`   - User Name: ${account.user?.name || 'N/A'}`);
          console.log(`   - Created: ${account.createdAt}`);
          console.log('   ---');
        });
        console.log('');
      });
    }

    // Show all Google accounts specifically
    const googleAccounts = accounts.filter(acc => acc.provider === 'google');
    console.log(`\n📱 Google accounts found: ${googleAccounts.length}`);
    googleAccounts.forEach(account => {
      console.log(`   - Provider Account ID: ${account.providerAccountId}`);
      console.log(`   - User Email: ${account.user?.email || 'N/A'}`);
      console.log(`   - User Name: ${account.user?.name || 'N/A'}`);
      console.log('   ---');
    });

  } catch (error) {
    console.error('❌ Error auditing accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

auditAccounts();
