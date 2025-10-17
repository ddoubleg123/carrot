# How to View Firebase Storage Images

## 🖼️ Three Ways to View Your Generated Images

---

## Method 1: Firebase Console (Easiest - 30 seconds)

### Step 1: Go to Firebase Console
Open: [https://console.firebase.google.com/](https://console.firebase.google.com/)

### Step 2: Select Your Project
Click on your Carrot project (find your project ID in `carrot/src/lib/firebase.ts`)

### Step 3: Navigate to Storage
1. Click **"Storage"** in the left sidebar
2. Click **"Files"** tab
3. Browse your directory structure:
   ```
   users/
     ├── {userId}/
     │   ├── posts/          ← User post images
     │   ├── staged/         ← Onboarding images
     │   └── profile/        ← Profile photos
   ```

### Step 4: View Images
- Click any image to preview
- See metadata (size, date, content type)
- Download individual images
- Get public URLs
- Delete files

**Advantages:**
- ✅ Visual interface
- ✅ Preview images directly
- ✅ No code needed
- ✅ See metadata easily

---

## Method 2: Use Your Existing List Script

### Step 1: Set Up Environment Variables
Create `carrot/.env.local` with your Firebase Admin credentials:

```bash
# Get these from Firebase Console > Project Settings > Service Accounts
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Key-Here\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

### Step 2: Run the Script
```bash
cd carrot
node scripts/list-storage.mjs
```

### Step 3: View Results
Opens `carrot/debug_storage.json` with:
```json
{
  "ok": true,
  "bucket": "your-project.appspot.com",
  "count": 42,
  "items": [
    {
      "name": "users/abc123/posts/1234567890_image.png",
      "size": "2048576",
      "contentType": "image/png",
      "updated": "2025-10-14T12:34:56Z"
    }
  ]
}
```

**Advantages:**
- ✅ Programmable
- ✅ Export to JSON
- ✅ Can process results

**Limitations:**
- ⚠️ Only shows first 50 files (by default)

---

## Method 3: Enhanced List Script (Shows ALL Images)

I'll create an improved version that:
- Shows ALL images (not just 50)
- Groups by user
- Shows total storage usage
- Filters by date/type
- Generates download URLs

### Create: `carrot/scripts/list-all-images.mjs`

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

function loadEnvFile(p) {
  try {
    const txt = fs.readFileSync(p, 'utf8');
    for (const line of txt.split(/\\r?\\n/)) {
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

const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\\\n/g, '\\n');
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
      console.log(\`   Fetching page \${pageCount}...\`);
      const [files, nextPageToken] = await bucket.getFiles({
        maxResults: 1000,
        pageToken: pageToken,
      });
      allFiles = allFiles.concat(files);
      pageToken = nextPageToken;
    } while (pageToken);

    console.log(\`✅ Found \${allFiles.length} total files\\n\`);

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
        publicUrl: \`https://storage.googleapis.com/\${bucketName}/\${encodeURIComponent(name)}\`,
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
    console.log(\`📝 Detailed report: \${outPath}\`);

    // Write human-readable summary
    const summaryPath = path.join(process.cwd(), 'firebase-storage-summary.txt');
    const summary = \`
Firebase Storage Report
Generated: \${report.generated}
Bucket: \${bucketName}

📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Files: \${report.summary.totalFiles}
Total Size: \${report.summary.totalSize}
Unique Users: \${report.summary.uniqueUsers}

📁 BY CONTENT TYPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\${Object.entries(imageTypes).map(([type, count]) => \`\${type}: \${count} files\`).join('\\n')}

👥 TOP 10 USERS BY STORAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\${report.byUser.slice(0, 10).map((u, i) => 
  \`\${i + 1}. \${u.userId.substring(0, 12)}... - \${u.fileCount} files (\${u.totalSize})\`
).join('\\n')}

🔥 TOP 10 LARGEST FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\${items.slice(0, 10).map((f, i) => 
  \`\${i + 1}. \${f.sizeFormatted} - \${f.name}\`
).join('\\n')}

📄 Full details: firebase-storage-report.json
\`;

    fs.writeFileSync(summaryPath, summary);
    console.log(\`📄 Summary: \${summaryPath}\`);
    
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
```

### Run It:
```bash
cd carrot
node scripts/list-all-images.mjs
```

### Output:
- `firebase-storage-report.json` - Full details with URLs
- `firebase-storage-summary.txt` - Human-readable summary

**Advantages:**
- ✅ Shows ALL files (not just 50)
- ✅ Groups by user
- ✅ Shows storage usage per user
- ✅ Provides download URLs
- ✅ Identifies largest files
- ✅ Content type breakdown

---

## Method 4: Firebase CLI (Command Line)

### Install Firebase CLI:
```bash
npm install -g firebase-tools
```

### Login:
```bash
firebase login
```

### List Files:
```bash
# List all files
firebase storage:get gs://your-bucket-name.appspot.com

# List specific directory
firebase storage:get gs://your-bucket-name.appspot.com/users/

# Download a file
firebase storage:download gs://your-bucket-name.appspot.com/path/to/image.png
```

---

## 🎯 Quick Start: What I Recommend

### For Quick Viewing:
**Use Method 1 (Firebase Console)** - Easiest, visual interface, no setup

### For Analysis/Reporting:
**Use Method 3 (Enhanced Script)** - Shows ALL images, storage usage, grouping

### To Download Images:
**Use Firebase CLI** - Fast batch downloads

---

## 📋 Where Images Are Stored

Your images follow this structure:
```
gs://your-project.appspot.com/
  ├── users/
  │   ├── {userId1}/
  │   │   ├── posts/
  │   │   │   ├── 1234567890_0_image.png      ← Post images
  │   │   │   └── 1234567891_1_image.png
  │   │   ├── staged/
  │   │   │   └── {sessionId}/
  │   │   │       └── {assetId}.jpg           ← Onboarding photos
  │   │   └── profile/
  │   │       └── avatar.jpg                  ← Profile photos
  │   └── {userId2}/
  │       └── ...
```

---

## 🔐 Getting Firebase Admin Credentials

If you need to set up `.env.local` for the scripts:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click ⚙️ **Settings** > **Project Settings**
4. Go to **Service Accounts** tab
5. Click **"Generate new private key"**
6. Save the JSON file
7. Extract values to `carrot/.env.local`:
   ```bash
   FIREBASE_PROJECT_ID=xxx
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@xxx.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_STORAGE_BUCKET=xxx.appspot.com
   ```

---

## 💡 Pro Tips

1. **Filter Images by Date:**
   Modify the script to filter by `updated` date

2. **Download All Images:**
   Use the script to generate URLs, then use wget/curl

3. **Check Storage Quota:**
   Firebase Console > Storage shows usage vs quota

4. **Clean Up Old Images:**
   Write a script to delete images older than X days

---

**Which method would you like to use?** I can help you set up any of them! 🚀

