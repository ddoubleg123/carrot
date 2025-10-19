'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, MessageSquare, Calendar, BookOpen, Share2, Zap, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import COLOR_SCHEMES, { type ColorScheme } from '@/config/colorSchemes';

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
  preset?: number; // Index into COLOR_SCHEMES array
  imageUrl?: string;
}

interface PatchHeaderProps {
  patch: Patch;
  isMember?: boolean;
  userTheme?: UserPatchTheme | null;
  onThemeChange?: (theme: UserPatchTheme) => void;
}

// Default theme index (Sunset Pop)
const DEFAULT_THEME_INDEX = 0;

export default function PatchHeader({ 
  patch, 
  isMember = false,
  userTheme,
  onThemeChange
}: PatchHeaderProps) {
  const router = useRouter();
  const [currentTheme, setCurrentTheme] = useState<UserPatchTheme>(
    userTheme || { mode: 'preset', preset: DEFAULT_THEME_INDEX }
  );

  const handleJoin = () => {
    // Optimistic join with toast
    console.log('Join clicked');
    // TODO: Implement optimistic join functionality
  };

  const handleLeave = () => {
    // Optimistic leave with toast
    console.log('Leave clicked');
    // TODO: Implement optimistic leave functionality
  };

  

  const handleSettings = () => {
    // Open settings modal with delete option (simple confirm for now)
    if (confirm(`Are you sure you want to delete the "${patch.name}" patch? This action cannot be undone.`)) {
      (async () => {
        try {
          console.log('[PatchHeader] Attempting to delete patch:', patch.handle);
          const res = await fetch(`/api/patches/${patch.handle}`, { method: 'DELETE' });
          const data = await res.json().catch(() => ({}));
          
          console.log('[PatchHeader] Delete response:', { status: res.status, data });
          
          if (!res.ok || !data?.success) {
            console.error('[PatchHeader] Delete failed:', { status: res.status, error: data?.error });
            alert(`Delete failed: ${data?.error || res.status}`);
            return;
          }
          
          console.log('[PatchHeader] Delete successful, redirecting to /patch');
          // Redirect back to patch list page after deletion
          router.push('/patch');
        } catch (e) {
          console.error('[PatchHeader] Delete error', e);
          alert('Delete failed');
        }
      })();
    }
  };

  const handleThemeChange = (newTheme: UserPatchTheme) => {
    setCurrentTheme(newTheme);
    onThemeChange?.(newTheme);
    // TODO: Persist via API if needed
  };

  const handleShare = () => {
    // Open share sheet
    console.log('Share clicked');
    // TODO: Implement share functionality
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
    
    // Use composer color schemes
    const schemeIndex = currentTheme.preset ?? DEFAULT_THEME_INDEX;
    const scheme = COLOR_SCHEMES[schemeIndex] || COLOR_SCHEMES[DEFAULT_THEME_INDEX];
    
    return {
      background: `linear-gradient(180deg, ${scheme.gradientFromColor}, ${scheme.gradientViaColor || scheme.gradientFromColor}, ${scheme.gradientToColor})`
    } as React.CSSProperties;
  };

  const getBackgroundClass = () => {
    if (currentTheme.mode === 'image') {
      return "bg-center bg-cover after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.55))]";
    }
    return ""; // Background handled by inline style
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
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex-1 min-w-0 max-w-2xl">
              <h1 className="text-3xl md:text-4xl font-bold text-white truncate">
                {patch.name}
              </h1>
              {patch.description && (
                <p className="text-white/95 text-base md:text-lg line-clamp-2 mt-2 pr-4">
                  {patch.description}
                </p>
              )}
              
              {/* Topic Chips - Fixed duplicates v2 */}
              {patch.tags && patch.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {[...new Set(patch.tags)].map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="bg-white/20 text-white border-white/30 hover:bg-white/30 transition-colors"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            {/* Right side: Actions - CONSISTENT WIDTH BUTTONS */}
            <div className="flex flex-col gap-2 flex-shrink-0 items-start">
        <Button
          onClick={isMember ? handleLeave : handleJoin}
          variant="ghost"
          className="text-white hover:bg-white/10 px-4 py-2 flex items-center gap-3 w-24 justify-center"
        >
          <Users className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">{isMember ? 'Leave Group' : 'Join Group'}</span>
        </Button>
        
        <Button
          variant="ghost"
          onClick={handleShare}
          className="text-white hover:bg-white/10 px-4 py-2 flex items-center gap-3 w-24 justify-center"
        >
          <Share2 className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">Share</span>
        </Button>

        <Button
          variant="ghost"
          onClick={handleSettings}
          className="text-white hover:bg-white/10 px-4 py-2 flex items-center gap-3 w-24 justify-center"
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">Settings</span>
        </Button>

        {/* Lightning Theme Button */}
        <Button
          variant="ghost"
          onClick={() => {
            const currentIndex = currentTheme.preset ?? DEFAULT_THEME_INDEX;
            const nextIndex = (currentIndex + 1) % COLOR_SCHEMES.length;
            handleThemeChange({ mode: 'preset', preset: nextIndex });
          }}
          className="text-white hover:bg-white/10 px-4 py-2 flex items-center gap-3 w-24 justify-center"
          title={`Current: ${COLOR_SCHEMES[currentTheme.preset ?? DEFAULT_THEME_INDEX]?.name || 'Sunset Pop'}`}
        >
          <Zap className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">Theme</span>
        </Button>
            </div>
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