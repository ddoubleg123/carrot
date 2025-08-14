const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function auditAuthIntegrity() {
  console.log('🔍 Starting Authentication & Database Integrity Audit...\n');

  try {
    // 1. Check all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isOnboarded: true
      }
    });
    console.log(`📊 Total Users: ${users.length}`);
    if (users.length === 0) {
      console.log('  ⚠️  NO USERS FOUND! This could be the root cause.');
    } else {
      users.forEach(user => {
        console.log(`  - ${user.id}: ${user.email || user.name || 'No email/name'} (onboarded: ${user.isOnboarded})`);
      });
    }

    // 2. Check all sessions
    const sessions = await prisma.session.findMany({
      select: {
        id: true,
        userId: true,
        expires: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
    console.log(`\n📊 Total Sessions: ${sessions.length}`);
    sessions.forEach(session => {
      const isExpired = new Date(session.expires) < new Date();
      const userExists = session.user ? '✅' : '❌ ORPHANED';
      console.log(`  - Session ${session.id}: userId=${session.userId} ${userExists} (expired: ${isExpired})`);
      if (session.user) {
        console.log(`    User: ${session.user.email || session.user.name || 'No email/name'}`);
      }
    });

    // 3. Check for orphaned sessions (sessions with invalid userId)
    const orphanedSessions = sessions.filter(session => !session.user);
    if (orphanedSessions.length > 0) {
      console.log(`\n⚠️  Found ${orphanedSessions.length} orphaned sessions:`);
      orphanedSessions.forEach(session => {
        console.log(`  - Session ${session.id} references non-existent userId: ${session.userId}`);
      });
    }

    // 4. Check all accounts
    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        userId: true,
        provider: true,
        providerAccountId: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
    console.log(`\n📊 Total Accounts: ${accounts.length}`);
    accounts.forEach(account => {
      const userExists = account.user ? '✅' : '❌ ORPHANED';
      console.log(`  - Account ${account.id}: ${account.provider} (${account.providerAccountId}) → userId=${account.userId} ${userExists}`);
    });

    // 5. Check for orphaned accounts
    const orphanedAccounts = accounts.filter(account => !account.user);
    if (orphanedAccounts.length > 0) {
      console.log(`\n⚠️  Found ${orphanedAccounts.length} orphaned accounts:`);
      orphanedAccounts.forEach(account => {
        console.log(`  - Account ${account.id} references non-existent userId: ${account.userId}`);
      });
    }

    // 6. Check all posts
    const posts = await prisma.post.findMany({
      select: {
        id: true,
        userId: true,
        content: true,
        audioUrl: true,
        User: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
    console.log(`\n📊 Total Posts: ${posts.length}`);
    posts.forEach(post => {
      const userExists = post.User ? '✅' : '❌ ORPHANED';
      const hasAudio = post.audioUrl ? '🎵' : '';
      console.log(`  - Post ${post.id}: userId=${post.userId} ${userExists} ${hasAudio}`);
      console.log(`    Content: "${post.content.substring(0, 50)}..."`);
    });

    // 7. Check for orphaned posts
    const orphanedPosts = posts.filter(post => !post.User);
    if (orphanedPosts.length > 0) {
      console.log(`\n⚠️  Found ${orphanedPosts.length} orphaned posts:`);
      orphanedPosts.forEach(post => {
        console.log(`  - Post ${post.id} references non-existent userId: ${post.userId}`);
      });
    }

    // 8. Summary
    console.log('\n📋 AUDIT SUMMARY:');
    console.log(`  Users: ${users.length}`);
    console.log(`  Sessions: ${sessions.length} (${orphanedSessions.length} orphaned)`);
    console.log(`  Accounts: ${accounts.length} (${orphanedAccounts.length} orphaned)`);
    console.log(`  Posts: ${posts.length} (${orphanedPosts.length} orphaned)`);

    if (orphanedSessions.length > 0 || orphanedAccounts.length > 0 || orphanedPosts.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND:');
      console.log('  Foreign key constraint violations detected!');
      console.log('  This explains the 500 errors when creating posts.');
      console.log('\n💡 RECOMMENDED ACTIONS:');
      console.log('  1. Clean up orphaned sessions');
      console.log('  2. Clean up orphaned accounts');
      console.log('  3. Clean up orphaned posts');
      console.log('  4. Verify NextAuth user creation flow');
    } else {
      console.log('\n✅ No orphaned records found. Foreign key integrity is intact.');
    }

  } catch (error) {
    console.error('💥 Audit failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

auditAuthIntegrity();
