# 🎓 MLK Training Guide & Training Tracking

This guide shows you exactly how to train Martin Luther King Jr. and track what each agent has been trained on.

## 🚀 **Training MLK for His Specialty**

### **Option 1: UI Training (Easiest)**
1. Go to `https://carrot-app.onrender.com/feed-agents`
2. Find **Martin Luther King Jr.'s** card
3. Click the **"Train"** button
4. The system automatically detects his expertise and loads the **History Mastery Program**
5. Click **"Start Training"** - it will automatically feed him:
   - World History Overview
   - Ancient Civilizations
   - Medieval Period
   - Modern History
   - Contemporary History

### **Option 2: Command Line (Most Powerful)**
```bash
# Train MLK with history workflow
node scripts/train-agent-workflow.js --agent "MLK" --workflow "history"
```

### **What MLK Will Learn:**
- **World History Overview**: Broad historical knowledge
- **Ancient Civilizations**: Early human societies and cultures
- **Medieval Period**: Middle Ages and feudal systems
- **Modern History**: Industrial revolution to World War II
- **Contemporary History**: Post-WWII to present day

## 📊 **Tracking What Each Agent Has Been Trained On**

### **Option 1: UI Training Tracker (Easiest)**
1. Go to `https://carrot-app.onrender.com/feed-agents`
2. Click the **"Training Tracker"** tab
3. See all training records with:
   - Which agent was trained
   - What workflow was used
   - Success rate for each training session
   - Individual step results
   - Training dates and completion status

### **Option 2: Command Line Tracking (Most Detailed)**
```bash
# List all training records
node scripts/training-tracker.js --list

# Show MLK's specific training history
node scripts/training-tracker.js --agent "MLK"

# Show all history workflow training
node scripts/training-tracker.js --workflow "history"

# Show training statistics
node scripts/training-tracker.js --stats
```

## 🎯 **Complete MLK Training Example**

### **Step 1: Train MLK**
```bash
# Train MLK with history workflow
node scripts/train-agent-workflow.js --agent "MLK" --workflow "history"
```

**Expected Output:**
```
🎓 Individual Agent Training Workflow Script Starting...

📋 Fetching agents...
✅ Found 6 agents:
   - Albert Einstein (physics, relativity, quantum mechanics)
   - John Maynard Keynes (economics, macroeconomics, fiscal policy)
   - Ada Lovelace (mathematics, computer programming, algorithms)
   - Marie Curie (physics, chemistry, radioactivity)
   - Martin Luther King Jr. (civil rights, nonviolence, social justice)
   - Nikola Tesla (engineering, electricity, invention)

🎯 Targeting agents with "MLK" expertise: Martin Luther King Jr.

🎓 Starting History Mastery Program for Martin Luther King Jr.
📚 Comprehensive history training from ancient to modern times
📋 5 training steps

[1/5] World History Overview...
   ✅ Success! 3 memories created
[2/5] Ancient Civilizations...
   ✅ Success! 2 memories created
[3/5] Medieval Period...
   ✅ Success! 4 memories created
[4/5] Modern History...
   ✅ Success! 3 memories created
[5/5] Contemporary History...
   ✅ Success! 2 memories created

🎉 Training Complete!
   ✅ Successful steps: 5
   ❌ Failed steps: 0
   📊 Success rate: 100.0%
```

### **Step 2: Track MLK's Training**
```bash
# Check MLK's training history
node scripts/training-tracker.js --agent "MLK"
```

**Expected Output:**
```
🎓 Training History for Martin Luther King Jr.

1. History Mastery Program
   Type: history
   Status: completed
   Success Rate: 100.0%
   Steps: 5
   Started: 1/17/2024
   Completed: 1/17/2024
   Training Steps:
     1. ✅ World History Overview
     2. ✅ Ancient Civilizations
     3. ✅ Medieval Period
     4. ✅ Modern History
     5. ✅ Contemporary History
```

### **Step 3: View Training Statistics**
```bash
# See overall training stats
node scripts/training-tracker.js --stats
```

**Expected Output:**
```
📊 Training Statistics

Total Training Sessions: 6
Completed: 6
In Progress: 0
Failed: 0
Average Success Rate: 100.0%

Workflow Breakdown:
  physics: 2 sessions, 100.0% avg success
  economics: 1 sessions, 100.0% avg success
  history: 1 sessions, 100.0% avg success
  computer_science: 2 sessions, 100.0% avg success
```

## 🔄 **Training All Agents with Tracking**

