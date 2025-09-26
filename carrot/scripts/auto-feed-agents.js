#!/usr/bin/env node

/**
 * Auto Feed Agents Script
 * 
 * This script allows you to automatically feed content to all your AI agents
 * without having to manually click through the UI.
 * 
 * Usage:
 * node scripts/auto-feed-agents.js --url "https://example.com/article"
 * node scripts/auto-feed-agents.js --text "Your text content here"
 * node scripts/auto-feed-agents.js --file "path/to/file.txt"
 */

const fetch = require('node-fetch');

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://carrot-app.onrender.com';

async function getAgents() {
  try {
    const response = await fetch(`${API_BASE}/api/agents`);
    const data = await response.json();
    return data.agents || [];
  } catch (error) {
    console.error('Error fetching agents:', error);
    return [];
  }
}

async function batchFeedAgents(agentIds, feedItem) {
  try {
    const response = await fetch(`${API_BASE}/api/agents/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'feed',
        agentIds,
        feedItem
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error batch feeding agents:', error);
    throw error;
  }
}

async function feedByExpertise(content, sourceType, expertiseTags) {
  try {
    const response = await fetch(`${API_BASE}/api/agents/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'expertise',
        content,
        sourceType,
        expertiseTags
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error feeding by expertise:', error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🤖 Auto Feed Agents Script

Usage:
  node scripts/auto-feed-agents.js --url "https://example.com/article"
  node scripts/auto-feed-agents.js --text "Your text content here"
  node scripts/auto-feed-agents.js --file "path/to/file.txt"
  node scripts/auto-feed-agents.js --expertise "physics" --text "Physics content here"

Options:
  --url <url>        Feed a URL to all agents
  --text <text>      Feed text content to all agents
  --file <path>      Feed file content to all agents
  --expertise <tag>  Only feed to agents with specific expertise
  --agents <ids>     Comma-separated list of agent IDs (optional)
  --title <title>    Custom title for the content (optional)
  --author <author>  Custom author for the content (optional)

Examples:
  # Feed a Wikipedia article to all agents
  node scripts/auto-feed-agents.js --url "https://en.wikipedia.org/wiki/Artificial_intelligence"

  # Feed text to all agents
  node scripts/auto-feed-agents.js --text "The future of AI is bright and full of possibilities."

  # Feed only to physics experts
  node scripts/auto-feed-agents.js --expertise "physics" --text "Quantum mechanics is fascinating."

  # Feed to specific agents
  node scripts/auto-feed-agents.js --agents "agent1,agent2" --text "Custom content"
    `);
    return;
  }

  // Parse arguments
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = value;
  }

  console.log('🤖 Auto Feed Agents Script Starting...\n');

  // Get all agents
  console.log('📋 Fetching agents...');
  const agents = await getAgents();
  
  if (agents.length === 0) {
    console.error('❌ No agents found. Please create some agents first.');
    return;
  }

  console.log(`✅ Found ${agents.length} agents:`);
  agents.forEach(agent => {
    console.log(`   - ${agent.name} (${agent.domainExpertise.slice(0, 2).join(', ')})`);
  });

  // Determine which agents to feed
  let targetAgents = agents;
  
  if (options.agents) {
    const agentIds = options.agents.split(',').map(id => id.trim());
    targetAgents = agents.filter(agent => agentIds.includes(agent.id));
    console.log(`\n🎯 Targeting specific agents: ${targetAgents.map(a => a.name).join(', ')}`);
  } else if (options.expertise) {
    targetAgents = agents.filter(agent => 
      agent.domainExpertise.some(exp => 
        exp.toLowerCase().includes(options.expertise.toLowerCase())
      )
    );
    console.log(`\n🎯 Targeting agents with "${options.expertise}" expertise: ${targetAgents.map(a => a.name).join(', ')}`);
  } else {
    console.log(`\n🎯 Targeting all ${targetAgents.length} agents`);
  }

  if (targetAgents.length === 0) {
    console.error('❌ No agents match your criteria.');
    return;
  }

  // Prepare feed item
  let feedItem;
  
  if (options.url) {
    feedItem = {
      content: options.url,
      sourceType: 'url',
      sourceUrl: options.url,
      sourceTitle: options.title || 'Auto-fed URL',
      sourceAuthor: options.author || 'Auto Feed Script',
      tags: []
    };
    console.log(`\n📡 Feeding URL: ${options.url}`);
  } else if (options.text) {
    feedItem = {
      content: options.text,
      sourceType: 'manual',
      sourceTitle: options.title || 'Auto-fed Text',
      sourceAuthor: options.author || 'Auto Feed Script',
      tags: []
    };
    console.log(`\n📝 Feeding text content (${options.text.length} characters)`);
  } else if (options.file) {
    const fs = require('fs');
    try {
      const content = fs.readFileSync(options.file, 'utf8');
      feedItem = {
        content,
        sourceType: 'file',
        sourceTitle: options.title || `Auto-fed file: ${options.file}`,
        sourceAuthor: options.author || 'Auto Feed Script',
        tags: []
      };
      console.log(`\n📄 Feeding file: ${options.file} (${content.length} characters)`);
    } catch (error) {
      console.error(`❌ Error reading file: ${error.message}`);
      return;
    }
  } else {
    console.error('❌ Please provide --url, --text, or --file');
    return;
  }

  // Feed to agents
  console.log(`\n🚀 Feeding content to ${targetAgents.length} agents...`);
  
  try {
    const results = await batchFeedAgents(
      targetAgents.map(agent => agent.id),
      feedItem
    );

    console.log('\n✅ Feed Results:');
    results.results.forEach((result, index) => {
      const agent = targetAgents[index];
      if (result.success) {
        console.log(`   ✅ ${agent.name}: ${result.memoriesCreated} memories created`);
      } else {
        console.log(`   ❌ ${agent.name}: ${result.error}`);
      }
    });

    const successCount = results.results.filter(r => r.success).length;
    console.log(`\n🎉 Successfully fed to ${successCount}/${targetAgents.length} agents!`);

  } catch (error) {
    console.error('❌ Error during batch feed:', error.message);
  }
}

// Run the script
main().catch(console.error);
