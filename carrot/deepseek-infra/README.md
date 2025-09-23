# DeepSeek Coder Infrastructure

OpenAI-compatible router for DeepSeek Coder models with RAG, safety filters, and phased deployment.

## Quick Start

```bash
# 1. Setup
cd deepseek-infra
./setup.sh

# 2. Test
./test-smoke.sh

# 3. Use with Cursor
# Add to Cursor settings:
# "deepseek.router.url": "http://localhost:8080/v1/chat/completions"
```

## Task Types

| Task | Model | Use Case |
|------|-------|----------|
| `editor` | 6.7B | Grammar fixes, copy editing |
| `refactor_hook@v1` | 16B | Extract React hooks |
| `explain_tests@v1` | 16B | Generate Jest tests |
| `chat` | 16B | General coding help |
| `rag-code` | 16B | Code-aware answers |
| `ci` | 6.7B | Quick CI fixes |

## Headers

- `X-Task-Type`: Task type (required)
- `X-Risk-Level`: low|med|high (default: low)
- `X-Context-Refs`: repo@sha,files (optional)
- `X-Model-Alias`: Model version pin (optional)

## Phases

- **Phase 0**: Local pilot with Ollama
- **Phase 1**: Staging with RAG
- **Phase 2**: Production with vLLM
- **Phase 3**: Doc-RAG and CI bot

## Safety

- Moderation filters for sensitive content
- PII detection and redaction
- Secret scanning in responses
- Rate limiting and caching
- Structured logging with metrics

## Performance

- 6.7B: P95 < 2s
- 16B: P95 < 4s
- Cache hit rate: >80%
- Rate limit: 100 req/15min
