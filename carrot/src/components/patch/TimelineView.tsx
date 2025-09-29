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
  const timelineRef = useRef<HTMLDivElement>(null);

  // Get all unique tags from events
  const allTags = Array.from(new Set(events.flatMap(event => event.tags)));

  // Load and initialize TimelineJS from CDN
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!timelineRef.current || filteredEvents.length === 0) return;
      const w = window as any;
      const ensureAssets = async () => {
        if (w.TL) return true;
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
        { title: { text: { headline: 'Timeline' } }, events: data.events },
        { start_at_end: false, timenav_position: 'bottom', hash_bookmark: false, scale_factor: 1 }
      );
    };
    init();
    return () => { cancelled = true; };
  }, [filteredEvents]);
.tags.some(tag => selectedTags.includes(tag))
      );
    }

    // Filter by date range
    if (dateRange.from) {
{{ ... }}
                        <span className="text-xs text-[#60646C]">
                          {event.sources.length} source{event.sources.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  {/* TimelineJS mounts here */}
        <div ref={timelineRef} className="h-[520px] bg-gray-50" />