'use client';

import { useState, useMemo } from 'react';
import { cardVariants, sectionHeading } from '@/styles/cards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Filter, Search, ExternalLink, Tag, ChevronDown, ChevronUp } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  dateStart: Date;
  dateEnd?: Date | null;
  summary: string;
  tags: string[];
  media?: {
    type: 'image' | 'video';
    url: string;
    alt?: string;
  } | null;
  sources: Array<{
    id: string;
    title: string;
    url: string;
  }>;
}

interface TimelineViewProps {
  events: Event[];
}

export default function TimelineView({ events }: TimelineViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [viewMode, setViewMode] = useState<'compact' | 'expanded'>('compact');
  const [showFilters, setShowFilters] = useState(false);

  // Get all unique tags from events
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    events.forEach(event => {
      event.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [events]);

  // Filter events based on search, tags, and date range
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          event.title.toLowerCase().includes(query) ||
          event.summary.toLowerCase().includes(query) ||
          event.tags.some(tag => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Tag filter
      if (selectedTags.length > 0) {
        const hasSelectedTag = selectedTags.some(tag => event.tags.includes(tag));
        if (!hasSelectedTag) return false;
      }

      // Date range filter
      if (dateRange.from) {
        const fromDate = new Date(dateRange.from);
        if (event.dateStart < fromDate) return false;
      }
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        if (event.dateStart > toDate) return false;
      }

      return true;
    });
  }, [events, searchQuery, selectedTags, dateRange]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
    setDateRange({});
  };

  return (
    <div className="space-y-6 mt-4 md:mt-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={sectionHeading}>Timeline</h2>
          <p className="text-sm text-[#60646C]">
            Chronological events and milestones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'compact' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('compact')}
            className={viewMode === 'compact' ? 'bg-[#FF6A00] hover:bg-[#FF6A00]/90' : ''}
          >
            Compact
          </Button>
          <Button
            variant={viewMode === 'expanded' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('expanded')}
            className={viewMode === 'expanded' ? 'bg-[#FF6A00] hover:bg-[#FF6A00]/90' : ''}
          >
            Expanded
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className={cardVariants.default}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#0B0B0F]">Filters</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {showFilters && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#60646C] w-4 h-4" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0B0B0F] mb-1">
                  From Date
                </label>
                <Input
                  type="date"
                  value={dateRange.from || ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0B0B0F] mb-1">
                  To Date
                </label>
                <Input
                  type="date"
                  value={dateRange.to || ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
                Filter by Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'secondary'}
                    className={`cursor-pointer hover:bg-gray-100 transition-colors ${
                      selectedTags.includes(tag) 
                        ? 'bg-[#0A5AFF] text-white' 
                        : 'bg-gray-100 text-gray-700'
                    }`}
                    onClick={() => toggleTag(tag)}
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {(searchQuery || selectedTags.length > 0 || dateRange.from || dateRange.to) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#60646C]">
          Showing {filteredEvents.length} of {events.length} events
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-4 md:p-5">
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-[#60646C] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0B0B0F] mb-2">No events found</h3>
              <p className="text-[#60646C]">
                {searchQuery || selectedTags.length > 0 || dateRange.from || dateRange.to
                  ? 'Try adjusting your filters to see more events.'
                  : 'No events have been added to this patch yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-[#E6E8EC]"></div>
            
            {filteredEvents.map((event, index) => (
              <div key={event.id} className="relative flex gap-4 mb-6">
                {/* Timeline indicator - centered on line */}
                <div className="flex-shrink-0 w-12 flex justify-center">
                  <div className="w-3 h-3 bg-[#FF6A00] rounded-full mt-2 relative z-10"></div>
                </div>

                {/* Event content */}
                <div className="flex-1 min-w-0">
                  <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-4 md:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-[#0B0B0F]">
                            {event.title}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {event.dateStart.toLocaleDateString()}
                            {event.dateEnd && ` - ${event.dateEnd.toLocaleDateString()}`}
                          </Badge>
                        </div>

                        <p className={`text-[#60646C] mb-4 ${
                          viewMode === 'compact' ? 'line-clamp-3' : ''
                        }`}>
                          {event.summary}
                        </p>

                        {/* Tags */}
                        {event.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-4">
                            {event.tags.map(tag => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Sources */}
                        {event.sources.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-[#0B0B0F]">Sources:</h4>
                            <div className="space-y-1">
                              {event.sources.map(source => (
                                <div key={source.id} className="flex items-center gap-2 text-sm">
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#FF6A00] hover:text-[#FF6A00]/80 flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    {source.title}
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Media */}
                      {event.media && (
                        <div className="flex-shrink-0">
                          <img
                            src={event.media.url}
                            alt={event.media.alt || event.title}
                            className="w-32 h-24 object-cover rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}