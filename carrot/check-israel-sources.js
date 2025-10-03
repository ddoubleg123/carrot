const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://carrot_db_singapore_user:VaGfYVzOUkA6zZUmQwXdtfVFP332k0s9@dpg-d2vq9v8dl3ps739f8mjg-a.singapore-postgres.render.com/carrot_db_singapore',
  ssl: { rejectUnauthorized: false }
});

async function checkIsraelSources() {
  try {
    await client.connect();
    console.log('Connected to database');

    // First, let's see what tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Available tables:');
    tablesResult.rows.forEach(row => console.log(`- ${row.table_name}`));
    console.log('');

    // Find the Israel patch
    const patchResult = await client.query('SELECT id, name, handle FROM patches WHERE handle = $1', ['israel-13']);
    
    if (patchResult.rows.length === 0) {
      console.log('Israel patch not found');
      return;
    }

    const patch = patchResult.rows[0];
    console.log(`\nFound patch: ${patch.name} (${patch.handle})`);
    console.log(`Patch ID: ${patch.id}\n`);

    // Get all sources for this patch
    const sourcesResult = await client.query(`
      SELECT 
        id,
        title,
        url,
        author,
        "added_by",
        "cite_meta",
        "created_at"
      FROM sources 
      WHERE "patch_id" = $1 
      ORDER BY "created_at" DESC
    `, [patch.id]);

    console.log(`Found ${sourcesResult.rows.length} sources:\n`);

    sourcesResult.rows.forEach((source, index) => {
      const citeMeta = source.cite_meta || {};
      console.log(`${index + 1}. ${source.title}`);
      console.log(`   URL: ${source.url}`);
      console.log(`   Author: ${source.author}`);
      console.log(`   Type: ${citeMeta.type || 'unknown'}`);
      console.log(`   Description: ${citeMeta.description || 'No description'}`);
      console.log(`   Relevance Score: ${citeMeta.relevanceScore || 'N/A'}`);
      console.log(`   Status: ${citeMeta.status || 'unknown'}`);
      console.log(`   Added: ${source.created_at}`);
      console.log('');
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

checkIsraelSources();
