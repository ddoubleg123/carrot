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

  const allTags = Array.from(new Set(events.flatMap(event => event.tags)));

  // Convert events to TimelineJS format
  const convertToTimelineJS = (events: Event[]): TimelineJSData => {
    return {
      events: events.map(event => {
        const startDate = new Date(event.dateStart);
        const endDate = event.dateEnd ? new Date(event.dateEnd) : undefined;
        
        return {
          start_date: {
            year: startDate.getFullYear(),
            month: startDate.getMonth() + 1,
            day: startDate.getDate()
          },
          end_date: endDate ? {
            year: endDate.getFullYear(),
            month: endDate.getMonth() + 1,
            day: endDate.getDate()
          } : undefined,
          text: {
            headline: event.title,
            text: event.summary
          },
          media: event.media ? {
            url: event.media.url,
            caption: event.media.alt || event.summary,
            credit: event.sources.map(s => s.title).join(', ') || 'Carrot Patch'
          } : undefined,
          group: event.tags[0] || 'General'
        };
      })
    };
  };

  // Apply filters
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
      const fromDate = new Date(dateRange.from);
      filtered = filtered.filter(event => new Date(event.dateStart) >= fromDate);
    }
    
    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      filtered = filtered.filter(event => new Date(event.dateStart) <= toDate);
    }
    
    setFilteredEvents(filtered);
  }, [events, selectedTags, dateRange]);

  // Load and initialize TimelineJS from CDN
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!timelineRef.current || filteredEvents.length === 0) return;
      
      const ensureAssets = async () => {
        if ((window as any).TL) return true;
        
        // CSS
        if (!document.getElementById('timelinejs-3-css')) {
          const link = document.createElement('link');
          link.id = 'timelinejs-3-css';
          link.rel = 'stylesheet';
          link.href = 'https://cdn.knightlab.com/libs/timeline3/latest/css/timeline.css';
          document.head.appendChild(link);
        }
        
        // JS
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.knightlab.com/libs/timeline3/latest/js/timeline.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load TimelineJS'));
          document.body.appendChild(script);
        });
        
        return !!(window as any).TL;
      };

      const ok = await ensureAssets();
      if (!ok || cancelled) return;
      
      const TL = (window as any).TL;
      const data = convertToTimelineJS(filteredEvents);
      
      // Clear container and mount timeline
      timelineRef.current.innerHTML = '';
      new TL.Timeline(
        timelineRef.current,
        { 
          title: { 
            text: { 
              headline: 'Timeline', 
              text: 'Explore the chronological history of events' 
            } 
          }, 
          events: data.events 
        },
        { 
          start_at_end: false, 
          timenav_position: 'bottom', 
          hash_bookmark: false, 
          scale_factor: 1,
          height: 500,
          width: '100%',
          initial_zoom: 2
        }
      );
    };
    
    init();
    return () => { cancelled = true; };
  }, [filteredEvents]);

  const toggleTag = (tag: string) => {
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

  return (
    <div className="space-y-6 py-8 px-6 md:px-10">
      {/* Filters */}
      <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#0B0B0F] flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Timeline Filters
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>

        {showFilters && (
          <div className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#60646C] mb-2">
                  From Date
                </label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#60646C] mb-2">
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
              <label className="block text-sm font-medium text-[#60646C] mb-2">
                Filter by Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear All Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* TimelineJS Container */}
      <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#0B0B0F] flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Timeline ({filteredEvents.length} events)
          </h3>
        </div>
        
        {filteredEvents.length > 0 ? (
          <div ref={timelineRef} className="h-[520px] bg-gray-50 rounded-lg" />
        ) : (
          <div className="h-[520px] bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No events found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your filters or add some events to this patch
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Event List */}
      <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6">
        <h3 className="text-lg font-semibold text-[#0B0B0F] mb-4">
          Event List ({filteredEvents.length})
        </h3>
        
        <div className="space-y-4">
          {filteredEvents.map(event => (
            <div key={event.id} className="border border-[#E6E8EC] rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-[#0B0B0F] mb-2">{event.title}</h4>
                  <p className="text-sm text-[#60646C] mb-3">{event.summary}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-[#60646C] mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(event.dateStart).toLocaleDateString()}
                    </span>
                    {event.sources.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {event.sources.length} source{event.sources.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {event.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  {event.sources.length > 0 && (
                    <div className="space-y-1">
                      {event.sources.map(source => (
                        <div key={source.id} className="flex items-center gap-2 text-xs">
                          <ExternalLink className="w-3 h-3 text-[#60646C]" />
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[#0A5AFF] hover:underline truncate"
                          >
                            {source.title}
                          </a>
                          {source.author && (
                            <span className="text-[#60646C]">by {source.author}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {event.media && (
                  <div className="ml-4 flex-shrink-0">
                    {event.media.type === 'image' && (
                      <Image className="w-6 h-6 text-[#60646C]" />
                    )}
                    {event.media.type === 'video' && (
                      <Video className="w-6 h-6 text-[#60646C]" />
                    )}
                    {event.media.type === 'pdf' && (
                      <File className="w-6 h-6 text-[#60646C]" />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}