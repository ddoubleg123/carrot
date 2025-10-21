#!/usr/bin/env node

/**
 * Test Content Extraction Script
 * 
 * This script tests the content extraction functionality
 * by fetching a real article and extracting content from it.
 */

const { extractReadableContent, extractKeyPoints, extractTimeline, extractEntities } = require('../src/lib/readability');

async function testContentExtraction() {
  console.log('🧪 Testing Content Extraction...');
  
  try {
    // Test with a real NBA article URL
    const testUrl = 'https://www.hoophall.com/hall-of-famers/michael-jordan/';
    
    console.log(`📄 Fetching content from: ${testUrl}`);
    
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log(`✅ Fetched ${html.length} characters of HTML`);
    
    // Extract content
    console.log('🔍 Extracting readable content...');
    const readable = extractReadableContent(html, testUrl);
    
    console.log('📊 Extraction Results:');
    console.log(`  Title: ${readable.title}`);
    console.log(`  Content Length: ${readable.content.length} chars`);
    console.log(`  Text Length: ${readable.textContent.length} chars`);
    console.log(`  Excerpt: ${readable.excerpt.substring(0, 200)}...`);
    
    // Extract key points
    console.log('🎯 Extracting key points...');
    const keyPoints = extractKeyPoints(readable.textContent, 5);
    console.log(`  Found ${keyPoints.length} key points:`);
    keyPoints.forEach((point, i) => {
      console.log(`    ${i + 1}. ${point.substring(0, 100)}...`);
    });
    
    // Extract timeline
    console.log('📅 Extracting timeline...');
    const timeline = extractTimeline(readable.textContent);
    console.log(`  Found ${timeline.length} timeline items:`);
    timeline.slice(0, 3).forEach((item, i) => {
      console.log(`    ${i + 1}. ${item.date}: ${item.content.substring(0, 80)}...`);
    });
    
    // Extract entities
    console.log('👥 Extracting entities...');
    const entities = extractEntities(readable.textContent);
    console.log(`  Found ${entities.length} entities:`);
    entities.slice(0, 5).forEach((entity, i) => {
      console.log(`    ${i + 1}. ${entity.type}: ${entity.name}`);
    });
    
    console.log('✅ Content extraction test completed successfully!');
    
  } catch (error) {
    console.error('❌ Content extraction test failed:', error.message);
  }
}

// Run the test
testContentExtraction();
