'use client';

import { cardVariants, sectionHeading } from '@/styles/cards';
import { Badge } from '@/components/ui/badge';
import { Calendar, ExternalLink, MessageSquare, Clock } from 'lucide-react';

interface Fact {
  id: string;
  label: string;
  value: string;
  source?: {
    id: string;
    title: string;
    url: string;
  } | null;
}

interface Event {
  id: string;
  title: string;
  dateStart: Date;
  summary: string;
  tags: string[];
}

interface Source {
  id: string;
  title: string;
  url: string;
  author?: string | null;
  publisher?: string | null;
}

interface Post {
  id: string;
  title?: string | null;
  body?: string | null;
  author: {
    name?: string | null;
    username?: string | null;
  };
  createdAt: Date;
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

interface OverviewProps {
  patch: Patch;
}

export default function Overview({ patch }: OverviewProps) {
  // Mock data for now - in real implementation, this would come from props or API
  const facts: Fact[] = [
    { id: '1', label: 'Current Status', value: 'Active Movement' },
    { id: '2', label: 'Primary Goal', value: 'Congressional Term Limits' },
    { id: '3', label: 'Proposed Limit', value: '12 Years Maximum' },
    { id: '4', label: 'Support Level', value: '78% Public Support' },
  ];

  const recentEvents: Event[] = [
    { id: '1', title: 'New research paper added', dateStart: new Date(), summary: '"Term Limits and Congressional Effectiveness" by Dr. Sarah Chen', tags: ['research'] },
    { id: '2', title: 'New discussion started', dateStart: new Date(), summary: '"What would be the ideal term limit structure?"', tags: ['discussion'] },
  ];

  const recentSources: Source[] = [
    { id: '1', title: 'Congressional Research Service Report', url: 'https://crsreports.congress.gov/', author: 'CRS' },
    { id: '2', title: 'Public Opinion Poll Results', url: 'https://news.gallup.com/', author: 'Gallup' },
  ];

  const recentPosts: Post[] = [
    { id: '1', title: 'New research paper added', body: '"Term Limits and Congressional Effectiveness" by Dr. Sarah Chen', createdAt: new Date(), author: { name: 'Dr. Sarah Chen' } },
    { id: '2', title: 'New discussion started', body: '"What would be the ideal term limit structure?"', createdAt: new Date(), author: { name: 'John Doe' } },
  ];
  return (
    <div className="space-y-8 py-4">
      {/* Key Facts Grid */}
      <div>
        <h2 className={sectionHeading}>Key Facts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {facts.slice(0, 8).map((fact) => (
            <div key={fact.id} className={cardVariants.compact}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium text-[#0B0B0F]">
                  {fact.label}
                </h3>
                {fact.source && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0.5 rounded cursor-pointer hover:bg-gray-200"
                    title={`Source: ${fact.source.title}`}
                  >
                    📄
                  </Badge>
                )}
              </div>
              <p className="text-sm text-[#60646C] leading-relaxed">
                {fact.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className={sectionHeading}>Recent Activity</h2>
        <div className="space-y-4">
          {/* Recent Events */}
          {recentEvents.slice(0, 3).map((event) => (
            <div key={event.id} className={cardVariants.compact}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#0A5AFF]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-[#0A5AFF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-[#0B0B0F] mb-1">
                    {event.title}
                  </h3>
                  <p className="text-sm text-[#60646C] line-clamp-2 mb-2">
                    {event.summary}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#60646C]">
                      {event.dateStart.toLocaleDateString()}
                    </span>
                    {event.tags.slice(0, 2).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Recent Sources */}
          {recentSources.slice(0, 2).map((source) => (
            <div key={source.id} className={cardVariants.compact}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <ExternalLink className="w-4 h-4 text-[#60646C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-[#0B0B0F] mb-1">
                    {source.title}
                  </h3>
                  <p className="text-xs text-[#60646C] mb-2">
                    {source.author && `${source.author} • `}
                    {(() => {
                      try {
                        return new URL(source.url).hostname;
                      } catch {
                        return source.url || 'Unknown source';
                      }
                    })()}
                  </p>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#0A5AFF] hover:underline"
                  >
                    View source →
                  </a>
                </div>
              </div>
            </div>
          ))}

          {/* Recent Posts */}
          {recentPosts.slice(0, 2).map((post) => (
            <div key={post.id} className={cardVariants.compact}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[#0B0B0F]">
                      {post.author.name || post.author.username || 'Anonymous User'}
                    </span>
                    <span className="text-xs text-[#60646C]">
                      {post.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-[#0B0B0F] mb-1">
                    {post.title || 'Post'}
                  </h3>
                  {post.body && (
                    <p className="text-sm text-[#60646C] line-clamp-2">
                      {post.body}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
