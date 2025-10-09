#!/usr/bin/env node

/**
 * Error Log Analyzer
 * 
 * This script analyzes error logs and provides a concise summary by:
 * - Grouping similar errors together
 * - Counting occurrences
 * - Showing unique error patterns
 * - Prioritizing critical errors
 * 
 * Usage:
 *   node scripts/analyze-errors.js < logs.txt
 *   or
 *   node scripts/analyze-errors.js logs.txt
 */

const fs = require('fs');
const path = require('path');

// Error patterns to detect and categorize
const ERROR_PATTERNS = {
  // Network errors
  QUIC_PROTOCOL_ERROR: /net::ERR_QUIC_PROTOCOL_ERROR/,
  CONNECTION_CLOSED: /net::ERR_CONNECTION_CLOSED/,
  NETWORK_ERROR: /net::ERR_/,
  
  // Media errors
  MEDIA_PRELOAD_FAILED: /\[MediaPreloadQueue\] Task failed/,
  VIDEO_LOADING_TIMEOUT: /\[SimpleVideo\] Loading timeout/,
  VIDEO_ERROR: /\[SimpleVideo\] Video error/,
  VIDEO_INVALID_FORMAT: /Invalid video (format|src)/,
  
  // Image errors
  IMAGE_LOAD_ERROR: /\[CommitmentCard\].*load ERROR/,
  IMAGE_PROXY_ERROR: /\[Image Proxy\]/,
  DATA_URI_BLOCKED: /data-uri-blocked/,
  
  // Proxy errors
  PROXY_ERROR: /\[proxVideo\]|\[prox\]/,
  
  // HTTP errors
  HTTP_400: /400/,
  HTTP_499: /499/,
  HTTP_500: /500/,
  
  // Firebase errors
  FIREBASE_ERROR: /Firebase|firebasestorage/,
  
  // Generic errors
  FAILED_TO_FETCH: /Failed to fetch/,
  UNCAUGHT_ERROR: /Uncaught|Unhandled/,
};

class ErrorAnalyzer {
  constructor() {
    this.errors = new Map();
    this.totalLines = 0;
    this.errorLines = 0;
  }

  categorizeError(line) {
    for (const [category, pattern] of Object.entries(ERROR_PATTERNS)) {
      if (pattern.test(line)) {
        return category;
      }
    }
    return 'OTHER';
  }

  extractErrorKey(line, category) {
    // Extract the core error message without timestamps, IDs, or URLs
    let key = line;
    
    // Remove timestamps
    key = key.replace(/\d{2}:\d{2}:\d{2}\.\d+/g, '');
    key = key.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '');
    
    // Remove post IDs
    key = key.replace(/postId[:\s]+[\w-]+/gi, '');
    
