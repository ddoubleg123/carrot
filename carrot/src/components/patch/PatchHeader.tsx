'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, MessageSquare, Calendar, BookOpen, Share2, Zap, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Patch {
  id: string;
  handle: string;
  name: string;
  description?: string | null;
  tags: string[];
  _count: {
    members: number;
    posts: number;
    events: number;
    sources: number;
  };
  updatedAt: string;
}

interface UserPatchTheme {
  mode: 'preset' | 'image';
  preset?: 'light' | 'warm' | 'stone' | 'civic' | 'ink';
  imageUrl?: string;
}

interface PatchHeaderProps {
  patch: Patch;
  isMember?: boolean;
  userTheme?: UserPatchTheme | null;
  onThemeChange?: (theme: UserPatchTheme) => void;
}

const themes = {
  light: "bg-[linear-gradient(180deg,#0A5AFF,rgba(10,90,255,0.20))]",
  warm:  "bg-[linear-gradient(180deg,#FF6A00,rgba(255,106,0,0.22))]",
  stone: "bg-[linear-gradient(180deg,#0B0B0F,#1A1D22)]",
  civic: "bg-[linear-gradient(180deg,#0A5AFF,#0B0B0F)]",
  ink:   "bg-[#0B0B0F]"
};

export default function PatchHeader({ 
  patch, 
  isMember = false,
  userTheme,
  onThemeChange
}: PatchHeaderProps) {
  const router = useRouter();
  const [currentTheme, setCurrentTheme] = useState<UserPatchTheme>(
    userTheme || { mode: 'preset', preset: 'light' }
  );

  const handleJoin = () => {
    // Optimistic join with toast
    console.log('Join clicked');
    // TODO: Implement optimistic join functionality
  };

  const handleShare = () => {
    // Open share sheet
    console.log('Share clicked');
    // TODO: Implement share functionality
  };

  const handleSettings = () => {
    // Open settings
    console.log('Settings clicked');
    // TODO: Implement settings functionality
  };

  const handleThemeChange = (newTheme: UserPatchTheme) => {
    setCurrentTheme(newTheme);
    onThemeChange?.(newTheme);
    // Save to API
    // TODO: Implement API call to save theme
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      const newTheme: UserPatchTheme = { mode: 'image', imageUrl };
      handleThemeChange(newTheme);
    }
  };

  const getBackgroundStyle = () => {
    if (currentTheme.mode === 'image' && currentTheme.imageUrl) {
      return {
        backgroundImage: `url(${currentTheme.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      } as React.CSSProperties;
    }
    return {} as React.CSSProperties;
  };

  const getBackgroundClass = () => {
    if (currentTheme.mode === 'image') {
      return "bg-center bg-cover after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.55))]";
    }
    return themes[currentTheme.preset || 'light'];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div 
      className={`relative z-30 px-6 md:px-10 py-8 md:py-10 text-white ${getBackgroundClass()}`}
      style={getBackgroundStyle()}
    >
      <div className="max-w-[1280px] mx-auto">
        {/* Back Button */}
        <Link 
          href="/patch"
          className="absolute left-6 top-6 md:left-8 md:top-8 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        {/* Main Content */}
        <div className="pt-16 pl-4">
          {/* Title Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl font-bold text-white truncate">
                {patch.name}
              </h1>
              {patch.description && (
                <p className="text-white/95 text-base md:text-lg line-clamp-1 mt-1">
                  {patch.description}
                </p>
              )}
            </div>
            
            {/* Right side: Actions */}
            <div className="flex items-center gap-3">
              <Button
                onClick={isMember ? () => {} : handleJoin}
                variant={isMember ? "outline" : "secondary"}
                className={isMember 
                  ? "border-white/30 text-white hover:bg-white/10 bg-transparent px-4 py-2" 
                  : "bg-white text-[#FF6A00] hover:bg-white/90 px-4 py-2"
                }
              >
                {isMember ? 'Joined' : 'Join'}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="text-white hover:bg-white/10 p-2"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSettings}
                className="text-white hover:bg-white/10 p-2"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </Button>

              {/* Lightning Theme Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const presets = ['light', 'warm', 'stone', 'civic', 'ink'] as const;
                  const currentIndex = presets.indexOf(currentTheme.preset || 'light');
                  const nextIndex = (currentIndex + 1) % presets.length;
                  handleThemeChange({ mode: 'preset', preset: presets[nextIndex] });
                }}
                className="text-white hover:bg-white/10 p-2"
                title="Change theme"
              >
                <Zap className="w-4 h-4" />
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
            <div className="text-white/80">
              Updated {formatDate(patch.updatedAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}