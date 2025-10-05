export type SourceCategory = 'github' | 'open-data' | 'docs' | 'api' | 'community';

export interface SourceEntry {
  id: string;                 // unique id e.g., 'openlibrary'
  title: string;              // human display
  owner?: string;             // org/owner for GitHub
  description: string;
  homepage?: string;
  categories: SourceCategory[];
  tags: string[];
  github?: {
    org?: string;             // e.g., 'openlibrary'
    repos?: string[];         // explicit allowlist if needed
  };
  apis?: Array<{
    name: string;
    docs: string;
    baseUrl?: string;
    notes?: string;
  }>;
  capabilities: string[];     // why we use it
  status: 'planned' | 'enabled' | 'paused';
}

// Central registry of external sources we use to train agents and power group pages/search
const REGISTRY: SourceEntry[] = [
  {
    id: 'openlibrary',
    title: 'OpenLibrary',
    description:
      'Open Library by Internet Archive: book/author/edition catalog with robust search and public APIs. Strong patterns for schema, search, and accessibility.',
    homepage: 'https://openlibrary.org/',
    categories: ['github', 'open-data', 'api', 'docs'],
    tags: ['catalog', 'search', 'schema', 'accessibility', 'oss'],
    github: {
      org: 'openlibrary',
    },
    apis: [
      {
        name: 'Open Library REST API',
        docs: 'https://openlibrary.org/developers/api',
        baseUrl: 'https://openlibrary.org',
        notes: 'Works, editions, authors, subjects, search endpoints',
      },
      {
        name: 'Covers API',
        docs: 'https://openlibrary.org/dev/docs/api/covers',
        baseUrl: 'https://covers.openlibrary.org',
        notes: 'Cover images by ID/ISBN with size variants',
      },
      {
        name: 'Search API',
        docs: 'https://openlibrary.org/dev/docs/api/search',
        baseUrl: 'https://openlibrary.org/search.json',
        notes: 'Query parsing, facets, pagination patterns',
      }
    ],
    capabilities: [
      'Agent grounding on production-grade metadata models',
      'Search & discovery patterns (facets, pagination, autosuggest)',
      'A11y and docs exemplars for UI/content',
      'Conversation artifacts from issues/PRs for Messages patterns',
    ],
    status: 'enabled',
  },
];

export function listSources(): SourceEntry[] {
  return REGISTRY;
}

export function getSourceById(id: string): SourceEntry | undefined {
  return REGISTRY.find((s) => s.id === id);
}

export default REGISTRY;
