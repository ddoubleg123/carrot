# 🎓 Individual Agent Training System

This guide shows you how to train individual agents with predefined workflows that can be replicated and scaled across multiple agents.

## 🚀 **Quick Start - UI Training Workflows**

### **1. Use the "Train" Button**
- Go to `/feed-agents` page
- Click the **"Train"** button on any agent card
- The system automatically detects the agent's expertise and loads an appropriate training program
- Click **"Start Training"** to begin the automated workflow
- Watch the progress as each step is completed automatically

### **2. What You Get**
- ✅ **Predefined Workflows** - Physics, Economics, Mathematics, Computer Science, History
- ✅ **Automatic Expertise Detection** - System picks the right training program
- ✅ **Step-by-Step Progress** - Visual progress tracking with success/failure indicators
- ✅ **Resume Capability** - Can pause and resume training
- ✅ **Reset Functionality** - Start over if needed

## 🛠️ **Advanced Training - Command Line Scripts**

### **Setup**
```bash
# Make scripts executable
chmod +x scripts/train-agent-workflow.js
chmod +x scripts/auto-feed-agents.js
```

### **Individual Agent Training**

#### **Train Albert Einstein with Physics**
```bash
node scripts/train-agent-workflow.js --agent "Einstein" --workflow "physics"
```

#### **Train John Maynard Keynes with Economics**
```bash
node scripts/train-agent-workflow.js --agent "Keynes" --workflow "economics"
```

#### **Train Ada Lovelace with Computer Science**
```bash
node scripts/train-agent-workflow.js --agent "Ada" --workflow "computer_science"
```

#### **Train Marie Curie with Physics**
```bash
node scripts/train-agent-workflow.js --agent "Marie" --workflow "physics"
```

### **Available Training Workflows**

#### **Physics Mastery Program**
- Physics Fundamentals
- Quantum Mechanics
- Theory of Relativity
- Modern Physics
- Particle Physics

#### **Economics Mastery Program**
- Economic Theory
- Microeconomics
- Macroeconomics
- Keynesian Economics
- Fiscal Policy

#### **Mathematics Mastery Program**
- Mathematical Foundations
- Algebra
- Calculus
- Statistics
- Algorithms

#### **Computer Science Mastery Program**
- Computer Science Fundamentals
- Programming Concepts
- Data Structures
- Algorithms
- Artificial Intelligence

#### **History Mastery Program**
- World History Overview
- Ancient Civilizations
- Medieval Period
- Modern History
- Contemporary History

### **List Available Options**
```bash
# See all available workflows
node scripts/train-agent-workflow.js --list-workflows

# See all available agents
node scripts/train-agent-workflow.js --list-agents
```

## 🔄 **Scaling Training Across Multiple Agents**

### **Method 1: Batch Training Script**
```bash
# Create a batch training script
cat > train-all-agents.sh << 'EOF'
#!/bin/bash

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

echo "🎉 All agents trained!"
EOF

chmod +x train-all-agents.sh
./train-all-agents.sh
```

### **Method 2: Automated Training Pipeline**
```bash
# Create an automated training pipeline
cat > automated-training.js << 'EOF'
const { exec } = require('child_process');

const trainingConfig = [
  { agent: 'Einstein', workflow: 'physics' },
  { agent: 'Keynes', workflow: 'economics' },
  { agent: 'Ada', workflow: 'computer_science' },
  { agent: 'Marie', workflow: 'physics' },
  { agent: 'MLK', workflow: 'history' },
  { agent: 'Tesla', workflow: 'computer_science' }
];

async function trainAllAgents() {
  for (const config of trainingConfig) {
    console.log(`🎓 Training ${config.agent} with ${config.workflow} workflow...`);
    
    await new Promise((resolve, reject) => {
      exec(`node scripts/train-agent-workflow.js --agent "${config.agent}" --workflow "${config.workflow}"`, 
        (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Error training ${config.agent}:`, error);
          } else {
            console.log(stdout);
          }
          resolve();
        }
      );
    });
    
    // Wait between agents
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('🎉 All agents trained successfully!');
}

trainAllAgents();
EOF

node automated-training.js
```

## 📊 **Training Results & Monitoring**

### **Check Training Progress**
```bash
# After training, check agent memories
# Go to /feed-agents page and click "View Memories" on any agent
```

### **Monitor Training Success**
- Each training step shows success/failure
- Memory count increases with successful training
- Failed steps can be retried individually

### **Training Analytics**
```bash
# Create a training report
cat > training-report.js << 'EOF'
const fetch = require('node-fetch');

