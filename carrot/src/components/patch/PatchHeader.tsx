'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Users, MessageSquare, Calendar, BookOpen, Share2, Zap } from 'lucide-react';
import { useState } from 'react';

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

interface PatchHeaderProps {
  patch: Patch;
  isMember?: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
  onShare?: () => void;
  onThemeChange?: (theme: 'light' | 'warm' | 'stone') => void;
}

export default function PatchHeader({ 
  patch, 
  isMember = false, 
  onJoin, 
  onLeave, 
  onShare,
  onThemeChange 
}: PatchHeaderProps) {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'warm' | 'stone'>('light');

  const handleThemeChange = () => {
    const themes: ('light' | 'warm' | 'stone')[] = ['light', 'warm', 'stone'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setCurrentTheme(nextTheme);
    onThemeChange?.(nextTheme);
  };

  return (
    <div className="relative z-30 isolation-isolate bg-[linear-gradient(180deg,#FF6A00,rgba(255,106,0,0.92))] text-white">
      <div className="px-6 md:px-10 py-6 md:py-8">
        {/* Title Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-white truncate">
              {patch.name}
            </h1>
            {patch.description && (
              <p className="text-white/90 text-lg line-clamp-1 mt-1">
                {patch.description}
              </p>
            )}
          </div>
          
          {/* Right side: Actions */}
          <div className="flex items-center gap-3">
            <Button
              onClick={isMember ? onLeave : onJoin}
              variant={isMember ? "outline" : "default"}
              className={isMember 
                ? "border-white/30 text-white hover:bg-white/10 bg-transparent" 
                : "bg-white text-[#FF6A00] hover:bg-white/90"
              }
            >
              {isMember ? 'Leave' : 'Join'}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onShare}
              className="text-white hover:bg-white/10 p-2"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleThemeChange}
              className="text-white hover:bg-white/10 p-2"
              title="Change theme"
            >
              <Zap className="w-4 h-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/10 p-2"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap mt-4">
          {patch.tags.slice(0, 4).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs px-2 py-1 rounded-full bg-white/20 text-white border-white/30"
            >
              {tag}
            </Badge>
          ))}
          {patch.tags.length > 4 && (
            <span className="text-xs text-white/70">
              +{patch.tags.length - 4} more
            </span>
          )}
        </div>

        {/* Counts Row */}
        <div className="mt-3 flex flex-wrap gap-3 text-white/90 text-sm">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{patch._count.members} members</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            <span>{patch._count.posts} posts</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{patch._count.events} events</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            <span>{patch._count.sources} sources</span>
          </div>
        </div>
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