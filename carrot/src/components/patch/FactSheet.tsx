'use client';

import { cardVariants, sectionHeading } from '@/styles/cards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Users, Star, Clock } from 'lucide-react';

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

interface Patch {
  id: string;
  name: string;
  _count: {
    members: number;
    posts: number;
    events: number;
    sources: number;
  };
}

interface FactSheetProps {
  patch: Patch;
  facts: Fact[];
  topContributors?: Array<{
    id: string;
    name: string | null;
    username: string | null;
    contributions: number;
  }>;
}

export default function FactSheet({ patch, facts, topContributors = [] }: FactSheetProps) {
  return (
    <div className="space-y-6">
      {/* Key Facts */}
      <div className={cardVariants.sidebar}>
        <h3 className={sectionHeading}>Key Facts</h3>
        <div className="space-y-4">
          {facts.slice(0, 6).map((fact) => (
            <div key={fact.id} className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-[#0B0B0F]">
                  {fact.label}
                </span>
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

      {/* Quick Actions */}
      <div className={cardVariants.sidebar}>
        <h3 className={sectionHeading}>Quick Actions</h3>
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-sm"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Add Source
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-sm"
          >
            <Clock className="w-4 h-4 mr-2" />
            Add Event
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-sm"
          >
            <Star className="w-4 h-4 mr-2" />
            Add Fact
          </Button>
        </div>
      </div>

      {/* Top Contributors */}
      {topContributors.length > 0 && (
        <div className={cardVariants.sidebar}>
          <h3 className={sectionHeading}>Top Contributors</h3>
          <div className="space-y-3">
            {topContributors.slice(0, 5).map((contributor) => (
              <div key={contributor.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">
                      {(contributor.name || 'A').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0B0B0F]">
                      {contributor.name || 'Anonymous User'}
                    </p>
                    <p className="text-xs text-[#60646C]">
                      @{contributor.username || 'anonymous'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-[#60646C]">
                  {contributor.contributions}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patch Stats */}
      <div className={cardVariants.sidebar}>
        <h3 className={sectionHeading}>Community</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#60646C]" />
              <span className="text-sm text-[#0B0B0F]">Members</span>
            </div>
            <span className="text-sm font-medium text-[#0B0B0F]">
              {patch._count.members.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#60646C]" />
              <span className="text-sm text-[#0B0B0F]">Events</span>
            </div>
            <span className="text-sm font-medium text-[#0B0B0F]">
              {patch._count.events.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}