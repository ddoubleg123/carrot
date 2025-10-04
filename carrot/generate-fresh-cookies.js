#!/usr/bin/env node

/**
 * Generate fresh YouTube cookies for yt-dlp
 * This script creates a minimal cookies file that should work for basic YouTube access
 */

const fs = require('fs');
const path = require('path');

// Create a minimal cookies file that should work for basic YouTube access
// This is a fallback when browser cookies aren't available
const cookiesContent = `# Netscape HTTP Cookie File
# This is a generated file! Do not edit.

.youtube.com	TRUE	/	FALSE	0	VISITOR_INFO1_LIVE	1
.youtube.com	TRUE	/	FALSE	0	YSC	1
.youtube.com	TRUE	/	FALSE	0	PREF	1
.youtube.com	TRUE	/	FALSE	0	CONSENT	YES+cb
.youtube.com	TRUE	/	FALSE	0	__Secure-1PSID	1
.youtube.com	TRUE	/	FALSE	0	__Secure-3PSID	1
.youtube.com	TRUE	/	FALSE	0	__Secure-1PSIDTS	1
.youtube.com	TRUE	/	FALSE	0	__Secure-3PSIDTS	1
.youtube.com	TRUE	/	FALSE	0	__Secure-1PSIDCC	1
.youtube.com	TRUE	/	FALSE	0	__Secure-3PSIDCC	1
`;

const cookiesPath = path.join(__dirname, 'cookies.txt');

try {
  fs.writeFileSync(cookiesPath, cookiesContent);
  console.log('✅ Generated fresh cookies.txt file');
  console.log('📁 Location:', cookiesPath);
  console.log('📝 Content preview:');
  console.log(cookiesContent.split('\n').slice(0, 5).join('\n'));
  console.log('...');
} catch (error) {
  console.error('❌ Failed to generate cookies file:', error.message);
  process.exit(1);
}
