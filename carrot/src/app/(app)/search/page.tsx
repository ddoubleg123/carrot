'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search as SearchIcon, Filter, Github, BookOpen, Globe } from 'lucide-react';

// Simple facet state
type SourceFacet = {
  openlibrary: boolean;
};

type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description?: string;
  topics?: string[];
  language?: string;
  archived?: boolean;
  pushed_at?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
};

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [facets, setFacets] = useState<SourceFacet>({ openlibrary: true });
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [tab, setTab] = useState<'all' | 'sources'>('all');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!facets.openlibrary) { setRepos([]); return; }
      setLoadingRepos(true);
      try {
        const res = await fetch('/api/sources/github/openlibrary/repos?per_page=100', { cache: 'no-store' });
        const json = await res.json();
        if (active && json?.repos) setRepos(json.repos as GithubRepo[]);
      } finally {
        setLoadingRepos(false);
      }
    };
    load();
    return () => { active = false; };
  }, [facets.openlibrary]);

  const filteredRepos = useMemo(() => {
    if (!q) return repos;
    const needle = q.toLowerCase();
    return repos.filter(r =>
      r.name.toLowerCase().includes(needle)
      || (r.description || '').toLowerCase().includes(needle)
      || (r.topics || []).join(' ').toLowerCase().includes(needle)
    );
  }, [q, repos]);

  return (
    <div className="p-4 md:p-6 grid gap-4" style={{ gridTemplateColumns: '280px 1fr' }}>
      {/* Left: Filters */}
      <aside className="hidden md:block border rounded-lg bg-white p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Filters</h2>
          <Button variant="outline" size="sm" className="gap-2"><Filter className="w-4 h-4"/>Reset</Button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Sources</div>
            <div className="flex flex-wrap gap-2">
              <FacetChip
                active={facets.openlibrary}
                onClick={() => setFacets(s => ({ ...s, openlibrary: !s.openlibrary }))}
                label="OpenLibrary"
                icon={<BookOpen className="w-3.5 h-3.5"/>}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Right: Search + Results */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
            <SearchIcon className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="sources">Sources</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Summaries */}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          {facets.openlibrary && <Badge variant="secondary" className="gap-1"><BookOpen className="w-3 h-3"/>OpenLibrary</Badge>}
        </div>

        {/* Results */}
        <div className="space-y-3">
          {tab === 'all' && (
            <div className="text-sm text-gray-600">
              Select a source to see results. Try enabling <span className="font-medium">OpenLibrary</span>.
            </div>
          )}

          {tab === 'sources' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2"><Globe className="w-4 h-4"/>Open sources</h3>
              <div>
                {loadingRepos ? (
                  <Card><CardContent className="p-4 text-sm">Loading OpenLibrary repositories…</CardContent></Card>
                ) : (
                  <RepoGrid repos={filteredRepos} />
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FacetChip({ active, onClick, label, icon }: { active?: boolean; onClick?: () => void; label: string; icon?: React.ReactNode; }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${active ? 'bg-gray-50 border-gray-300' : 'border-gray-200 hover:bg-gray-50'}`}>
      {icon}
      {label}
    </button>
  );
}

function RepoGrid({ repos }: { repos: GithubRepo[] }) {
  if (!repos || repos.length === 0) return <div className="text-sm text-gray-600">No repositories.</div>;
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {repos.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <span className="truncate flex items-center gap-2"><Github className="w-4 h-4"/>{r.name}</span>
              {r.archived && <Badge variant="outline" className="text-[10px]">Archived</Badge>}
            </CardTitle>
            <div className="text-xs text-gray-600 line-clamp-2">{r.description || '—'}</div>
          </CardHeader>
          <CardContent className="text-xs text-gray-600 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {r.language && <Badge variant="secondary">{r.language}</Badge>}
              {r.topics?.slice(0, 4).map((t) => (
                <Badge key={t} variant="outline">{t}</Badge>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span>⭐ {r.stargazers_count || 0}</span>
              <a className="text-blue-600 hover:underline" target="_blank" href={r.html_url}>Open</a>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
