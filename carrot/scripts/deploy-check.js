#!/usr/bin/env node

/**
 * Deployment health check script
 * Verifies that the application is ready for deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Running deployment health checks...\n');

// Check if required files exist
const requiredFiles = [
  'next.config.js',
  'package.json',
  'src/app/api/health/route.ts',
  'src/lib/MediaPreloadQueue.ts',
  'src/lib/retryUtils.ts'
];

let allChecksPassed = true;

for (const file of requiredFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
    allChecksPassed = false;
  }
}

// Check Next.js configuration
try {
  const nextConfigPath = path.join(__dirname, '..', 'next.config.js');
  const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
  
  if (nextConfigContent.includes('maxSize: 244000')) {
    console.log('✅ Next.js chunk splitting configured correctly');
  } else {
    console.log('❌ Next.js chunk splitting not configured properly');
    allChecksPassed = false;
  }
  
  if (nextConfigContent.includes('Connection') && nextConfigContent.includes('keep-alive')) {
    console.log('✅ HTTP headers configured for better compatibility');
  } else {
    console.log('❌ HTTP headers not configured properly');
    allChecksPassed = false;
  }
} catch (error) {
  console.log('❌ Error reading Next.js configuration:', error.message);
  allChecksPassed = false;
}

// Check package.json for required dependencies
try {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const requiredDeps = ['next', 'react', 'react-dom'];
  for (const dep of requiredDeps) {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep} dependency found`);
    } else {
      console.log(`❌ ${dep} dependency missing`);
      allChecksPassed = false;
    }
  }
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
  allChecksPassed = false;
}

console.log('\n' + '='.repeat(50));

if (allChecksPassed) {
  console.log('🎉 All deployment checks passed! Ready to deploy.');
  process.exit(0);
} else {
  console.log('❌ Some deployment checks failed. Please fix the issues above.');
  process.exit(1);
}
