'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Users, MessageSquare, Calendar, BookOpen } from 'lucide-react';

interface Patch {
  id: string;
  name: string;
  tagline?: string | null;
  tags: string[];
  _count: {
    members: number;
    posts: number;
    events: number;
    sources: number;
  };
}

interface PatchHeaderProps {
  patch: Patch;
  isMember?: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
}

export default function PatchHeader({ patch, isMember = false, onJoin, onLeave }: PatchHeaderProps) {
  return (
    <div className="h-20 flex items-center justify-between px-6">
      {/* Left side: Name, tagline, tags */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-[#0B0B0F] truncate">
            {patch.name}
          </h1>
          {patch.tagline && (
            <span className="text-[#60646C] text-sm line-clamp-1 hidden sm:block">
              {patch.tagline}
            </span>
          )}
        </div>
        
        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          {patch.tags.slice(0, 4).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700"
            >
              {tag}
            </Badge>
          ))}
          {patch.tags.length > 4 && (
            <span className="text-xs text-[#60646C]">
              +{patch.tags.length - 4} more
            </span>
          )}
        </div>
      </div>

      {/* Right side: Join/Leave button and menu */}
      <div className="flex items-center gap-3">
        <Button
          onClick={isMember ? onLeave : onJoin}
          variant={isMember ? "outline" : "primary"}
          className={isMember 
            ? "border-[#E6E8EC] text-[#60646C] hover:bg-gray-50" 
            : "bg-[#0A5AFF] hover:bg-[#0A5AFF]/90 text-white"
          }
        >
          {isMember ? 'Leave' : 'Join'}
        </Button>
        
        <Button variant="ghost" size="sm" className="p-2">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Metric bar component for below header
export function MetricBar({ patch }: { patch: Patch }) {
  const metrics = [
    { label: 'Members', value: patch._count.members, icon: Users },
    { label: 'Posts', value: patch._count.posts, icon: MessageSquare },
    { label: 'Events', value: patch._count.events, icon: Calendar },
    { label: 'Sources', value: patch._count.sources, icon: BookOpen },
  ];

  return (
    <div className="px-6 py-3 border-b border-[#E6E8EC] bg-white/50">
      <div className="flex items-center gap-6">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-[#60646C]" />
            <span className="text-sm text-[#60646C]">
              {value.toLocaleString()} {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}