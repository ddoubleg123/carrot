# Agent Auto-Join Logic Design

## 🧠 GOAL: Smarter Agent Auto-Summoning

**"Users should never have to think about who to add. The right minds should just show up."**

## ✅ UX Review (Based on Screenshots)

### Initial View ("What's your obsession today?")
- Feels clean and exploratory
- Placeholder is perfect
- Good separation between passive agents and conversation entry

### Conversation View
- Sidebar organization is intuitive: "Your Council," "Available Advisors"
- **Active advisors not populating automatically is the weak point**
- Bonus: Clear room for agent memory, training, and multi-thread convo design

## 🚨 Current Logic Gaps

| Problem | Why It Matters |
|---------|----------------|
| 🔍 Exact string matching only | "Argentine peso" won't match "economics" or "Keynes" |
| 🤖 No domain expansion | "Debt crisis" doesn't trigger "Friedman" or "Keynes" |
| ✍️ No concept clustering | "War on inflation" vs. "monetary tightening" go unmatched |
| 📉 No fallback | Zero agents join if no keywords match exactly |
| 🧠 No memory or user learning | Agents don't improve in what they join over time |

## ✅ Improved Auto-Join System — Logic Overview

### 🎯 High-Level Design

**"When a user types a question, match its meaning—not just its words—to the top 3–5 most relevant agents and bring them into the thread automatically."**

### 🔁 STEP-BY-STEP LOGIC FLOW

1. **User enters a query** (e.g. "let's talk about Argentina in the 80s")

2. **Parse query into:**
   - Raw tokens (word-by-word)
   - Stems (e.g., "economic" from "economy")
   - Synonyms & domain expansions (via static map + OpenAI + WordNet)

3. **Normalize query** (lowercase, remove punctuation, trim whitespace)

4. **Match query tokens against each agent's:**
   - Title ("Free Market Economics")
   - Description ("Milton Friedman is…")
   - Expanded expertise tags (see below)
   - Past chat history (optional)

5. **Use fuzzy match scoring:**
   - Fuse.js, Levenshtein, or embedding similarity
   - Score 0–1 (higher = more relevant)

6. **Rank agents by score**

7. **Select:**
   - Top 3–5 agents ≥ threshold (e.g., 0.55)
   - Fallback generalists (e.g., Socrates, Einstein) if no scores high

8. **Add to "Active Advisors" list** and visually slide them into the thread

9. **Log result for learning** (which agents user removed or kept)

## 🧩 Data Model: Expanded Agent Expertise

```json
{
  "agent_id": "friedman",
  "name": "Milton Friedman",
  "expertise": ["Free Market Economics", "Inflation", "Monetary Policy"],
  "expanded_keywords": [
    "money", "finance", "inflation", "interest rates",
    "price stability", "federal reserve", "Keynes", "libertarian",
    "budget", "macroeconomics", "supply-side"
  ]
}
```

### Expansion Methods:
- **Hand-built initially** - curated keyword lists
- **ChatGPT embedding similarity** - semantic expansion
- **Wikipedia or RSS ingestion** - domain knowledge
- **User "feeding" the agent** - learning from interactions

## 🛠 Implementation Suggestions

| Layer | Tool |
|-------|------|
| Fuzzy matching | Fuse.js with 0.3–0.4 threshold |
| Semantic expansion | GPT or static JSON vocab maps |
| Scoring | Composite score = fuzzy match + frequency + context weight |
| Learning | Store user removals (X) and additions (+) per thread |

## 🎨 Future UX Enhancements

- **"📚 Agent Feed"** — shows what the agent knows from past feeds
- **"🤝 Suggested Council"** — lets users favorite or fix their dream team
- **"🔄 Retune This Council"** — reshuffle agents based on tone/topic

## 🧾 Sample Logic in Pseudocode

```javascript
// Input
const query = "let's talk about argentina in the 80s";

// Normalized tokens
const tokens = ["argentina", "80s", "inflation", "debt", "economy"];

// Agent index
const agents = [
  {
    name: "Milton Friedman",
    tags: ["economics", "free market", "monetary policy", "inflation", "budget"]
  },
  // ...
];

// Match agent tags with tokens using Fuse.js or embeddings
const matchedAgents = getTopScoringAgents(query, agents);

// Return top 3-5, fallback to generalist if none
```

## ✅ Implementation Priority

This logic will:
- Feel magical to users
- Make agents feel alive and context-aware
- Improve over time
- Is easy to prototype using tools we already use (Fuse.js, JSON, GPT embeddings, etc.)

## 📋 Next Steps

1. **Phase 1**: Implement expanded keyword dictionaries
2. **Phase 2**: Add Fuse.js fuzzy matching
3. **Phase 3**: Implement scoring algorithm
4. **Phase 4**: Add user feedback loop for learning
5. **Phase 5**: Integrate with GPT embeddings for semantic expansion

## 🔧 Technical Requirements

- **Fuse.js** for fuzzy matching
- **Expanded agent data model** with keyword arrays
- **Scoring algorithm** with configurable thresholds
- **User interaction logging** for learning
- **Fallback system** for edge cases