    // Remove URLs (but keep the domain for context)
    key = key.replace(/https?:\/\/[^\s]+/g, (url) => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname + urlObj.pathname.split('/').slice(0, 3).join('/');
      } catch {
        return '[URL]';
      }
    });
    
    // Remove long base64 data URIs
    key = key.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{50,}/g, 'data:image/[BASE64]');
    key = key.replace(/data:video\/[^;]+;base64,[A-Za-z0-9+/=]{50,}/g, 'data:video/[BASE64]');
    
    // Remove file paths (keep just the filename)
    key = key.replace(/[A-Z]:\\[^\s]+/g, (path) => {
      return path.split('\\').pop();
    });
    
    // Remove numbers that look like IDs or counts
    key = key.replace(/\b[0-9a-f]{8,}\b/gi, '[ID]');
    
    // Normalize whitespace
    key = key.replace(/\s+/g, ' ').trim();
    
    return key;
  }

  analyzeLine(line) {
    this.totalLines++;
    
    // Check if line contains an error
    const isError = /error|fail|invalid|blocked|timeout|denied|refused|abort/i.test(line) ||
                    /\b(4\d{2}|5\d{2})\b/.test(line) || // HTTP error codes
                    /net::ERR_/.test(line);
    
    if (isError) {
      this.errorLines++;
      
      const category = this.categorizeError(line);
      const key = this.extractErrorKey(line, category);
      
      if (!this.errors.has(category)) {
        this.errors.set(category, new Map());
      }
      
      const categoryErrors = this.errors.get(category);
      const currentCount = categoryErrors.get(key) || { count: 0, sample: line };
      categoryErrors.set(key, {
        count: currentCount.count + 1,
        sample: line
      });
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('ERROR LOG ANALYSIS REPORT');
    console.log('='.repeat(80));
    console.log(`\nTotal lines analyzed: ${this.totalLines}`);
    console.log(`Error lines found: ${this.errorLines}`);
    console.log(`Error rate: ${((this.errorLines / this.totalLines) * 100).toFixed(2)}%`);
    
    // Sort categories by total error count
    const categorySummary = [];
    for (const [category, errors] of this.errors.entries()) {
      const totalCount = Array.from(errors.values()).reduce((sum, err) => sum + err.count, 0);
      categorySummary.push({ category, totalCount, errors });
    }
    categorySummary.sort((a, b) => b.totalCount - a.totalCount);
    
    console.log('\n' + '-'.repeat(80));
    console.log('ERROR SUMMARY BY CATEGORY');
    console.log('-'.repeat(80));
    
    for (const { category, totalCount, errors } of categorySummary) {
      console.log(`\n[${category}] - ${totalCount} occurrences`);
      console.log('-'.repeat(80));
      
      // Sort errors within category by count
      const sortedErrors = Array.from(errors.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10); // Top 10 per category
      
      for (const [key, { count, sample }] of sortedErrors) {
        console.log(`  × ${count.toString().padStart(5)} | ${key}`);
        if (count === 1) {
          console.log(`           Sample: ${sample.slice(0, 100)}...`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('TOP 5 MOST COMMON ERRORS (ALL CATEGORIES)');
    console.log('='.repeat(80));
    
    const allErrors = [];
    for (const [category, errors] of this.errors.entries()) {
      for (const [key, data] of errors.entries()) {
        allErrors.push({ category, key, ...data });
      }
    }
    allErrors.sort((a, b) => b.count - a.count);
    
    for (let i = 0; i < Math.min(5, allErrors.length); i++) {
      const err = allErrors[i];
      console.log(`\n${i + 1}. [${err.category}] × ${err.count}`);
      console.log(`   ${err.key}`);
      console.log(`   Sample: ${err.sample.slice(0, 120)}...`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(80));
    
    this.generateRecommendations(categorySummary);
    
    console.log('\n');
  }

  generateRecommendations(categorySummary) {
    const recommendations = [];
    
    for (const { category, totalCount } of categorySummary) {
      switch (category) {
        case 'QUIC_PROTOCOL_ERROR':
          recommendations.push(`• QUIC Protocol Errors (${totalCount}): These are browser/network level issues. Consider checking if Firebase Storage URLs are being proxied unnecessarily.`);
          break;
        case 'CONNECTION_CLOSED':
          recommendations.push(`• Connection Closed Errors (${totalCount}): Check for double-encoding or slow proxy responses. Ensure direct Firebase URLs with tokens are used.`);
          break;
        case 'MEDIA_PRELOAD_FAILED':
          recommendations.push(`• Media Preload Failures (${totalCount}): Review MediaPreloadQueue implementation and ensure URLs are valid before queuing.`);
          break;
        case 'VIDEO_LOADING_TIMEOUT':
          recommendations.push(`• Video Loading Timeouts (${totalCount}): Videos are taking too long to load. Check if proxying can be bypassed for signed URLs.`);
          break;
        case 'VIDEO_INVALID_FORMAT':
          recommendations.push(`• Invalid Video Format (${totalCount}): Validation is working! Review database for posts with invalid video URLs and fix at the source.`);
          break;
        case 'IMAGE_LOAD_ERROR':
          recommendations.push(`• Image Load Errors (${totalCount}): Check if data URIs or Firebase URLs are being incorrectly proxied through /api/img.`);
          break;
        case 'DATA_URI_BLOCKED':
          recommendations.push(`• Data URI Blocked (${totalCount}): Good! The /api/img proxy is correctly rejecting data URIs. Ensure client doesn't send them.`);
          break;
        case 'HTTP_499':
          recommendations.push(`• HTTP 499 Client Timeouts (${totalCount}): Client is closing connections before server responds. Likely due to slow proxy or network issues.`);
          break;
        case 'HTTP_500':
          recommendations.push(`• HTTP 500 Server Errors (${totalCount}): Server-side errors need investigation. Check server logs for stack traces.`);
          break;
      }
    }
    
    if (recommendations.length === 0) {
      console.log('\n✅ No major error patterns detected!');
    } else {
      console.log('');
      recommendations.forEach(rec => console.log(rec));
    }
  }
}

// Main execution
function main() {
  const analyzer = new ErrorAnalyzer();
  
  // Check if file path is provided as argument
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // Read from file
    const filePath = args[0];
    console.log(`Reading from file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach(line => {
      if (line.trim()) {
        analyzer.analyzeLine(line);
      }
    });
    
    analyzer.generateReport();
  } else {
    // Read from stdin
    console.log('Reading from stdin... (Paste your logs and press Ctrl+D when done)');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    rl.on('line', (line) => {
      analyzer.analyzeLine(line);
    });
    
    rl.on('close', () => {
      analyzer.generateReport();
    });
  }
}

main();

