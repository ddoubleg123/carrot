# 🤖 AI Agent Automation Guide

This guide shows you how to automate feeding content to your AI agents instead of manually clicking through the UI.

## 🚀 **Quick Start - Batch Feed UI**

### **1. Use the Batch Feed Button**
- Go to `/feed-agents` page
- Click the **"Batch Feed"** button in the top-right corner
- Select which agents you want to feed (or select all)
- Choose content type: URL or Text
- Paste your content and click "Feed to X Agents"

### **2. What You Can Automate**
- ✅ **Feed URLs** - Paste any URL and it extracts content automatically
- ✅ **Feed Text** - Paste any text content directly
- ✅ **Select Multiple Agents** - Choose specific agents or feed all at once
- ✅ **See Results** - View success/failure for each agent
- ✅ **Feed Again** - Keep feeding more content without closing the modal

## 🛠️ **Advanced Automation - Command Line Script**

### **Setup**
```bash
# Install dependencies (if not already installed)
npm install node-fetch

# Make script executable
chmod +x scripts/auto-feed-agents.js
```

### **Basic Usage**

#### **Feed a URL to All Agents**
```bash
node scripts/auto-feed-agents.js --url "https://en.wikipedia.org/wiki/Artificial_intelligence"
```

#### **Feed Text to All Agents**
```bash
node scripts/auto-feed-agents.js --text "The future of AI is bright and full of possibilities."
```

#### **Feed Only to Specific Expertise**
```bash
# Only feed to physics experts
node scripts/auto-feed-agents.js --expertise "physics" --text "Quantum mechanics is fascinating."

# Only feed to economics experts  
node scripts/auto-feed-agents.js --expertise "economics" --url "https://example.com/economics-article"
```

#### **Feed to Specific Agents**
```bash
node scripts/auto-feed-agents.js --agents "agent1,agent2,agent3" --text "Custom content"
```

#### **Feed File Content**
```bash
node scripts/auto-feed-agents.js --file "path/to/document.txt"
```

### **Advanced Options**

#### **With Custom Metadata**
```bash
node scripts/auto-feed-agents.js \
  --url "https://example.com/article" \
  --title "My Custom Title" \
  --author "John Doe"
```

#### **Multiple Feeds in Sequence**
```bash
# Create a batch script
cat > feed-batch.sh << 'EOF'
#!/bin/bash
node scripts/auto-feed-agents.js --url "https://example.com/article1"
node scripts/auto-feed-agents.js --url "https://example.com/article2" 
node scripts/auto-feed-agents.js --text "Additional context information"
EOF

chmod +x feed-batch.sh
./feed-batch.sh
```

## 📊 **Automation Examples**

### **Daily News Feed**
```bash
# Feed daily news to all agents
node scripts/auto-feed-agents.js --url "https://news.ycombinator.com"
node scripts/auto-feed-agents.js --url "https://www.bbc.com/news/technology"
```

### **Research Paper Feed**
```bash
# Feed research papers to relevant experts
node scripts/auto-feed-agents.js --expertise "physics" --url "https://arxiv.org/abs/quantum-paper"
node scripts/auto-feed-agents.js --expertise "economics" --url "https://papers.ssrn.com/economics-paper"
```

### **Educational Content**
```bash
# Feed educational content to all agents
node scripts/auto-feed-agents.js --url "https://www.khanacademy.org/computer-science"
node scripts/auto-feed-agents.js --text "Today's learning objective: Understanding machine learning fundamentals"
```

## 🔧 **API Integration**

### **Direct API Calls**
```javascript
// Feed content to all agents via API
const response = await fetch('/api/agents/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'feed',
    agentIds: ['agent1', 'agent2', 'agent3'],
    feedItem: {
      content: 'Your content here',
      sourceType: 'manual',
      sourceTitle: 'Custom Title',
      sourceAuthor: 'Your Name',
      tags: []
    }
  })
});
```

### **Webhook Integration**
```javascript
// Set up webhook to auto-feed when new content is published
app.post('/webhook/new-content', async (req, res) => {
  const { url, title, author } = req.body;
  
  await fetch('/api/agents/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation: 'feed',
      agentIds: await getAllAgentIds(),
      feedItem: {
        content: url,
        sourceType: 'url',
        sourceUrl: url,
        sourceTitle: title,
        sourceAuthor: author,
        tags: []
      }
    })
  });
  
  res.json({ success: true });
});
```

## 🎯 **Best Practices**

### **1. Batch Similar Content**
- Group related content and feed together
- Use expertise filtering to target relevant agents
- Add meaningful titles and authors for better memory organization

### **2. Monitor Results**
- Check the results after each batch feed
- Review agent memories to ensure content was processed correctly
- Use the Memory Viewer to see what agents learned

### **3. Schedule Regular Feeds**
```bash
# Add to crontab for daily feeds
0 9 * * * cd /path/to/carrot && node scripts/auto-feed-agents.js --url "https://daily-news.com"
```

### **4. Quality Control**
- Preview content before feeding (use the preview feature in UI)
- Start with small batches to test
- Monitor agent performance and adjust feeding strategy

## 🚨 **Troubleshooting**

### **Common Issues**
- **403 Forbidden**: Check if agents exist and are active
- **Empty Results**: Verify content is accessible and valid
- **Memory Issues**: Check if agents have proper expertise tags

### **Debug Mode**
```bash
# Add debug logging
DEBUG=1 node scripts/auto-feed-agents.js --url "https://example.com"
```

## 📈 **Scaling Up**

### **For Large Organizations**
1. **Set up RSS feeds** - Automatically feed new articles
2. **Create content pipelines** - Process and filter content before feeding
3. **Use expertise matching** - Automatically route content to relevant agents
4. **Monitor performance** - Track which content types work best for each agent

### **Integration with Other Systems**
- **CMS Integration** - Auto-feed when new content is published
- **Social Media** - Feed trending topics and discussions
- **Research Databases** - Automatically feed new papers and studies
- **News APIs** - Real-time news feeding based on keywords

---

## 🎉 **You're Ready to Automate!**

Start with the **Batch Feed UI** for simple automation, then move to the **command line script** for advanced workflows. Your agents will be learning continuously without manual intervention!

**Next Steps:**
1. Try the Batch Feed button on `/feed-agents`
2. Test the command line script with a simple URL
3. Set up automated feeds for your specific use case
4. Monitor agent memories to see the results
