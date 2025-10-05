# Sources Registry

This document tracks all external sources, APIs, and capabilities used to train agents and power group pages/search. Keep this up-to-date.

- File of record: `src/lib/sources/registry.ts`
- API to fetch registry: `GET /api/sources/registry`
- Example provider endpoints:
  - `GET /api/sources/github/openlibrary/repos`

## Sources

### OpenLibrary
- ID: `openlibrary`
- Categories: github, open-data, api, docs
- Homepage: https://openlibrary.org/
- GitHub org: https://github.com/openlibrary
- Status: enabled

#### Why we use it (Capabilities)
- Agent grounding on production-grade metadata models (works/editions/authors)
- Search & discovery patterns (facets, pagination, autosuggest)
- Accessibility and documentation exemplars
- Conversation artifacts from issues/PRs for Messages patterns

#### APIs
- Open Library REST API
  - Docs: https://openlibrary.org/developers/api
  - Base: https://openlibrary.org
  - Notes: works, editions, authors, subjects, search
- Covers API
  - Docs: https://openlibrary.org/dev/docs/api/covers
  - Base: https://covers.openlibrary.org
  - Notes: cover images by ID/ISBN (S/M/L sizes)
- Search API
  - Docs: https://openlibrary.org/dev/docs/api/search
  - Base: https://openlibrary.org/search.json
  - Notes: query parsing, facets, pagination

#### Indexing Plan (future)
- Phase 1: Index organization repo metadata + READMEs for grounding
- Phase 2: Index `/docs` folders and API reference pages
- Phase 3: Sample issues/PRs (titles + first 10 comments) for conversation structures

## Maintenance
- Add/edit entries in `src/lib/sources/registry.ts`
- Expose via `/api/sources/registry`
- Add per-provider routes under `/api/sources/*` as needed
- Use a GitHub token (read-only) via `GITHUB_TOKEN` when calling GitHub APIs (optional, recommended)