### **Complete Training Pipeline**
```bash
# Create a complete training script
cat > train-all-with-tracking.sh << 'EOF'
#!/bin/bash

echo "🎓 Starting Complete Agent Training Pipeline..."

# Train each agent
echo "🎓 Training Albert Einstein..."
node scripts/train-agent-workflow.js --agent "Einstein" --workflow "physics"

echo "🎓 Training John Maynard Keynes..."
node scripts/train-agent-workflow.js --agent "Keynes" --workflow "economics"

echo "🎓 Training Ada Lovelace..."
node scripts/train-agent-workflow.js --agent "Ada" --workflow "computer_science"

echo "🎓 Training Marie Curie..."
node scripts/train-agent-workflow.js --agent "Marie" --workflow "physics"

echo "🎓 Training Martin Luther King Jr..."
node scripts/train-agent-workflow.js --agent "MLK" --workflow "history"

echo "🎓 Training Nikola Tesla..."
node scripts/train-agent-workflow.js --agent "Tesla" --workflow "computer_science"

echo "📊 Training Complete! Generating report..."
node scripts/training-tracker.js --stats

echo "🎉 All agents trained and tracked!"
EOF

chmod +x train-all-with-tracking.sh
./train-all-with-tracking.sh
```

## 📈 **Advanced Tracking Features**

### **Training Progress Monitoring**
```bash
# Monitor training progress in real-time
watch -n 5 'node scripts/training-tracker.js --stats'
```

### **Export Training Data**
```bash
# Export training records to JSON
node -e "
const fs = require('fs');
const records = JSON.parse(fs.readFileSync('data/training-records.json', 'utf8'));
console.log(JSON.stringify(records, null, 2));
" > training-export.json
```

### **Training Analytics**
```bash
# Create training analytics script
cat > training-analytics.js << 'EOF'
const fs = require('fs');

const records = JSON.parse(fs.readFileSync('data/training-records.json', 'utf8'));

console.log('📊 Training Analytics Report');
console.log('============================\n');

// Agent performance
const agentStats = {};
records.forEach(record => {
  if (!agentStats[record.agentName]) {
    agentStats[record.agentName] = { sessions: 0, avgSuccess: 0 };
  }
  agentStats[record.agentName].sessions++;
  agentStats[record.agentName].avgSuccess += record.successRate;
});

Object.keys(agentStats).forEach(agent => {
  agentStats[agent].avgSuccess /= agentStats[agent].sessions;
  console.log(`${agent}: ${agentStats[agent].sessions} sessions, ${agentStats[agent].avgSuccess.toFixed(1)}% avg success`);
});

// Workflow effectiveness
const workflowStats = {};
records.forEach(record => {
  if (!workflowStats[record.workflowType]) {
    workflowStats[record.workflowType] = { count: 0, success: 0 };
  }
  workflowStats[record.workflowType].count++;
  workflowStats[record.workflowType].success += record.successRate;
});

console.log('\nWorkflow Effectiveness:');
Object.keys(workflowStats).forEach(workflow => {
  const avgSuccess = workflowStats[workflow].success / workflowStats[workflow].count;
  console.log(`${workflow}: ${workflowStats[workflow].count} uses, ${avgSuccess.toFixed(1)}% avg success`);
});
EOF

node training-analytics.js
```

## 🎯 **Best Practices for MLK Training**

### **1. Start with History Workflow**
- MLK's expertise is in civil rights and social justice
- History workflow provides the historical context he needs
- Covers ancient to contemporary history

### **2. Monitor Training Success**
- Check training tracker after each session
- Verify MLK's memories are being created
- Test his responses to historical questions

### **3. Customize Training Content**
- Add civil rights specific content
- Include social justice materials
- Add nonviolence philosophy content

### **4. Scale to Other Agents**
- Use the same tracking system for all agents
- Compare training effectiveness across agents
- Identify which workflows work best

## 🚨 **Troubleshooting**

### **Common Issues**
- **Agent not found**: Use `--list-agents` to see available agents
- **Training failures**: Check API connectivity and agent status
- **No tracking data**: Ensure training records are being saved

### **Debug Commands**
```bash
# Check if MLK exists
node scripts/train-agent-workflow.js --list-agents

# Check training records
node scripts/training-tracker.js --list

# Check MLK's current memories
# Go to /feed-agents and click "View Memories" on MLK's card
```

---

## 🎉 **You're Ready to Train MLK!**

### **Quick Start:**
1. **Train MLK**: `node scripts/train-agent-workflow.js --agent "MLK" --workflow "history"`
2. **Track Progress**: `node scripts/training-tracker.js --agent "MLK"`
3. **View Results**: Go to `/feed-agents` and click "View Memories" on MLK's card

### **What You Get:**
- ✅ **Specialized Training**: MLK gets history-focused training
- ✅ **Complete Tracking**: Know exactly what he's been trained on
- ✅ **Success Monitoring**: Track training effectiveness
- ✅ **Scalable Process**: Same system works for all agents
- ✅ **Historical Context**: MLK learns the historical background for his expertise

MLK will now have comprehensive historical knowledge to support his civil rights and social justice expertise! 🎓
