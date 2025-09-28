const fs = require('fs');
const path = require('path');

const AGENTS_FILE = path.join(__dirname, '../src/lib/agents.ts');

// Read the file
let content = fs.readFileSync(AGENTS_FILE, 'utf8');

// Replace all .png with .jpg in avatar paths
content = content.replace(/avatar: '\/agents\/([^']+)\.png'/g, "avatar: '/agents/$1.jpg'");

// Write back to file
fs.writeFileSync(AGENTS_FILE, content);

console.log('✅ Updated all agent avatar paths from .png to .jpg');
