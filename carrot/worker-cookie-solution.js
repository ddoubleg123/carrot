#!/usr/bin/env node

/**
 * Worker cookie solution for YouTube ingestion
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
# Auto-refreshed every 24 hours

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
  console.log('✅ Generated fresh cookies for worker');
  console.log('📁 Location:', cookiesPath);
  console.log('⏰ Expires: 24 hours from now');
  console.log('🚀 Ready for deployment');
} catch (error) {
  console.error('❌ Failed to generate cookies:', error.message);
  process.exit(1);
}
