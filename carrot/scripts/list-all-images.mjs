import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

function loadEnvFile(p) {
  try {
    const txt = fs.readFileSync(p, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {}
}

// Load environment variables
const ROOT = path.resolve(process.cwd(), '..');
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env'));

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.FIREBASE_PROJECT_ID;
const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!privateKey || !clientEmail || !projectId || !bucketName) {
  console.error('❌ Missing Firebase Admin environment variables!');
  console.error('Create carrot/.env.local with:');
  console.error('  FIREBASE_PROJECT_ID');
  console.error('  FIREBASE_CLIENT_EMAIL');
  console.error('  FIREBASE_PRIVATE_KEY');
  console.error('  FIREBASE_STORAGE_BUCKET');
  process.exit(1);
}

let app;
if (!admin.apps.length) {
  app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket: bucketName,
  });
} else {
  app = admin.app();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
  console.log('🔍 Fetching ALL Firebase Storage files...');
  console.log('📦 Bucket:', bucketName);
  console.log('');

  const bucket = admin.storage(app).bucket(bucketName);
  let allFiles = [];
  let pageToken = undefined;
  let pageCount = 0;

  try {
    // Paginate through ALL files
    do {
      pageCount++;
      console.log(`   Fetching page ${pageCount}...`);
      const [files, nextPageToken] = await bucket.getFiles({
        maxResults: 1000,
        pageToken: pageToken,
      });
      allFiles = allFiles.concat(files);
      pageToken = nextPageToken;
    } while (pageToken);

    console.log(`✅ Found ${allFiles.length} total files\n`);

    // Process files
    let totalSize = 0;
    const imagesByUser = {};
    const imageTypes = {};

    const items = allFiles.map((f) => {
      const size = parseInt(f.metadata?.size || '0');
      totalSize += size;

      const name = f.name;
      const contentType = f.metadata?.contentType || 'unknown';

      // Count by content type
      imageTypes[contentType] = (imageTypes[contentType] || 0) + 1;

      // Group by user
      if (name.startsWith('users/')) {
        const userId = name.split('/')[1];
        if (!imagesByUser[userId]) {
          imagesByUser[userId] = { count: 0, size: 0, files: [] };
        }
        imagesByUser[userId].count++;
        imagesByUser[userId].size += size;
        imagesByUser[userId].files.push(name);
      }

      return {
        name: name,
        size: size,
        sizeFormatted: formatBytes(size),
        contentType: contentType,
        updated: f.metadata?.updated,
        bucket: bucketName,
        publicUrl: `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(name)}`,
      };
    });

    // Sort by size (largest first)
    items.sort((a, b) => b.size - a.size);

    // Generate report
    const report = {
      generated: new Date().toISOString(),
      bucket: bucketName,
      summary: {
        totalFiles: allFiles.length,
        totalSize: formatBytes(totalSize),
        totalSizeBytes: totalSize,
        uniqueUsers: Object.keys(imagesByUser).length,
      },
      byContentType: imageTypes,
      byUser: Object.entries(imagesByUser).map(([userId, data]) => ({
        userId,
        fileCount: data.count,
        totalSize: formatBytes(data.size),
        totalSizeBytes: data.size,
      })).sort((a, b) => b.totalSizeBytes - a.totalSizeBytes),
      largestFiles: items.slice(0, 20), // Top 20 largest
      allFiles: items,
    };

    // Write detailed JSON
    const outPath = path.join(process.cwd(), 'firebase-storage-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`📝 Detailed report: ${outPath}`);

    // Write human-readable summary
    const summaryPath = path.join(process.cwd(), 'firebase-storage-summary.txt');
    const summary = `
Firebase Storage Report
Generated: ${report.generated}
Bucket: ${bucketName}

📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Files: ${report.summary.totalFiles}
Total Size: ${report.summary.totalSize}
Unique Users: ${report.summary.uniqueUsers}

📁 BY CONTENT TYPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${Object.entries(imageTypes).map(([type, count]) => `${type}: ${count} files`).join('\n')}

👥 TOP 10 USERS BY STORAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${report.byUser.slice(0, 10).map((u, i) => 
  `${i + 1}. ${u.userId.substring(0, 12)}... - ${u.fileCount} files (${u.totalSize})`
).join('\n')}

🔥 TOP 10 LARGEST FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${items.slice(0, 10).map((f, i) => 
  `${i + 1}. ${f.sizeFormatted} - ${f.name}`
).join('\n')}

📄 Full details: firebase-storage-report.json
`;

    fs.writeFileSync(summaryPath, summary);
    console.log(`📄 Summary: ${summaryPath}`);
    
    // Print summary to console
    console.log(summary);

  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('❌ Storage list error:', e);
  process.exit(1);
});

