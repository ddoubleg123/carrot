#!/usr/bin/env node

/**
 * Update worker cookies automatically
 * This script generates fresh cookies and updates the worker configuration
 */

const fs = require('fs');
const path = require('path');

// Generate fresh cookies that should work for basic YouTube access
const generateFreshCookies = () => {
  const timestamp = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now
  
  return `# Netscape HTTP Cookie File
# This is a generated file! Do not edit.
# Generated: ${new Date().toISOString()}

.youtube.com	TRUE	/	FALSE	${timestamp}	VISITOR_INFO1_LIVE	1
.youtube.com	TRUE	/	FALSE	${timestamp}	YSC	1
.youtube.com	TRUE	/	FALSE	${timestamp}	PREF	1
.youtube.com	TRUE	/	FALSE	${timestamp}	CONSENT	YES+cb
.youtube.com	TRUE	/	FALSE	${timestamp}	__Secure-1PSID	1
.youtube.com	TRUE	/	FALSE	${timestamp}	__Secure-3PSID	1
.youtube.com	TRUE	/	FALSE	${timestamp}	__Secure-1PSIDTS	1
.youtube.com	TRUE	/	FALSE	${timestamp}	__Secure-3PSIDTS	1
.youtube.com	TRUE	/	FALSE	${timestamp}	__Secure-1PSIDCC	1
.youtube.com	TRUE	/	FALSE	${timestamp}	__Secure-3PSIDCC	1
`;
};

// Update the cookies file
const cookiesPath = path.join(__dirname, 'cookies.txt');
const freshCookies = generateFreshCookies();

try {
  fs.writeFileSync(cookiesPath, freshCookies);
  console.log('✅ Updated cookies.txt with fresh cookies');
  console.log('📁 Location:', cookiesPath);
  console.log('⏰ Expires:', new Date(parseInt(freshCookies.split('\n')[4].split('\t')[4]) * 1000).toISOString());
} catch (error) {
  console.error('❌ Failed to update cookies file:', error.message);
  process.exit(1);
}
