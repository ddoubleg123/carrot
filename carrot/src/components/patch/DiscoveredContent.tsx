'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, FileText, MessageSquare, Calendar, Globe, Star } from 'lucide-react';

interface DiscoveredContentItem {
  id: string;
  type: string;
  title: string;
  content: string;
  relevanceScore: number;
  sourceUrl?: string;
  tags: string[];
  status: string;
  auditScore?: number;
  auditNotes?: string;
  createdAt: string;
}

interface DiscoveredContentProps {
  patchHandle: string;
}

export default function DiscoveredContent({ patchHandle }: DiscoveredContentProps) {
  const [content, setContent] = useState<DiscoveredContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    let abort = new AbortController();
    let timer: any;

    const fetchContent = async () => {
      try {
        const response = await fetch(`/api/patches/${patchHandle}/discovered-content`, { signal: abort.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to fetch discovered content');
        const data = await response.json();
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.discoveredContent) ? data.discoveredContent : [];
        // Normalize fields to our view model
        const mapped: DiscoveredContentItem[] = items.map((it: any) => ({
          id: String(it.id ?? crypto.randomUUID?.() ?? Math.random()),
          type: String(it.type ?? 'source'),
          title: String(it.title ?? 'Untitled'),
          content: String(it.content ?? it.description ?? ''),
          relevanceScore: Number(it.relevanceScore ?? 0),
          sourceUrl: typeof it.url === 'string' ? it.url : (typeof it.sourceUrl === 'string' ? it.sourceUrl : undefined),
          tags: Array.isArray(it.tags) ? it.tags : [],
          status: String(it.status ?? 'pending'),
          auditScore: typeof it.auditScore === 'number' ? it.auditScore : undefined,
          auditNotes: typeof it.auditNotes === 'string' ? it.auditNotes : undefined,
          createdAt: typeof it.createdAt === 'string' ? it.createdAt : new Date().toISOString(),
        }));
        setContent(mapped);
        setError(null);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    // Initial load and poll every 10s (lighter)
    fetchContent();
    timer = setInterval(fetchContent, 10000);
    return () => { try { abort.abort(); } catch {} clearInterval(timer); };
  }, [patchHandle]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="h-5 w-5" />;
      case 'source': return <Globe className="h-5 w-5" />;
      case 'discussion_topic': return <MessageSquare className="h-5 w-5" />;
      case 'timeline_event': return <Calendar className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'document': return 'bg-blue-100 text-blue-800';
      case 'source': return 'bg-green-100 text-green-800';
      case 'discussion_topic': return 'bg-purple-100 text-purple-800';
      case 'timeline_event': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'audited': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredContent = content.filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Failed to load discovered content: {error}</p>
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <div className="text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-2">No discovered content yet</p>
          <p className="text-sm">AI is working on finding relevant content for this group...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: 'All', count: content.length },
          { key: 'document', label: 'Documents', count: content.filter(c => c.type === 'document').length },
          { key: 'source', label: 'Sources', count: content.filter(c => c.type === 'source').length },
          { key: 'discussion_topic', label: 'Discussions', count: content.filter(c => c.type === 'discussion_topic').length },
          { key: 'timeline_event', label: 'Events', count: content.filter(c => c.type === 'timeline_event').length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === key
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Content List */}
      <div className="space-y-4">
        {filteredContent.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${getTypeColor(item.type)}`}>
                {getTypeIcon(item.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-700">
                        {item.relevanceScore}/10
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                  {item.content}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{item.tags.length - 3} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </a>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {item.auditScore && (
                  <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-blue-900">AI Audit:</span>
                      <span className="text-sm text-blue-700">{item.auditScore}/10</span>
                    </div>
                    {item.auditNotes && (
                      <p className="text-xs text-blue-700">{item.auditNotes}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
