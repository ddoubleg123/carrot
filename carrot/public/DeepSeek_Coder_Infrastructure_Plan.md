
# DeepSeek Coder – Infrastructure & Usage Plan

**Owner:** Carrot Engineering • **Last Updated:** 2025‑09‑23

---

## 1) Purpose
Unify how we run, route, and govern **DeepSeek Coder** across IDE, app, CI, and ops—while leaving a clean escape hatch to alternative models (Claude/GPT) when tasks demand deeper reasoning or specialized capabilities.

---

## 2) Architecture Topology
- **Model layer**
  - **Ollama** for quick/local: `deepseek-coder:6.7b` and `deepseek-coder-v2:16b` (quantized as needed).
  - **vLLM** on a GPU box for production throughput: `DeepSeek-Coder-V2-Instruct`.
- **Router API (OpenAI-compatible)**
  - Single `/v1/chat/completions` endpoint.
  - Routes to Ollama or vLLM by **task_type**, **size**, **risk**.
- **Context services**
  - **Code‑RAG**: embed repo (bge‑small / e5‑small), chunk by function/file, top‑k retrieve.
  - **Doc‑RAG**: same stack for internal policies/FAQs with citations.
- **Guardrails**
  - Pre‑filters (policy/moderation), PII redaction, rate limits; post‑filters (secret/command checks), logging.
- **Caching & metrics**
  - Redis result cache; Prometheus/Grafana for latency/usage; pin model versions via headers.

---

## 3) Routing Policy
| Task | Model | Notes |
|---|---|---|
| IDE small completions, refactors | **DeepSeek Coder 6.7B (Ollama)** | Low latency, cost‑efficient. |
| Multi‑file/codegen, tests | **DeepSeek Coder V2‑16B (Ollama/vLLM)** | Better quality/reasoning. |
| Repo‑aware answers (RAG) | **DeepSeek + Code‑RAG** | Supply retrieved chunks with paths/lines. |
| Sensitive/high‑stakes text | **Alt model or human review** | Enforce filters; escalate when triggered. |
| CI PR nits | **DeepSeek 6.7B** | Short diffs; deterministic linters still gate. |

---

## 4) Prompt Packs (versioned)
Store under `/prompts/{name}@vX.md` and inject as `system` messages.

- **editor.md** – crisp copy edits; output only edited text.  
- **refactor_hook.md** – extract state to reusable hook; keep types; minimal JSDoc.  
- **explain_tests.md** – explain function + edge cases; output Jest tests.  

---

## 5) Context (RAG) Plumbing
**Code‑RAG**
- Chunk by AST or 150–300 LOC.
- Embed with `bge-small-en` (fast); store in pgvector/Weaviate.
- Retrieve top‑3; include file paths and line ranges in prompt blocks.

**Doc‑RAG**
- Chunk 800–1200 tokens; preserve citations/URLs.
- System rule: “Use only facts in context; say if missing.”

---

## 6) Safety & Ops
- **Pre‑filters:** moderation/policy regex, PII redaction (Presidio), task allowlist.  
- **Post‑filters:** secret/command checks; safe‑output constraints.  
- **Observability:** log `task_type, model, latency, input_tokens, output_tokens, cache_hit`.  
- **Versioning:** header `X‑Model‑Alias: ds‑coder‑v2@YYYY‑MM‑DD` for pin/rollback.  
- **Data handling:** no training on user data; scrub secrets before logging; TTL on caches (24h).

---

## 7) Interfaces (One API)
Clients (Cursor, web app, CI bot) call the same endpoint:
- Headers: `X‑Task‑Type: editor|refactor|tests|chat|rag-code|rag-doc|ci`, `X‑Risk‑Level: low|med|high`  
- Optional: `X‑Context‑Refs: repo@sha,files`  
- Router injects the right **system prompt** and **RAG** context, selects the model, and returns OpenAI‑style responses.

---

