'use client';

import { useState, useMemo, useEffect } from 'react';
import { cardVariants, sectionHeading } from '@/styles/cards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ExternalLink, Copy, Check, Calendar, User, Building, Plus, Trash2, AlertTriangle, Star } from 'lucide-react';

interface Source {
  id: string;
  title: string;
  url: string;
  author?: string | null;
  publisher?: string | null;
  publishedAt?: Date | null;
  relevanceScore?: number;
  status?: 'pending_audit' | 'approved' | 'rejected';
  type?: string;
  description?: string;
  citeMeta?: {
    title: string;
    url: string;
    author?: string;
    publisher?: string;
    publishedAt?: string;
    type?: string;
    description?: string;
    relevanceScore?: number;
    status?: string;
  } | null;
}

interface Patch {
  id: string;
  name: string;
  description?: string | null;
  tags: string[];
  _count: {
    members: number;
    posts: number;
    events: number;
    sources: number;
  };
}

interface ResourcesListProps {
  patch: Patch;
  patchHandle: string;
}

export default function ResourcesList({ patch, patchHandle }: ResourcesListProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch AI-discovered sources
  useEffect(() => {
    const fetchSources = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/patches/${patchHandle}/discovered-content`);
        if (response.ok) {
          const data = await response.json();
          console.log('[ResourcesList] API response:', data);
          // Ensure we have a valid array
          const items = Array.isArray(data.items) ? data.items : [];
          console.log('[ResourcesList] Setting sources:', items);
          setSources(items);
        } else {
          console.error('Failed to fetch sources');
          setSources([]); // Set empty array on error
        }
      } catch (error) {
        console.error('Error fetching sources:', error);
        setSources([]); // Set empty array on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchSources();
  }, [patchHandle]);

  // Delete source
  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this source?')) return;
    
    try {
      setDeletingId(sourceId);
      const response = await fetch(`/api/sources/${sourceId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setSources(prev => prev.filter(s => s.id !== sourceId));
      } else {
        alert('Failed to delete source');
      }
    } catch (error) {
      console.error('Error deleting source:', error);
      alert('Failed to delete source');
    } finally {
      setDeletingId(null);
    }
  };

  // Filter sources based on search query
  const filteredSources = useMemo(() => {
    console.log('[ResourcesList] Computing filteredSources:', { sources, searchQuery });
    if (!sources || !Array.isArray(sources)) {
      console.log('[ResourcesList] No valid sources array, returning empty array');
      return [];
    }
    if (!searchQuery) {
      console.log('[ResourcesList] No search query, returning all sources:', sources.length);
      return sources;
    }

    const query = searchQuery.toLowerCase();
    const filtered = sources.filter(source => 
      source.title?.toLowerCase().includes(query) ||
      source.author?.toLowerCase().includes(query) ||
      source.publisher?.toLowerCase().includes(query) ||
      source.url?.toLowerCase().includes(query) ||
      source.description?.toLowerCase().includes(query)
    );
    console.log('[ResourcesList] Filtered sources:', filtered.length);
    return filtered;
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
    const title = meta.title || source.title;
    const publisher = meta.publisher ? ` ${meta.publisher}` : '';
    const date = meta.publishedAt ? ` (${meta.publishedAt})` : '';
    const url = ` ${meta.url || source.url}`;
    
    return `${author}"${title}."${publisher}${date}${url}`;
  };

  // Copy citation to clipboard
  const copyCitation = async (source: Source) => {
    try {
      const citation = generateCitation(source);
      await navigator.clipboard.writeText(citation);
      setCopiedId(source.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy citation:', error);
    }
  };

  // Get domain from URL
  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={sectionHeading}>Sources</h2>
        <Button variant="outline" size="sm">
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
          {filteredSources.length} AI-discovered source{filteredSources.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Sources list */}
      <div className="space-y-4">
        {isLoading ? (
          <div className={cardVariants.default}>
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0B0B0F] mb-2">Loading AI-discovered sources...</h3>
              <p className="text-[#60646C]">Fetching relevant content for this topic</p>
            </div>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className={cardVariants.default}>
            <div className="text-center py-8">
              <ExternalLink className="w-12 h-12 text-[#60646C] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0B0B0F] mb-2">No sources found</h3>
              <p className="text-[#60646C]">
                {searchQuery
                  ? 'Try adjusting your search terms.'
                  : 'AI is still discovering relevant sources for this topic.'}
              </p>
            </div>
          </div>
        ) : (
          filteredSources.map((source) => {
            const relevanceScore = source.relevanceScore || source.citeMeta?.relevanceScore || 0;
            const status = source.status || source.citeMeta?.status || 'pending_audit';
            const type = source.type || source.citeMeta?.type || 'article';
            const description = source.description || source.citeMeta?.description || '';
            
            return (
              <div key={source.id} className={`${cardVariants.default} relative group hover:shadow-lg transition-shadow`}>
                <div className="flex items-start gap-4">
                  {/* AI Status Indicator */}
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status === 'approved' ? 'bg-green-100' : 
                      status === 'rejected' ? 'bg-red-100' : 
                      'bg-yellow-100'
                    }`}>
                      {status === 'approved' ? (
                        <Star className="w-4 h-4 text-green-600" />
                      ) : status === 'rejected' ? (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      ) : (
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-[#0B0B0F] line-clamp-2">
                            {source.title}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {Math.round(relevanceScore * 100)}% match
                          </Badge>
                        </div>
                        
                        {description && (
                          <p className="text-sm text-[#60646C] mb-3 line-clamp-2">
                            {description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-[#60646C] mb-3">
                          <div className="flex items-center gap-1">
                            <Building className="w-4 h-4" />
                            <span>{getDomain(source.url)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          </div>
                          {source.author && (
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              <span>{source.author}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {getDomain(source.url)}
                          </Badge>
                          <Badge 
                            variant={status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'} 
                            className="text-xs"
                          >
                            {status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyCitation(source)}
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
                          onClick={() => window.open(source.url, '_blank')}
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSource(source.id)}
                          disabled={deletingId === source.id}
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deletingId === source.id ? (
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}