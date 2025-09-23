# Phase Checklists - DeepSeek Coder Infrastructure

## Phase 0: Local Pilot ✅

### Setup Checklist
- [ ] Docker and Docker Compose installed
- [ ] Run `./setup.sh`
- [ ] Ollama pulls deepseek-coder:6.7b and deepseek-coder-v2:16b
- [ ] Router starts on port 8080
- [ ] Redis starts on port 6379

### Test Checklist
- [ ] Health check: `curl http://localhost:8080/health`
- [ ] Editor task: Fix grammar in 1-2s
- [ ] Refactor task: Extract hook in 2-4s
- [ ] Tests task: Generate Jest tests in 3-5s
- [ ] Moderation filter: Block sensitive content
- [ ] Rate limiting: 100 req/15min works

### Cursor Integration
- [ ] Add custom endpoint: `http://localhost:8080/v1/chat/completions`
- [ ] Test editor tasks in Cursor
- [ ] Test refactor tasks in Cursor
- [ ] Verify model routing works

## Phase 1: Staging (Single GPU Node)

### Deployment Checklist
- [ ] Deploy docker-compose to GPU node
- [ ] PostgreSQL with pgvector enabled
- [ ] Run embedding script on codebase
- [ ] Enable RAG context injection
- [ ] Configure production environment

### RAG Checklist
- [ ] Code chunks embedded and stored
- [ ] Search function returns top-3 chunks
- [ ] Context includes file paths + line ranges
- [ ] RAG tasks use retrieved context
- [ ] Fallback when no context found

### Monitoring Checklist
- [ ] Metrics: task_type, model, latency, tokens
- [ ] Cache hit rate >80%
- [ ] Error rate <1%
- [ ] Load test: 100 requests, measure P95

## Phase 2: Production (Throughput & Governance)

### vLLM Integration
- [ ] Deploy vLLM on GPU node
- [ ] Route rag-* tasks to vLLM
- [ ] Model versioning with X-Model-Alias
- [ ] Rollback/rollforward capability

### SLOs & Governance
- [ ] 6.7B P95 < 2s
- [ ] 16B P95 < 4s
- [ ] Rate limits per user/IP
- [ ] Secret redaction in logs
- [ ] Alert on latency spikes

### Security
- [ ] Pre-filters: moderation, PII, task allowlist
- [ ] Post-filters: secrets, commands
- [ ] Audit logging
- [ ] Access controls

## Phase 3: Optimize & Expand

### Doc-RAG
- [ ] Document chunks table
- [ ] Policy/FAQ embeddings
- [ ] Citation support
- [ ] Facts-only responses

### CI Integration
- [ ] GitHub Actions bot
- [ ] PR comment generation
- [ ] Deterministic linter gates
- [ ] Automated testing

### Dashboards
- [ ] Token usage metrics
- [ ] Cache performance
- [ ] Moderation flags
- [ ] User adoption rates