async function generateTrainingReport() {
  try {
    const response = await fetch('https://carrot-app.onrender.com/api/agents');
    const data = await response.json();
    
    console.log('📊 Training Report');
    console.log('================\n');
    
    for (const agent of data.agents) {
      console.log(`🤖 ${agent.name}`);
      console.log(`   Expertise: ${agent.domainExpertise.join(', ')}`);
      console.log(`   Created: ${new Date(agent.createdAt).toLocaleDateString()}`);
      console.log('');
    }
  } catch (error) {
    console.error('Error generating report:', error);
  }
}

generateTrainingReport();
EOF

node training-report.js
```

## 🎯 **Best Practices for Individual Training**

### **1. Start with One Agent**
- Test the training workflow with one agent first
- Verify the training steps work correctly
- Check the agent's memories after training

### **2. Customize Training Workflows**
- Modify the training steps in `scripts/train-agent-workflow.js`
- Add domain-specific content for your use case
- Create new workflows for specialized knowledge areas

### **3. Monitor Training Quality**
- Review agent memories after each training session
- Test agent responses to ensure knowledge was absorbed
- Adjust training content based on results

### **4. Scale Gradually**
- Start with 2-3 agents
- Monitor system performance
- Scale to more agents as needed

## 🔧 **Customizing Training Workflows**

### **Add New Training Workflows**
Edit `scripts/train-agent-workflow.js` and add to the `TRAINING_WORKFLOWS` object:

```javascript
const TRAINING_WORKFLOWS = {
  // ... existing workflows ...
  
  medicine: {
    name: 'Medicine Mastery Program',
    description: 'Comprehensive medical knowledge training',
    steps: [
      {
        name: 'Anatomy',
        content: 'https://en.wikipedia.org/wiki/Anatomy',
        sourceType: 'url',
        sourceTitle: 'Anatomy - Wikipedia'
      },
      {
        name: 'Physiology',
        content: 'https://en.wikipedia.org/wiki/Physiology',
        sourceType: 'url',
        sourceTitle: 'Physiology - Wikipedia'
      }
      // ... more steps
    ]
  }
};
```

### **Custom Training Content**
```javascript
// Add custom text content
{
  name: 'Custom Knowledge',
  content: 'Your custom training content here...',
  sourceType: 'text',
  sourceTitle: 'Custom Training Material'
}

// Add file content
{
  name: 'Training Document',
  content: 'path/to/your/training/document.txt',
  sourceType: 'file',
  sourceTitle: 'Training Document'
}
```

## 🚨 **Troubleshooting**

### **Common Issues**
- **Agent not found**: Use `--list-agents` to see available agents
- **Workflow not found**: Use `--list-workflows` to see available workflows
- **Training failures**: Check API connectivity and agent status

### **Debug Mode**
```bash
# Add debug logging
DEBUG=1 node scripts/train-agent-workflow.js --agent "Einstein" --workflow "physics"
```

## 📈 **Advanced Scaling Strategies**

### **1. Parallel Training**
```bash
# Train multiple agents in parallel
node scripts/train-agent-workflow.js --agent "Einstein" --workflow "physics" &
node scripts/train-agent-workflow.js --agent "Keynes" --workflow "economics" &
node scripts/train-agent-workflow.js --agent "Ada" --workflow "computer_science" &
wait
```

### **2. Scheduled Training**
```bash
# Add to crontab for daily training
0 2 * * * cd /path/to/carrot && node scripts/train-agent-workflow.js --agent "Einstein" --workflow "physics"
```

### **3. Training Pipelines**
- Set up CI/CD pipelines for automated training
- Integrate with content management systems
- Create training schedules based on agent performance

---

## 🎉 **You're Ready for Individual Agent Training!**

### **Next Steps:**
1. **Try the UI**: Click "Train" on any agent card
2. **Test CLI**: Run a single agent training workflow
3. **Scale Up**: Create batch training scripts
4. **Customize**: Add your own training workflows
5. **Monitor**: Check agent memories and performance

### **Key Benefits:**
- ✅ **Individual Focus**: Each agent gets specialized training
- ✅ **Replicable**: Same workflow can be applied to multiple agents
- ✅ **Scalable**: Easy to train dozens or hundreds of agents
- ✅ **Automated**: No manual clicking required
- ✅ **Trackable**: Clear progress and success indicators

Your agents will now receive comprehensive, specialized training that can be replicated and scaled across your entire agent network! 🚀
