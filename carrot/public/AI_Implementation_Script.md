
# AI Implementation Script — DeepSeek Coder Infrastructure

## Objective
Read **DeepSeek_Coder_Infrastructure_Plan.md** and implement the phased plan with safe defaults.
You are a precise, execution‑focused assistant. When information is missing, propose the smallest sensible default and continue.

## Inputs
- Markdown plan: DeepSeek_Coder_Infrastructure_Plan.md
- Capabilities matrix (for reference): deepseek_infra_capabilities.xlsx

## Global Rules
- Prefer deterministic tools for lint/format/security; LLM assists but never replaces gates.
- Default temperature 0.2; max_tokens per response 700 unless specified.
- Never store secrets in logs; redact tokens/keys in all outputs.
- For political/sensitive prompts, apply moderation filters and escalate to human if triggered.

## Tasks
1. **Environment Setup**
   - Generate a `docker-compose.yaml` as specified in the plan (Ollama + Router + Redis).
   - Create `router/server.ts` per the skeleton. Expose `/v1/chat/completions` (OpenAI‑style).
   - Provide commands to pull models with Ollama (`deepseek-coder:6.7b`, `deepseek-coder-v2:16b`).

2. **Prompt Packs**
   - Create `/prompts/editor@v1.md`, `/prompts/refactor_hook@v1.md`, `/prompts/explain_tests@v1.md` using the plan text.
   - Ensure the Router injects these as `system` messages based on `X-Task-Type` header.

3. **RAG Bootstrap (Code)**
   - Propose a minimal chunking strategy (150–300 LOC or AST).
   - Pick `bge-small-en` embeddings; provide a pgvector init script and example upsert code.
   - Build a retrieval step that returns top‑3 chunks with file paths + line ranges.

4. **Safety & Ops**
   - Add pre‑filters: simple moderation regex, PII redaction stub, task allowlist.
   - Add post‑filters: secret/command checks.
   - Emit metrics: `task_type, model, latency, input_tokens, output_tokens, cache_hit`.
   - Add `X-Model-Alias` header support.

5. **Phased Deployment**
   - Phase 0: local dev instructions (Cursor custom model URL; test commands).
   - Phase 1: staging deploy checklists; enable cache; outline smoke tests.
   - Phase 2: production with vLLM; SLOs; rate limits.
   - Phase 3: doc‑RAG and CI PR bot outline.

## Deliverables
- Validated `docker-compose.yaml` and `router/server.ts` files.
- Prompts folder with three versioned prompt files.
- Scripts for embeddings DB (pgvector) + sample retrieval code.
- Markdown checklist for each phase with test steps and success criteria.

## Output Format
- Provide code blocks for each file.
- Provide shell commands to run each step.
- Keep responses concise and actionable.
