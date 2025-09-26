#!/usr/bin/env node

/**
 * Training Tracker Script
 * 
 * This script allows you to track and view what each agent has been trained on.
 * 
 * Usage:
 * node scripts/training-tracker.js --list
 * node scripts/training-tracker.js --agent "MLK"
 * node scripts/training-tracker.js --workflow "history"
 * node scripts/training-tracker.js --stats
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://carrot-app.onrender.com';
const TRAINING_RECORDS_FILE = path.join(__dirname, '..', 'data', 'training-records.json');

// Ensure data directory exists
const dataDir = path.dirname(TRAINING_RECORDS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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

async function getAgentMemories(agentId) {
  try {
    const response = await fetch(`${API_BASE}/api/agents/${agentId}/memories`);
    const data = await response.json();
    return data.memories || [];
  } catch (error) {
    console.error(`Error fetching memories for agent ${agentId}:`, error);
    return [];
  }
}

function loadTrainingRecords() {
  try {
    if (fs.existsSync(TRAINING_RECORDS_FILE)) {
      return JSON.parse(fs.readFileSync(TRAINING_RECORDS_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading training records:', error);
  }
  return [];
}

function saveTrainingRecords(records) {
  try {
    fs.writeFileSync(TRAINING_RECORDS_FILE, JSON.stringify(records, null, 2));
  } catch (error) {
    console.error('Error saving training records:', error);
  }
}

function addTrainingRecord(agentId, agentName, workflowName, workflowType, steps, status = 'completed') {
  const records = loadTrainingRecords();
  
  const record = {
    id: `training-${Date.now()}`,
    agentId,
    agentName,
    workflowName,
    workflowType,
    steps,
    startedAt: new Date().toISOString(),
    completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    status,
    successRate: steps.filter(s => s.success).length / steps.length * 100
  };
  
  records.push(record);
  saveTrainingRecords(records);
  
  return record;
}

async function listTrainingRecords() {
  const records = loadTrainingRecords();
  
  if (records.length === 0) {
    console.log('📚 No training records found.');
    console.log('Start training agents to see their progress here.');
    return;
  }
  
  console.log('\n📚 Training Records:\n');
  
  records.forEach((record, index) => {
    console.log(`${index + 1}. ${record.workflowName}`);
    console.log(`   Agent: ${record.agentName}`);
    console.log(`   Type: ${record.workflowType}`);
    console.log(`   Status: ${record.status}`);
    console.log(`   Success Rate: ${record.successRate.toFixed(1)}%`);
    console.log(`   Steps: ${record.steps.length}`);
    console.log(`   Started: ${new Date(record.startedAt).toLocaleDateString()}`);
    if (record.completedAt) {
      console.log(`   Completed: ${new Date(record.completedAt).toLocaleDateString()}`);
    }
    console.log('');
  });
}

async function showAgentTraining(agentName) {
  const agents = await getAgents();
  const agent = agents.find(a => 
    a.name.toLowerCase().includes(agentName.toLowerCase()) ||
    agentName.toLowerCase().includes(a.name.toLowerCase())
  );
  
  if (!agent) {
    console.error(`❌ Agent not found: ${agentName}`);
    console.log('Available agents:');
    agents.forEach(a => console.log(`   - ${a.name}`));
    return;
  }
  
  const records = loadTrainingRecords();
  const agentRecords = records.filter(r => r.agentId === agent.id);
  
  console.log(`\n🎓 Training History for ${agent.name}\n`);
  
  if (agentRecords.length === 0) {
    console.log('   No training records found for this agent.');
    console.log('   Start training to see progress here.');
    return;
  }
  
  agentRecords.forEach((record, index) => {
    console.log(`${index + 1}. ${record.workflowName}`);
    console.log(`   Type: ${record.workflowType}`);
    console.log(`   Status: ${record.status}`);
    console.log(`   Success Rate: ${record.successRate.toFixed(1)}%`);
    console.log(`   Steps: ${record.steps.length}`);
    console.log(`   Started: ${new Date(record.startedAt).toLocaleDateString()}`);
    if (record.completedAt) {
      console.log(`   Completed: ${new Date(record.completedAt).toLocaleDateString()}`);
    }
    
    console.log('   Training Steps:');
    record.steps.forEach((step, stepIndex) => {
      const status = step.success ? '✅' : '❌';
      console.log(`     ${stepIndex + 1}. ${status} ${step.name}`);
    });
    console.log('');
  });
}

async function showWorkflowTraining(workflowType) {
  const records = loadTrainingRecords();
  const workflowRecords = records.filter(r => r.workflowType === workflowType);
  
  console.log(`\n📋 Training Records for ${workflowType} Workflow\n`);
  
  if (workflowRecords.length === 0) {
    console.log(`   No training records found for ${workflowType} workflow.`);
    return;
  }
  
  workflowRecords.forEach((record, index) => {
    console.log(`${index + 1}. ${record.agentName}`);
    console.log(`   Workflow: ${record.workflowName}`);
    console.log(`   Status: ${record.status}`);
    console.log(`   Success Rate: ${record.successRate.toFixed(1)}%`);
    console.log(`   Started: ${new Date(record.startedAt).toLocaleDateString()}`);
    if (record.completedAt) {
      console.log(`   Completed: ${new Date(record.completedAt).toLocaleDateString()}`);
    }
    console.log('');
  });
}

async function showTrainingStats() {
  const records = loadTrainingRecords();
  
  if (records.length === 0) {
    console.log('📊 No training data available.');
    return;
  }
  
  const totalSessions = records.length;
  const completedSessions = records.filter(r => r.status === 'completed').length;
  const inProgressSessions = records.filter(r => r.status === 'in_progress').length;
  const failedSessions = records.filter(r => r.status === 'failed').length;
  
  const averageSuccessRate = records.reduce((acc, r) => acc + r.successRate, 0) / records.length;
  
  const workflowStats = {};
  records.forEach(record => {
    if (!workflowStats[record.workflowType]) {
      workflowStats[record.workflowType] = { count: 0, successRate: 0 };
    }
    workflowStats[record.workflowType].count++;
    workflowStats[record.workflowType].successRate += record.successRate;
  });
  
  Object.keys(workflowStats).forEach(workflow => {
    workflowStats[workflow].successRate /= workflowStats[workflow].count;
  });
  
  console.log('\n📊 Training Statistics\n');
  console.log(`Total Training Sessions: ${totalSessions}`);
  console.log(`Completed: ${completedSessions}`);
  console.log(`In Progress: ${inProgressSessions}`);
  console.log(`Failed: ${failedSessions}`);
  console.log(`Average Success Rate: ${averageSuccessRate.toFixed(1)}%`);
  
  console.log('\nWorkflow Breakdown:');
  Object.entries(workflowStats).forEach(([workflow, stats]) => {
    console.log(`  ${workflow}: ${stats.count} sessions, ${stats.successRate.toFixed(1)}% avg success`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📚 Training Tracker Script

This script allows you to track and view what each agent has been trained on.

Usage:
  node scripts/training-tracker.js --list
  node scripts/training-tracker.js --agent "MLK"
  node scripts/training-tracker.js --workflow "history"
  node scripts/training-tracker.js --stats

Options:
  --list                    List all training records
  --agent <name>           Show training history for specific agent
  --workflow <type>        Show training records for specific workflow type
  --stats                  Show training statistics

Examples:
  # List all training records
  node scripts/training-tracker.js --list

  # Show MLK's training history
  node scripts/training-tracker.js --agent "MLK"

  # Show all history workflow training
  node scripts/training-tracker.js --workflow "history"

  # Show training statistics
  node scripts/training-tracker.js --stats
    `);
    return;
  }
  
  const command = args[0].replace('--', '');
  
  switch (command) {
    case 'list':
      await listTrainingRecords();
      break;
    case 'agent':
      if (args[1]) {
        await showAgentTraining(args[1]);
      } else {
        console.error('❌ Please specify agent name');
      }
      break;
    case 'workflow':
      if (args[1]) {
        await showWorkflowTraining(args[1]);
      } else {
        console.error('❌ Please specify workflow type');
      }
      break;
    case 'stats':
      await showTrainingStats();
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
  }
}

// Run the script
main().catch(console.error);