## 8) Minimal Infra (example)
**docker-compose.yaml (core services)**
```yaml
services:
  ollama:
    image: ollama/ollama:latest
    ports: ["11434:11434"]
    volumes: ["ollama:/root/.ollama"]
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 10s
      timeout: 5s
      retries: 5

  router:
    image: node:20-alpine
    working_dir: /app
    command: sh -c "node server.js"
    volumes: ["./router:/app"]
    ports: ["8080:8080"]
    environment:
      OLLAMA_URL: http://ollama:11434
      VLLM_URL: http://vllm:8000
      REDIS_URL: redis://redis:6379

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  ollama:
```

**router/server.ts (skeleton)**
```ts
import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "2mb" }));

const OLLAMA = process.env.OLLAMA_URL!;
const VLLM   = process.env.VLLM_URL!;
const cache = new Map<string, any>(); // swap for Redis

const SYSTEM = {
  editor: "Role: crisp copy editor. Tighten grammar/spelling without changing meaning. Output only edited text.",
  refactor: "Role: senior React+TS engineer. Extract state into reusable hook. Keep types; no behavior change; add minimal JSDoc.",
  tests: "Role: staff engineer. 1) Explain function & edge cases. 2) Produce Jest tests (happy path + 3 edges).",
  chat: "You are a helpful coding assistant.",
  "rag-code": "Use ONLY provided code context. If missing, say so.",
  "rag-doc": "Use ONLY provided document context with citations. If missing, say so."
};

function chooseModel(task){
  if (task === "editor" || task === "ci") return { base: "deepseek-coder:6.7b", url: OLLAMA };
  if (task === "refactor" || task === "tests" || task.startsWith("rag")) return { base: "deepseek-coder-v2:16b", url: OLLAMA };
  return { base: "deepseek-coder-v2:16b", url: OLLAMA }; // swap to VLLM when scaling
}

app.post("/v1/chat/completions", async (req, res) => {
  const { messages, stream, max_tokens = 512, temperature = 0.2 } = req.body;
  const task = (req.header("X-Task-Type") || "chat").toLowerCase();
  const sys = SYSTEM[task] || SYSTEM.chat;
  const sysMsg = { role: "system", content: sys };

  const payload = { model: "", messages: [sysMsg, ...messages], stream, max_tokens, temperature };
  const key = crypto.createHash("sha1").update(JSON.stringify({task, payload})).digest("hex");

  if (cache.has(key)) return res.json(cache.get(key));

  const { base, url } = chooseModel(task);
  payload.model = base;

  const r = await fetch(f"{url}/v1/chat/completions", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
  });
  const data = await r.json();
  cache.set(key, data);
  res.json(data);
});

app.listen(8080);
```

---

## 9) Phased Plan

### Phase 0 — Local Pilot (Dev workstations)
- Run **Ollama** locally with `deepseek-coder:6.7b` and `deepseek-coder-v2:16b` (quant if needed).
- Point **Cursor** to the router at `http://localhost:8080`.
- Validate **editor/refactor/tests** tasks and measure latency/quality.

### Phase 1 — Staging (Single GPU node)
- Deploy **docker-compose** stack (Ollama + Router + Redis).
- Enable **Code‑RAG** for key repos; store embeddings in pgvector.
- Turn on **pre/post filters**, basic telemetry, and output caching.

### Phase 2 — Production (Throughput & Governance)
- Add **vLLM** for higher‑throughput tasks (`rag-*`, large jobs).
- Pin model versions; enable rollout + rollback headers.
- Tighten rate limits, logging redaction, and SLOs (P95: 6.7B < 2s; 16B < 4s).

### Phase 3 — Optimize & Expand
- Add **Doc‑RAG** for policies/FAQs with citations.
- Introduce **PR comment bot** (CI) using 6.7B and enforce deterministic linters.
- Expand guardrails (secret scanning, command audits) and dashboards.

---

## 10) Capabilities Matrix
(Editable **Excel**: deepseek_infra_capabilities.xlsx in the same folder)

