'use client';

import React, { useEffect, useState } from 'react';
import CarrotSpinner from '@/components/ui/CarrotSpinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink, RefreshCw, BookOpen, Github, Globe } from 'lucide-react';

type SourceEntry = {
  id: string;
  title: string;
  owner?: string;
  description: string;
  homepage?: string;
  categories: string[];
  tags: string[];
  github?: { org?: string; repos?: string[] };
  apis?: Array<{ name: string; docs: string; baseUrl?: string; notes?: string }>;
  capabilities: string[];
  status: 'planned' | 'enabled' | 'paused';
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

export default function SourcesPage() {
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/sources/registry', { cache: 'no-store' });
        const json = await res.json();
        if (active && json?.sources) setSources(json.sources as SourceEntry[]);
      } finally {
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const openlibrary = sources.find((s) => s.id === 'openlibrary');

  const loadOpenLibraryRepos = async () => {
    setReposLoading(true);
    try {
      const res = await fetch('/api/sources/github/openlibrary/repos?per_page=100', { cache: 'no-store' });
      const json = await res.json();
      if (json?.repos) setRepos(json.repos as GithubRepo[]);
    } finally {
      setReposLoading(false);
    }
  };

  const filteredRepos = repos.filter((r) =>
    !query
      || r.name.toLowerCase().includes(query.toLowerCase())
      || (r.description || '').toLowerCase().includes(query.toLowerCase())
      || (r.topics || []).join(' ').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sources</h1>
        <div className="text-sm text-gray-600">Registry of external sources used to train agents and group pages</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <Card>
            <CardContent className="p-6"><CarrotSpinner label="Loading sources…" /></CardContent>
          </Card>
        ) : (
          sources.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {s.id === 'openlibrary' ? <BookOpen className="w-5 h-5"/> : <Globe className="w-5 h-5"/>}
                  {s.title}
                  <StatusBadge status={s.status} />
                </CardTitle>
                <div className="text-sm text-gray-600">{s.description}</div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {s.categories.map((c) => (<Badge key={c} variant="secondary">{c}</Badge>))}
                  {s.tags.map((t) => (<Badge key={t} variant="outline">{t}</Badge>))}
                </div>
                {s.github?.org && (
                  <div className="flex items-center gap-2 text-sm">
                    <Github className="w-4 h-4" />
                    <a className="text-blue-600 hover:underline" target="_blank" href={`https://github.com/${s.github.org}`}>github.com/{s.github.org}</a>
                  </div>
                )}
                {s.homepage && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4" />
                    <a className="text-blue-600 hover:underline" target="_blank" href={s.homepage}>{s.homepage}</a>
                  </div>
                )}
                {s.apis && s.apis.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">APIs</div>
                    <ul className="space-y-1">
                      {s.apis.map((api) => (
                        <li key={api.name} className="flex items-center gap-2 text-sm">
                          <ExternalLink className="w-3.5 h-3.5"/>
                          <a className="text-blue-600 hover:underline" target="_blank" href={api.docs}>{api.name}</a>
                          {api.baseUrl && <span className="text-gray-500">• {api.baseUrl}</span>}
                          {api.notes && <span className="text-gray-500">— {api.notes}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {s.id === 'openlibrary' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button onClick={loadOpenLibraryRepos} disabled={reposLoading} className="gap-2">
                        <RefreshCw className={`w-4 h-4 ${reposLoading ? 'animate-spin' : ''}`} />
                        {reposLoading ? 'Loading repos…' : 'Load repos'}
                      </Button>
                      {repos.length > 0 && (
                        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter repos" className="max-w-xs" />
                      )}
                    </div>
                    {repos.length > 0 && (
                      <Tabs defaultValue="all" className="w-full">
                        <TabsList>
                          <TabsTrigger value="all">All</TabsTrigger>
                          <TabsTrigger value="active">Active</TabsTrigger>
                          <TabsTrigger value="archived">Archived</TabsTrigger>
                        </TabsList>
                        <TabsContent value="all">
                          <RepoGrid repos={filteredRepos} />
                        </TabsContent>
                        <TabsContent value="active">
                          <RepoGrid repos={filteredRepos.filter(r => !r.archived)} />
                        </TabsContent>
                        <TabsContent value="archived">
                          <RepoGrid repos={filteredRepos.filter(r => r.archived)} />
                        </TabsContent>
                      </Tabs>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-sm font-medium">Capabilities</div>
                  <ul className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
                    {s.capabilities.map((cap) => (<li key={cap}>{cap}</li>))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'planned' | 'enabled' | 'paused' }) {
  const palette = status === 'enabled' ? 'bg-green-50 text-green-700' : status === 'paused' ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-700';
  return <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${palette}`}>{status}</span>;
}

function RepoGrid({ repos }: { repos: GithubRepo[] }) {
  if (repos.length === 0) return <div className="text-sm text-gray-600">No repositories.</div>;
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mt-2">
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
