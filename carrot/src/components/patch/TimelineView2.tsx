'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, ExternalLink, FileText, Image, Video, File } from 'lucide-react';

interface EventItem {
  id: string;
  title: string;
  dateStart: string;
  dateEnd?: string;
  summary: string;
  media?: { type: 'image' | 'video' | 'pdf'; url: string; alt?: string };
  tags: string[];
  sources: { id: string; title: string; url: string; author?: string }[];
}

interface TimelineViewProps {
  events: EventItem[];
  patchId: string;
}

interface TimelineJSData {
  events: {
    start_date: { year: number; month?: number; day?: number };
    end_date?: { year: number; month?: number; day?: number };
    text: { headline: string; text: string };
    media?: { url: string; caption?: string; credit?: string };
    group?: string;
  }[];
}

export default function TimelineView2({ events, patchId }: TimelineViewProps) {
  const [filteredEvents, setFilteredEvents] = useState<EventItem[]>(events);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const allTags = Array.from(new Set(events.flatMap(e => e.tags)));

  // Apply filters
  useEffect(() => {
    let filtered = events;
    if (selectedTags.length) {
      filtered = filtered.filter(e => e.tags.some(t => selectedTags.includes(t)));
    }
    if (dateRange.from) {
      filtered = filtered.filter(e => new Date(e.dateStart) >= new Date(dateRange.from));
    }
    if (dateRange.to) {
      filtered = filtered.filter(e => new Date(e.dateStart) <= new Date(dateRange.to));
    }
    setFilteredEvents(filtered);
  }, [events, selectedTags, dateRange]);

  // Convert to TimelineJS format
  const toTimelineData = (items: EventItem[]): TimelineJSData => ({
    events: items.map(e => ({
      start_date: {
        year: new Date(e.dateStart).getFullYear(),
        month: new Date(e.dateStart).getMonth() + 1,
        day: new Date(e.dateStart).getDate(),
      },
      end_date: e.dateEnd
        ? {
            year: new Date(e.dateEnd).getFullYear(),
            month: new Date(e.dateEnd).getMonth() + 1,
            day: new Date(e.dateEnd).getDate(),
          }
        : undefined,
      text: { headline: e.title, text: e.summary },
      media: e.media ? { url: e.media.url, caption: e.media.alt || '', credit: e.sources[0]?.author || '' } : undefined,
      group: e.tags[0] || 'General',
    })),
  });

  // Load and init TimelineJS (CDN)
  useEffect(() => {
    let cancelled = false;
    const mount = async () => {
      if (!timelineRef.current || filteredEvents.length === 0) return;
      const w = window as any;
      const ensureAssets = async () => {
        if (w.TL) return true;
        if (!document.getElementById('timelinejs-3-css')) {
          const link = document.createElement('link');
          link.id = 'timelinejs-3-css';
          link.rel = 'stylesheet';
          link.href = 'https://cdn.knightlab.com/libs/timeline3/latest/css/timeline.css';
          document.head.appendChild(link);
        }
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.knightlab.com/libs/timeline3/latest/js/timeline.js';
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load TimelineJS'));
          document.body.appendChild(s);
        });
        return !!(window as any).TL;
      };

      const ok = await ensureAssets();
      if (!ok || cancelled) return;
      const TL = (window as any).TL;
      const data = toTimelineData(filteredEvents);
      timelineRef.current.innerHTML = '';
      new TL.Timeline(
        timelineRef.current,
        { title: { text: { headline: 'Timeline' } }, events: data.events },
        { start_at_end: false, timenav_position: 'bottom', hash_bookmark: false, scale_factor: 1 }
      );
    };
    mount();
    return () => {
      cancelled = true;
    };
  }, [filteredEvents]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setDateRange({ from: '', to: '' });
  };

  const getMediaIcon = (type?: string) => {
    switch (type) {
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'pdf':
        return <FileText className="w-4 h-4" />;
      default:
        return <File className="w-4 h-4" />;
    }
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#0B0B0F] flex items-center gap-2">
            <Filter className="w-5 h-5" /> Timeline Filters
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
        {showFilters && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#0B0B0F] mb-2 block">From Date</label>
                <Input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#0B0B0F] mb-2 block">To Date</label>
                <Input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#0B0B0F] mb-2 block">Filter by Tags</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className={`cursor-pointer transition-colors ${selectedTags.includes(tag) ? 'bg-[#FF6A00] text-white' : 'hover:bg-gray-100'}`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
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
            <Calendar className="w-5 h-5" /> Timeline
          </h3>
          <p className="text-sm text-[#60646C] mt-1">{filteredEvents.length} events found</p>
        </div>
        <div ref={timelineRef} className="h-[520px] bg-gray-50" />
      </div>

      {/* Events List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#0B0B0F]">Recent Events</h3>
        {filteredEvents.length > 0 ? (
          <div className="space-y-3">
            {filteredEvents.slice(0, 10).map(e => (
              <div key={e.id} className="rounded-xl border border-[#E6E8EC] bg-white p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-4">
                  {e.media && <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">{getMediaIcon(e.media.type)}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-[#0B0B0F] line-clamp-1">{e.title}</h4>
                      <span className="text-sm text-[#60646C] flex-shrink-0">{formatDate(e.dateStart)}</span>
                    </div>
                    <p className="text-sm text-[#60646C] mt-1 line-clamp-2">{e.summary}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {e.tags.slice(0, 3).map(t => (
                        <Badge key={t} variant="outline" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                      {e.tags.length > 3 && <span className="text-xs text-[#60646C]">+{e.tags.length - 3} more</span>}
                    </div>
                    {e.sources.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <ExternalLink className="w-3 h-3 text-[#60646C]" />
                        <span className="text-xs text-[#60646C]">{e.sources.length} source{e.sources.length > 1 ? 's' : ''}</span>
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
