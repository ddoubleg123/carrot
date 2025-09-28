'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, ExternalLink, FileText, Image, Video, File } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  dateStart: string;
  dateEnd?: string;
  summary: string;
  media?: {
    type: 'image' | 'video' | 'pdf';
    url: string;
    alt?: string;
  };
  tags: string[];
  sources: {
    id: string;
    title: string;
    url: string;
    author?: string;
  }[];
}

interface TimelineViewProps {
  events: Event[];
  patchId: string;
}

interface TimelineJSData {
  events: {
    start_date: {
      year: number;
      month?: number;
      day?: number;
    };
    end_date?: {
      year: number;
      month?: number;
      day?: number;
    };
    text: {
      headline: string;
      text: string;
    };
    media?: {
      url: string;
      caption?: string;
      credit?: string;
    };
    group?: string;
  }[];
}

export default function TimelineView({ events, patchId }: TimelineViewProps) {
  const [filteredEvents, setFilteredEvents] = useState<Event[]>(events);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Get all unique tags from events
  const allTags = Array.from(new Set(events.flatMap(event => event.tags)));

  // Filter events based on selected tags and date range
  useEffect(() => {
    let filtered = events;

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(event => 
        event.tags.some(tag => selectedTags.includes(tag))
      );
    }

    // Filter by date range
    if (dateRange.from) {
      filtered = filtered.filter(event => 
        new Date(event.dateStart) >= new Date(dateRange.from)
      );
    }
    if (dateRange.to) {
      filtered = filtered.filter(event => 
        new Date(event.dateStart) <= new Date(dateRange.to)
      );
    }

    setFilteredEvents(filtered);
  }, [events, selectedTags, dateRange]);

  // Convert events to TimelineJS format
  const convertToTimelineJS = (events: Event[]): TimelineJSData => {
    return {
      events: events.map(event => ({
        start_date: {
          year: new Date(event.dateStart).getFullYear(),
          month: new Date(event.dateStart).getMonth() + 1,
          day: new Date(event.dateStart).getDate()
        },
        end_date: event.dateEnd ? {
          year: new Date(event.dateEnd).getFullYear(),
          month: new Date(event.dateEnd).getMonth() + 1,
          day: new Date(event.dateEnd).getDate()
        } : undefined,
        text: {
          headline: event.title,
          text: event.summary
        },
        media: event.media ? {
          url: event.media.url,
          caption: event.media.alt || '',
          credit: event.sources[0]?.author || ''
        } : undefined,
        group: event.tags[0] || 'General'
      }))
    };
  };

  // Initialize TimelineJS (placeholder - would need actual TimelineJS integration)
  useEffect(() => {
    if (timelineRef.current && filteredEvents.length > 0) {
      // TODO: Initialize TimelineJS with convertToTimelineJS(filteredEvents)
      console.log('TimelineJS data:', convertToTimelineJS(filteredEvents));
    }
  }, [filteredEvents]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setDateRange({ from: '', to: '' });
  };

  const getMediaIcon = (type?: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'pdf': return <FileText className="w-4 h-4" />;
      default: return <File className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#0B0B0F] flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Timeline Filters
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>

        {showFilters && (
          <div className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#0B0B0F] mb-2 block">
                  From Date
                </label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#0B0B0F] mb-2 block">
                  To Date
                </label>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium text-[#0B0B0F] mb-2 block">
                Filter by Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className={`cursor-pointer transition-colors ${
                      selectedTags.includes(tag) 
                        ? 'bg-[#FF6A00] text-white' 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={selectedTags.length === 0 && !dateRange.from && !dateRange.to}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* TimelineJS Container */}
      <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm overflow-hidden">
        <div className="p-5 md:p-6 border-b border-[#E6E8EC]">
          <h3 className="text-lg font-semibold text-[#0B0B0F] flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Timeline
          </h3>
          <p className="text-sm text-[#60646C] mt-1">
            {filteredEvents.length} events found
          </p>
        </div>
        
        {/* TimelineJS will be rendered here */}
        <div 
          ref={timelineRef}
          className="h-96 bg-gray-50 flex items-center justify-center"
        >
          <div className="text-center text-[#60646C]">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>TimelineJS integration placeholder</p>
            <p className="text-sm mt-1">
              {filteredEvents.length} events ready to display
            </p>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#0B0B0F]">Recent Events</h3>
        {filteredEvents.length > 0 ? (
          <div className="space-y-3">
            {filteredEvents.slice(0, 10).map(event => (
              <div key={event.id} className="rounded-xl border border-[#E6E8EC] bg-white p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-4">
                  {/* Media Thumbnail */}
                  {event.media && (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {getMediaIcon(event.media.type)}
                    </div>
                  )}
                  
                  {/* Event Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-[#0B0B0F] line-clamp-1">
                        {event.title}
                      </h4>
                      <span className="text-sm text-[#60646C] flex-shrink-0">
                        {formatDate(event.dateStart)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-[#60646C] mt-1 line-clamp-2">
                      {event.summary}
                    </p>
                    
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {event.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {event.tags.length > 3 && (
                        <span className="text-xs text-[#60646C]">
                          +{event.tags.length - 3} more
                        </span>
                      )}
                    </div>
                    
                    {/* Sources */}
                    {event.sources.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <ExternalLink className="w-3 h-3 text-[#60646C]" />
                        <span className="text-xs text-[#60646C]">
                          {event.sources.length} source{event.sources.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[#60646C]">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No events found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}