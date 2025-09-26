#!/usr/bin/env node

/**
 * Individual Agent Training Workflow Script
 * 
 * This script allows you to train individual agents with predefined workflows
 * that can be replicated and scaled across multiple agents.
 * 
 * Usage:
 * node scripts/train-agent-workflow.js --agent "Albert Einstein" --workflow "physics"
 * node scripts/train-agent-workflow.js --agent-id "agent123" --workflow "economics"
 * node scripts/train-agent-workflow.js --list-workflows
 * node scripts/train-agent-workflow.js --list-agents
 */

const fetch = require('node-fetch');

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://carrot-app.onrender.com';

// Predefined training workflows
const TRAINING_WORKFLOWS = {
  physics: {
    name: 'Physics Mastery Program',
    description: 'Comprehensive physics training covering fundamentals to advanced concepts',
    steps: [
      {
        name: 'Physics Fundamentals',
        content: 'https://en.wikipedia.org/wiki/Physics',
        sourceType: 'url',
        sourceTitle: 'Physics - Wikipedia'
      },
      {
        name: 'Quantum Mechanics',
        content: 'https://en.wikipedia.org/wiki/Quantum_mechanics',
        sourceType: 'url',
        sourceTitle: 'Quantum Mechanics - Wikipedia'
      },
      {
        name: 'Theory of Relativity',
        content: 'https://en.wikipedia.org/wiki/Theory_of_relativity',
        sourceType: 'url',
        sourceTitle: 'Theory of Relativity - Wikipedia'
      },
      {
        name: 'Modern Physics',
        content: 'https://en.wikipedia.org/wiki/Modern_physics',
        sourceType: 'url',
        sourceTitle: 'Modern Physics - Wikipedia'
      },
      {
        name: 'Particle Physics',
        content: 'https://en.wikipedia.org/wiki/Particle_physics',
        sourceType: 'url',
        sourceTitle: 'Particle Physics - Wikipedia'
      }
    ]
  },
  
  economics: {
    name: 'Economics Mastery Program',
    description: 'Comprehensive economics training from micro to macroeconomics',
    steps: [
      {
        name: 'Economic Theory',
        content: 'https://en.wikipedia.org/wiki/Economics',
        sourceType: 'url',
        sourceTitle: 'Economics - Wikipedia'
      },
      {
        name: 'Microeconomics',
        content: 'https://en.wikipedia.org/wiki/Microeconomics',
        sourceType: 'url',
        sourceTitle: 'Microeconomics - Wikipedia'
      },
      {
        name: 'Macroeconomics',
        content: 'https://en.wikipedia.org/wiki/Macroeconomics',
        sourceType: 'url',
        sourceTitle: 'Macroeconomics - Wikipedia'
      },
      {
        name: 'Keynesian Economics',
        content: 'https://en.wikipedia.org/wiki/Keynesian_economics',
        sourceType: 'url',
        sourceTitle: 'Keynesian Economics - Wikipedia'
      },
      {
        name: 'Fiscal Policy',
        content: 'https://en.wikipedia.org/wiki/Fiscal_policy',
        sourceType: 'url',
        sourceTitle: 'Fiscal Policy - Wikipedia'
      }
    ]
  },

  mathematics: {
    name: 'Mathematics Mastery Program',
    description: 'Comprehensive mathematics training from foundations to advanced topics',
    steps: [
      {
        name: 'Mathematical Foundations',
        content: 'https://en.wikipedia.org/wiki/Mathematics',
        sourceType: 'url',
        sourceTitle: 'Mathematics - Wikipedia'
      },
      {
        name: 'Algebra',
        content: 'https://en.wikipedia.org/wiki/Algebra',
        sourceType: 'url',
        sourceTitle: 'Algebra - Wikipedia'
      },
      {
        name: 'Calculus',
        content: 'https://en.wikipedia.org/wiki/Calculus',
        sourceType: 'url',
        sourceTitle: 'Calculus - Wikipedia'
      },
      {
        name: 'Statistics',
        content: 'https://en.wikipedia.org/wiki/Statistics',
        sourceType: 'url',
        sourceTitle: 'Statistics - Wikipedia'
      },
      {
        name: 'Algorithms',
        content: 'https://en.wikipedia.org/wiki/Algorithm',
        sourceType: 'url',
        sourceTitle: 'Algorithm - Wikipedia'
      }
    ]
  },

  computer_science: {
    name: 'Computer Science Mastery Program',
    description: 'Comprehensive computer science training from basics to advanced concepts',
    steps: [
      {
        name: 'Computer Science Fundamentals',
        content: 'https://en.wikipedia.org/wiki/Computer_science',
        sourceType: 'url',
        sourceTitle: 'Computer Science - Wikipedia'
      },
      {
        name: 'Programming Concepts',
        content: 'https://en.wikipedia.org/wiki/Computer_programming',
        sourceType: 'url',
        sourceTitle: 'Computer Programming - Wikipedia'
      },
      {
        name: 'Data Structures',
        content: 'https://en.wikipedia.org/wiki/Data_structure',
        sourceType: 'url',
        sourceTitle: 'Data Structure - Wikipedia'
      },
      {
        name: 'Algorithms',
        content: 'https://en.wikipedia.org/wiki/Algorithm',
        sourceType: 'url',
        sourceTitle: 'Algorithm - Wikipedia'
      },
      {
        name: 'Artificial Intelligence',
        content: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
        sourceType: 'url',
        sourceTitle: 'Artificial Intelligence - Wikipedia'
      }
    ]
  },

  history: {
    name: 'History Mastery Program',
    description: 'Comprehensive historical knowledge from ancient to modern times',
    steps: [
      {
        name: 'World History Overview',
        content: 'https://en.wikipedia.org/wiki/History',
        sourceType: 'url',
        sourceTitle: 'History - Wikipedia'
      },
      {
        name: 'Ancient Civilizations',
        content: 'https://en.wikipedia.org/wiki/Ancient_history',
        sourceType: 'url',
        sourceTitle: 'Ancient History - Wikipedia'
      },
      {
        name: 'Medieval Period',
        content: 'https://en.wikipedia.org/wiki/Middle_Ages',
        sourceType: 'url',
        sourceTitle: 'Middle Ages - Wikipedia'
      },
      {
        name: 'Modern History',
        content: 'https://en.wikipedia.org/wiki/Modern_history',
        sourceType: 'url',
        sourceTitle: 'Modern History - Wikipedia'
      },
      {
        name: 'Contemporary History',
        content: 'https://en.wikipedia.org/wiki/Contemporary_history',
        sourceType: 'url',
        sourceTitle: 'Contemporary History - Wikipedia'
      }
    ]
  }
};

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

