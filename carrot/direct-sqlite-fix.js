const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Direct SQLite approach to bypass Prisma issues
const dbPath = path.join(__dirname, 'prisma', 'dev.db');

console.log('🔍 DIRECT SQLITE DATABASE FIX FOR ACCOUNT VULNERABILITY\n');
console.log(`Database path: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to SQLite database\n');
});

// Step 1: Show current accounts
console.log('=== STEP 1: CURRENT ACCOUNT STATE ===');
db.all(`
  SELECT 
    a.id as account_id,
    a.provider,
    a.provider_account_id,
    a.user_id,
    u.email,
    u.username,
    u.name
  FROM accounts a
  JOIN User u ON a.user_id = u.id
  ORDER BY a.provider_account_id
`, [], (err, rows) => {
  if (err) {
    console.error('❌ Error querying accounts:', err.message);
    return;
  }

  console.log(`📊 Found ${rows.length} accounts:\n`);
  rows.forEach((row, index) => {
    console.log(`ACCOUNT ${index + 1}:`);
    console.log(`  - Account ID: ${row.account_id}`);
    console.log(`  - Provider: ${row.provider}`);
    console.log(`  - Provider Account ID: ${row.provider_account_id}`);
    console.log(`  - User ID: ${row.user_id}`);
    console.log(`  - User Email: ${row.email}`);
    console.log(`  - Username: @${row.username}`);
    console.log('');
  });

  // Step 2: Find and delete problematic account
  console.log('=== STEP 2: DELETING PROBLEMATIC ACCOUNT ===');
  
  const problematicProviderAccountId = '104032037834946442063';
  
  // First, find the problematic account
  db.get(`
    SELECT 
      a.id as account_id,
      a.provider_account_id,
      u.email
    FROM accounts a
    JOIN User u ON a.user_id = u.id
    WHERE a.provider_account_id = ?
  `, [problematicProviderAccountId], (err, row) => {
    if (err) {
      console.error('❌ Error finding problematic account:', err.message);
      return;
    }

    if (!row) {
      console.log('✅ No problematic account found - vulnerability may already be fixed!');
      db.close();
      return;
    }

    console.log(`🚨 FOUND PROBLEMATIC ACCOUNT:`);
    console.log(`  - Account ID: ${row.account_id}`);
    console.log(`  - Provider Account ID: ${row.provider_account_id}`);
    console.log(`  - Currently linked to: ${row.email}`);
    console.log(`  - This should be deleted to fix the vulnerability\n`);

    // Delete the problematic account
    db.run(`
      DELETE FROM accounts 
      WHERE provider_account_id = ? AND provider = 'google'
    `, [problematicProviderAccountId], function(err) {
      if (err) {
        console.error('❌ Error deleting problematic account:', err.message);
        return;
      }

      console.log(`✅ Successfully deleted ${this.changes} account(s)\n`);

      // Step 3: Verify deletion
      console.log('=== STEP 3: POST-DELETION VERIFICATION ===');
      db.all(`
        SELECT 
          a.id as account_id,
          a.provider,
          a.provider_account_id,
          u.email,
          u.username
        FROM accounts a
        JOIN User u ON a.user_id = u.id
        ORDER BY a.provider_account_id
      `, [], (err, finalRows) => {
        if (err) {
          console.error('❌ Error verifying deletion:', err.message);
          return;
        }

        console.log(`📊 Remaining accounts: ${finalRows.length}\n`);
        finalRows.forEach((row, index) => {
          console.log(`${index + 1}. Provider Account ID: ${row.provider_account_id}`);
          console.log(`   - User: ${row.email} (@${row.username})`);
        });

        // Check if problematic account still exists
        const stillExists = finalRows.some(row => 
          row.provider_account_id === problematicProviderAccountId
        );

        if (stillExists) {
          console.log('\n❌ DELETION FAILED - Problematic account still exists');
        } else {
          console.log('\n🎉 DELETION SUCCESSFUL - Vulnerability eliminated!');
          console.log('\n📋 EXPECTED BEHAVIOR NOW:');
          console.log('✅ danielgouldman@gmail.com → continues with existing @daniel profile');
          console.log('✅ daniel@gotcarrot.com → will create NEW separate user account on next login');
        }

        db.close((err) => {
          if (err) {
            console.error('❌ Error closing database:', err.message);
          } else {
            console.log('\n✅ Database connection closed');
          }
        });
      });
    });
  });
});
