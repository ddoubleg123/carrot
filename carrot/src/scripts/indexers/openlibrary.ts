import type { NextRequest } from 'next/server';

export type IndexedChunk = {
  source: 'openlibrary';
  repo: string;
  path: string;
  url: string;
  content: string;
  fetched_at: string;
};

export type IndexSummary = {
  repos_considered: number;
  repos_indexed: number;
  files_indexed: number;
  chunks: number;
  errors: Array<{ repo: string; path?: string; error: string }>;
};

const GH_HEADERS = () => {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'carrot-indexer',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
};

async function listRepos(perPage = 50, page = 1) {
  const url = `https://api.github.com/orgs/openlibrary/repos?per_page=${perPage}&page=${page}`;
  const res = await fetch(url, { headers: GH_HEADERS(), cache: 'no-store' });
  if (!res.ok) throw new Error(`GitHub repos error ${res.status}`);
  return (await res.json()) as any[];
}

async function getReadme(owner: string, repo: string) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`;
  const res = await fetch(url, { headers: GH_HEADERS(), cache: 'no-store' });
  if (res.ok) return { path: 'README.md', content: await res.text(), url };
  // try main
  const urlMain = `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`;
  const resMain = await fetch(urlMain, { headers: GH_HEADERS(), cache: 'no-store' });
  if (resMain.ok) return { path: 'README.md', content: await resMain.text(), url: urlMain };
  return null;
}

async function listDocs(owner: string, repo: string): Promise<string[]> {
  // best‑effort: fetch directory listing via GitHub API contents endpoint
  const candidates = ['docs', '.github'];
  const files: string[] = [];
  for (const dir of candidates) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dir}`;
      const res = await fetch(url, { headers: GH_HEADERS(), cache: 'no-store' });
      if (!res.ok) continue;
      const data = (await res.json()) as any[];
      for (const item of data) {
        if (item.type === 'file' && /\.(md|mdx|txt)$/i.test(item.name)) {
          files.push(item.path);
        }
      }
    } catch {
      // ignore
    }
  }
  return files;
}

async function fetchRaw(owner: string, repo: string, path: string) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/master/${path}`;
  let res = await fetch(url, { headers: GH_HEADERS(), cache: 'no-store' });
  if (!res.ok) {
    const urlMain = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
    res = await fetch(urlMain, { headers: GH_HEADERS(), cache: 'no-store' });
    if (!res.ok) return null;
    return { url: urlMain, content: await res.text() };
  }
  return { url, content: await res.text() };
}

function toPlainText(markdown: string) {
  // minimal markdown -> text for indexing; replace code fences and links
  return markdown
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '').trim())
    .replace(/\!\[[^\]]*\]\([^\)]*\)/g, '')
    .replace(/\[[^\]]*\]\(([^\)]*)\)/g, '$1')
    .replace(/^#+\s/gm, '')
    .replace(/>\s?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function chunk(text: string, size = 2000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks.filter(Boolean);
}

export async function indexOpenLibrary(limitRepos = 20) {
  const owner = 'openlibrary';
  const chunks: IndexedChunk[] = [];
  const errors: IndexSummary['errors'] = [];
  let reposIndexed = 0;
  let filesIndexed = 0;

  const repos = await listRepos(100, 1);
  const selected = repos.slice(0, limitRepos);

  for (const r of selected) {
    const repoName = r.name as string;
    try {
      const readme = await getReadme(owner, repoName);
      if (readme) {
        const text = toPlainText(readme.content);
        const parts = chunk(text);
        parts.forEach((p) =>
          chunks.push({ source: 'openlibrary', repo: repoName, path: readme.path, url: readme.url, content: p, fetched_at: new Date().toISOString() })
        );
        filesIndexed += 1;
      }

      const docPaths = await listDocs(owner, repoName);
      for (const p of docPaths) {
        const raw = await fetchRaw(owner, repoName, p);
        if (!raw) continue;
        const text = toPlainText(raw.content);
        const parts = chunk(text);
        parts.forEach((c) =>
          chunks.push({ source: 'openlibrary', repo: repoName, path: p, url: raw.url, content: c, fetched_at: new Date().toISOString() })
        );
        filesIndexed += 1;
      }

      reposIndexed += 1;
    } catch (e: any) {
      errors.push({ repo: repoName, error: e?.message || String(e) });
    }
  }

  const summary: IndexSummary = {
    repos_considered: selected.length,
    repos_indexed: reposIndexed,
    files_indexed: filesIndexed,
    chunks: chunks.length,
    errors,
  };

  // TODO: push chunks to search/vector index here
  // await indexClient.upsert(chunks)

  return { summary, chunks };
}
