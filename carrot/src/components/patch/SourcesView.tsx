'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Search, Copy, Plus, Calendar, User, Building } from 'lucide-react';

interface Source {
  id: string;
  title: string;
  url: string;
  author?: string;
  publisher?: string;
  publishedAt?: Date;
  description?: string;
  domain: string;
  favicon?: string;
  tags: string[];
  addedAt: Date;
  addedBy: {
    name: string;
    username: string;
  };
}

interface Patch {
  id: string;
  name: string;
}

interface SourcesViewProps {
  patch: Patch;
}

export default function SourcesView({ patch }: SourcesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Mock data - in real implementation, this would come from props or API
  const sources: Source[] = [
    {
      id: '1',
      title: 'Congressional Research Service Report on Term Limits',
      url: 'https://crsreports.congress.gov/product/pdf/R/R46789',
      author: 'Congressional Research Service',
      publisher: 'Congressional Research Service',
      publishedAt: new Date('2023-12-15'),
      description: 'Comprehensive analysis of term limits legislation and its effects on congressional effectiveness.',
      domain: 'crsreports.congress.gov',
      tags: ['research', 'government', 'academic'],
      addedAt: new Date('2024-01-15'),
      addedBy: { name: 'Dr. Sarah Chen', username: 'sarahchen' }
    },
    {
      id: '2',
      title: 'Public Opinion on Congressional Term Limits',
      url: 'https://news.gallup.com/poll/123456/term-limits-support',
      author: 'Gallup Organization',
      publisher: 'Gallup',
      publishedAt: new Date('2023-11-20'),
      description: 'Recent polling data showing public support for congressional term limits.',
      domain: 'news.gallup.com',
      tags: ['polling', 'public-opinion', 'data'],
      addedAt: new Date('2024-01-14'),
      addedBy: { name: 'John Doe', username: 'johndoe' }
    },
    {
      id: '3',
      title: 'Term Limits and Legislative Effectiveness: A Meta-Analysis',
      url: 'https://journals.sagepub.com/doi/10.1177/1234567890123456',
      author: 'Dr. Michael Johnson',
      publisher: 'American Political Science Review',
      publishedAt: new Date('2023-10-10'),
      description: 'Academic study examining the relationship between term limits and legislative productivity.',
      domain: 'journals.sagepub.com',
      tags: ['academic', 'research', 'meta-analysis'],
      addedAt: new Date('2024-01-13'),
      addedBy: { name: 'Jane Smith', username: 'janesmith' }
    }
  ];

  const allDomains = ['all', ...Array.from(new Set(sources.map(source => source.domain)))];
  const allTags = Array.from(new Set(sources.flatMap(source => source.tags)));

  const filteredSources = sources.filter(source => {
    const matchesSearch = source.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         source.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         source.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDomain = selectedDomain === 'all' || source.domain === selectedDomain;
    return matchesSearch && matchesDomain;
  });

  const copyCitation = async (source: Source) => {
    const citation = `${source.author ? source.author + '. ' : ''}"${source.title}." ${source.publisher ? source.publisher + ', ' : ''}${source.publishedAt ? source.publishedAt.toLocaleDateString() + '. ' : ''}${source.url}`;
    try {
      await navigator.clipboard.writeText(citation);
      // TODO: Show toast notification
      console.log('Citation copied to clipboard');
    } catch (err) {
      console.error('Failed to copy citation:', err);
    }
  };

  const attachToTimeline = (source: Source) => {
    // TODO: Implement timeline attachment
    console.log('Attach to timeline:', source.id);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[#0B0B0F]">Sources</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            <Button className="bg-[#FF6A00] hover:bg-[#E55A00] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#60646C] w-4 h-4" />
          <Input
            placeholder="Search sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-4 pt-4 border-t border-[#E6E8EC]">
            <div>
              <label className="block text-sm font-medium text-[#60646C] mb-2">
                Domain
              </label>
              <div className="flex flex-wrap gap-2">
                {allDomains.map(domain => (
                  <Badge
                    key={domain}
                    variant={selectedDomain === domain ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedDomain(domain)}
                  >
                    {domain === 'all' ? 'All Domains' : domain}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sources List */}
      {filteredSources.length > 0 ? (
        <div className="space-y-4">
          {filteredSources.map(source => (
            <div
              key={source.id}
              className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Favicon */}
                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                  <ExternalLink className="w-4 h-4 text-[#60646C]" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-[#0B0B0F] mb-1 line-clamp-2">
                      {source.title}
                    </h3>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyCitation(source)}
                        title="Copy Citation"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => attachToTimeline(source)}
                        title="Attach to Timeline"
                      >
                        <Calendar className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(source.url, '_blank')}
                        title="Open Source"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {source.description && (
                    <p className="text-sm text-[#60646C] mb-3 line-clamp-2">
                      {source.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-[#60646C] mb-3">
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {source.domain}
                    </span>
                    {source.author && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {source.author}
                      </span>
                    )}
                    {source.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {source.publishedAt.toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {source.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="text-xs text-[#60646C]">
                    Added by {source.addedBy.name} on {source.addedAt.toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-12 text-center">
          <ExternalLink className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#0B0B0F] mb-2">No sources found</h3>
          <p className="text-[#60646C] mb-4">
            {searchQuery || selectedDomain !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'No sources have been added to this patch yet'
            }
          </p>
          <Button className="bg-[#FF6A00] hover:bg-[#E55A00] text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Source
          </Button>
        </div>
      )}
    </div>
  );
}
