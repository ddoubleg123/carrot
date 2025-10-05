# Carrot Unified Content Ingestion, Enrichment, and Routing

This document describes the architecture implemented in this codebase for ingesting content (manual and automated), enriching it (transcripts, summaries, tags/entities), and routing it to Carrot Patch groups based on relevance.

See also: `docs/sources.md` for source registry and APIs.

## Key Components
- Ingestion API: `POST /api/content`
- Content detail: `GET /api/content/:id`
- Source registry + indexers: see `/api/sources/*` and `/api/index/sources/*`
- Enrichment: `src/lib/audit/deepseek.ts` (server-side)
- Canonicalization: `src/lib/ingest/canonical.ts`
- Relevance router: `src/lib/router/relevance.ts`, `src/lib/router/policies.ts`
- Patch UI: `src/app/(app)/patch/[handle]/` (Discovery list & cards)

## Pipeline
queued → fetching → enriching → ready | failed

1) Ingestion Gateway
- Accepts URL or upload token, optional `agentId`, `patchHint`.
- Normalizes URL, creates a content/job record, enqueues for enrichment.

2) Media workers (type-specific)
- article/text: fetch + Readability → fullText; extract OG/media.
- video: ASR (Whisper) → transcript; generate thumbnails.
- image/pdf: OCR → text; EXIF.

3) Enrichment (DeepSeek Audit)
- Produces: summaryShort (120–180), keyPoints (3–5), notableQuote, categories/tags/entities, readingTime, quality score, flags.

4) Embeddings
- Generate vector representation for routing/search.

5) Relevance Router
- Scores content against Patch profiles/rules.
- High → auto-attach; mid → review queue; low → discovery-only.

6) Storage & Index
- Database (Prisma/Postgres) + Media storage + Search/Vector index.

## Environment
- `DEEPSEEK_API_URL`, `DEEPSEEK_API_KEY` (audit)
- `WHISPER_URL` (ASR service)
- `GITHUB_TOKEN` (indexers, optional)
- `STORAGE_BUCKET`, `STORAGE_KIND` (S3/GCS), with signed URL strategy

## Non-negotiables
- Strict provenance/licensing stored per item.
- Agents subscribe to tags/entities/patches; webhooks on routing.
- Accessibility AA; keyboard flows; reduced motion respected.