async function findAgent(agentNameOrId) {
  const agents = await getAgents();
  
  // Try to find by ID first
  let agent = agents.find(a => a.id === agentNameOrId);
  
  // If not found by ID, try to find by name
  if (!agent) {
    agent = agents.find(a => 
      a.name.toLowerCase().includes(agentNameOrId.toLowerCase()) ||
      agentNameOrId.toLowerCase().includes(a.name.toLowerCase())
    );
  }
  
  return agent;
}

async function feedAgent(agentId, step) {
  try {
    const feedItem = {
      content: step.content,
      sourceType: step.sourceType,
      sourceUrl: step.sourceType === 'url' ? step.content : undefined,
      sourceTitle: step.sourceTitle || step.name,
      sourceAuthor: 'Training System',
      tags: []
    };

    const response = await fetch(`${API_BASE}/api/agents/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'feed',
        agentIds: [agentId],
        feedItem
      }),
    });

    const data = await response.json();
    
    if (response.ok && data.results && data.results[0]?.success) {
      return { success: true, memoriesCreated: data.results[0].memoriesCreated };
    } else {
      return { success: false, error: data.results?.[0]?.error || 'Unknown error' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function trainAgent(agent, workflow) {
  console.log(`\n🎓 Starting ${workflow.name} for ${agent.name}`);
  console.log(`📚 ${workflow.description}`);
  console.log(`📋 ${workflow.steps.length} training steps\n`);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const stepNumber = i + 1;
    
    console.log(`[${stepNumber}/${workflow.steps.length}] ${step.name}...`);
    
    const result = await feedAgent(agent.id, step);
    
    if (result.success) {
      console.log(`   ✅ Success! ${result.memoriesCreated} memories created`);
      successCount++;
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      failureCount++;
    }
    
    // Small delay between steps
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n🎉 Training Complete!`);
  console.log(`   ✅ Successful steps: ${successCount}`);
  console.log(`   ❌ Failed steps: ${failureCount}`);
  console.log(`   📊 Success rate: ${((successCount / workflow.steps.length) * 100).toFixed(1)}%`);
}

async function listWorkflows() {
  console.log('\n📚 Available Training Workflows:\n');
  
  Object.entries(TRAINING_WORKFLOWS).forEach(([key, workflow]) => {
    console.log(`🔹 ${key}`);
    console.log(`   Name: ${workflow.name}`);
    console.log(`   Description: ${workflow.description}`);
    console.log(`   Steps: ${workflow.steps.length}`);
    console.log('');
  });
}

async function listAgents() {
  console.log('\n🤖 Available Agents:\n');
  
  const agents = await getAgents();
  
  if (agents.length === 0) {
    console.log('   No agents found. Please create some agents first.');
    return;
  }
  
  agents.forEach(agent => {
    console.log(`🔹 ${agent.name} (ID: ${agent.id})`);
    console.log(`   Expertise: ${agent.domainExpertise.slice(0, 3).join(', ')}`);
    console.log('');
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🎓 Individual Agent Training Workflow Script

This script allows you to train individual agents with predefined workflows
that can be replicated and scaled across multiple agents.

Usage:
  node scripts/train-agent-workflow.js --agent "Albert Einstein" --workflow "physics"
  node scripts/train-agent-workflow.js --agent-id "agent123" --workflow "economics"
  node scripts/train-agent-workflow.js --list-workflows
  node scripts/train-agent-workflow.js --list-agents

Options:
  --agent <name>        Agent name (partial match supported)
  --agent-id <id>       Agent ID (exact match)
  --workflow <name>     Training workflow name
  --list-workflows      Show available training workflows
  --list-agents         Show available agents

Examples:
  # Train Albert Einstein with physics workflow
  node scripts/train-agent-workflow.js --agent "Einstein" --workflow "physics"

  # Train John Maynard Keynes with economics workflow
  node scripts/train-agent-workflow.js --agent "Keynes" --workflow "economics"

  # Train Ada Lovelace with computer science workflow
  node scripts/train-agent-workflow.js --agent "Ada" --workflow "computer_science"

  # List all available workflows
  node scripts/train-agent-workflow.js --list-workflows

  # List all available agents
  node scripts/train-agent-workflow.js --list-agents
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

  console.log('🎓 Individual Agent Training Workflow Script Starting...\n');

  // Handle list commands
  if (options['list-workflows']) {
    await listWorkflows();
    return;
  }

  if (options['list-agents']) {
    await listAgents();
    return;
  }

  // Validate required arguments
  if (!options.agent && !options['agent-id']) {
    console.error('❌ Please specify --agent or --agent-id');
    return;
  }

  if (!options.workflow) {
    console.error('❌ Please specify --workflow');
    return;
  }

  // Get workflow
  const workflow = TRAINING_WORKFLOWS[options.workflow];
  if (!workflow) {
    console.error(`❌ Unknown workflow: ${options.workflow}`);
    console.log('Use --list-workflows to see available workflows');
    return;
  }

  // Find agent
  const agentIdentifier = options['agent-id'] || options.agent;
  const agent = await findAgent(agentIdentifier);
  
  if (!agent) {
    console.error(`❌ Agent not found: ${agentIdentifier}`);
    console.log('Use --list-agents to see available agents');
    return;
  }

  // Start training
  await trainAgent(agent, workflow);
}

// Run the script
main().catch(console.error);
