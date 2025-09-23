# DeepSeek Coder Infrastructure - Quick Start

## 🚀 5-Minute Setup

### 1. Prerequisites
```bash
# Install Docker and Docker Compose
# Windows: Docker Desktop
# macOS: Docker Desktop
# Linux: docker.io + docker-compose
```

### 2. Clone and Setup
```bash
cd carrot/deepseek-infra
cp env.sample .env
./setup.sh
```

### 3. Test Everything Works
```bash
./test-smoke.sh
```

### 4. Configure Cursor
Add to Cursor settings:
```json
{
  "deepseek.router.url": "http://localhost:8080/v1/chat/completions",
  "deepseek.router.taskType": "editor"
}
```

## 🧪 Test Commands

### Editor Task (Grammar Fix)
```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Task-Type: editor" \
  -d '{"messages":[{"role":"user","content":"Fix this: The code is not working good."}]}'
```

### Refactor Task (Extract Hook)
```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Task-Type: refactor_hook@v1" \
  -d '{"messages":[{"role":"user","content":"Extract this state into a hook:\nconst [count, setCount] = useState(0);"}]}'
```

### Tests Task (Generate Jest)
```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Task-Type: explain_tests@v1" \
  -d '{"messages":[{"role":"user","content":"Create tests for: function add(a, b) { return a + b; }"}]}'
```

## 📊 Performance Targets

| Task Type | Model | Target P95 | Use Case |
|-----------|-------|------------|----------|
| `editor` | 6.7B | < 2s | Grammar fixes |
| `refactor_hook@v1` | 16B | < 4s | React hooks |
| `explain_tests@v1` | 16B | < 4s | Jest tests |
| `chat` | 16B | < 4s | General help |
| `rag-code` | 16B | < 4s | Code context |
| `ci` | 6.7B | < 2s | Quick fixes |

## 🔧 Troubleshooting

### Models Not Loading
```bash
# Check Ollama
docker exec deepseek-infra-ollama-1 ollama list

# Pull models manually
docker exec deepseek-infra-ollama-1 ollama pull deepseek-coder:6.7b
docker exec deepseek-infra-ollama-1 ollama pull deepseek-coder-v2:16b
```

### Router Not Starting
```bash
# Check logs
docker-compose logs router

# Restart services
docker-compose restart router
```

### Performance Issues
```bash
# Run performance test
cd scripts
npm install
node performance-test.js
```

## 🚀 Next Steps

1. **Phase 1**: Add RAG with `./scripts/embed-code.js`
2. **Phase 2**: Deploy to production with `deployment/production.yml`
3. **Phase 3**: Add monitoring with `monitoring/docker-compose.monitoring.yml`

## 📚 Full Documentation

- [README.md](README.md) - Complete setup guide
- [phase-checklists.md](phase-checklists.md) - Deployment phases
- [examples/](examples/) - Usage examples
- [scripts/](scripts/) - Utility scripts
