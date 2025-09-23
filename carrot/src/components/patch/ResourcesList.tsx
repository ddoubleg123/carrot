'use client';

import { useState, useMemo } from 'react';
import { cardVariants, sectionHeading } from '@/styles/cards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ExternalLink, Copy, Check, Calendar, User, Building, Plus } from 'lucide-react';

interface Source {
  id: string;
  title: string;
  url: string;
  author?: string | null;
  publisher?: string | null;
  publishedAt?: Date | null;
  citeMeta?: {
    title: string;
    url: string;
    author?: string;
    publisher?: string;
    publishedAt?: string;
  } | null;
}

interface ResourcesListProps {
  sources: Source[];
}

export default function ResourcesList({ sources }: ResourcesListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter sources based on search query
  const filteredSources = useMemo(() => {
    if (!searchQuery) return sources;

    const query = searchQuery.toLowerCase();
    return sources.filter(source => 
      source.title.toLowerCase().includes(query) ||
      source.author?.toLowerCase().includes(query) ||
      source.publisher?.toLowerCase().includes(query) ||
      source.url.toLowerCase().includes(query)
    );
  }, [sources, searchQuery]);

  // Generate citation text
  const generateCitation = (source: Source): string => {
    const meta = source.citeMeta;
    if (!meta) {
      // Fallback citation format
      const author = source.author ? `${source.author}. ` : '';
      const title = source.title;
      const publisher = source.publisher ? ` ${source.publisher}` : '';
      const date = source.publishedAt ? ` (${source.publishedAt.getFullYear()})` : '';
      const url = ` ${source.url}`;
      
      return `${author}"${title}."${publisher}${date}${url}`;
    }

    // Use citeMeta for proper citation
    const author = meta.author ? `${meta.author}. ` : '';
    const title = meta.title;
    const publisher = meta.publisher ? ` ${meta.publisher}` : '';
    const date = meta.publishedAt ? ` (${new Date(meta.publishedAt).getFullYear()})` : '';
    const url = ` ${meta.url}`;
    
    return `${author}"${title}."${publisher}${date}${url}`;
  };

  const copyCitation = async (source: Source) => {
    const citation = generateCitation(source);
    try {
      await navigator.clipboard.writeText(citation);
      setCopiedId(source.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy citation:', err);
    }
  };

  const getFaviconUrl = (url: string): string => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return '/favicon.ico';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={sectionHeading}>Resources</h2>
          <p className="text-sm text-[#60646C]">
            Saved sources and references
          </p>
        </div>
        <Button className="bg-[#0A5AFF] hover:bg-[#0A5AFF]/90 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Source
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#60646C] w-4 h-4" />
        <Input
          placeholder="Search sources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#60646C]">
          {filteredSources.length} source{filteredSources.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Sources list */}
      <div className="space-y-3">
        {filteredSources.length === 0 ? (
          <div className={cardVariants.default}>
            <div className="text-center py-8">
              <ExternalLink className="w-12 h-12 text-[#60646C] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0B0B0F] mb-2">No sources found</h3>
              <p className="text-[#60646C]">
                {searchQuery
                  ? 'Try adjusting your search terms.'
                  : 'No sources have been added to this patch yet.'}
              </p>
            </div>
          </div>
        ) : (
          filteredSources.map((source) => (
            <div key={source.id} className={cardVariants.default}>
              <div className="flex items-start gap-4">
                {/* Favicon */}
                <div className="flex-shrink-0 mt-1">
                  <img
                    src={getFaviconUrl(source.url)}
                    alt=""
                    className="w-4 h-4"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-[#0B0B0F] mb-1 line-clamp-2">
                        {source.title}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-xs text-[#60646C] mb-2">
                        {source.author && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{source.author}</span>
                          </div>
                        )}
                        {source.publisher && (
                          <div className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            <span>{source.publisher}</span>
                          </div>
                        )}
                        {source.publishedAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{source.publishedAt.toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#0A5AFF] hover:underline break-all"
                      >
                        {source.url}
                      </a>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCitation(source)}
                        className="p-2"
                        title="Copy citation"
                      >
                        {copiedId === source.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="p-2"
                        title="Open source"
                      >
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
