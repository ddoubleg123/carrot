'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, MessageSquare, Calendar, BookOpen, Share2, Zap, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import COLOR_SCHEMES, { type ColorScheme } from '@/config/colorSchemes';

interface Patch {
  id: string;
  handle: string;
  title: string;
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
  isOwner?: boolean;
  cover?: string;
  userTheme?: UserPatchTheme | null;
  onThemeChange?: (theme: UserPatchTheme) => void;
}

// Default theme index (Sunset Pop)
const DEFAULT_THEME_INDEX = 0;

export default function PatchHeader({ 
  patch, 
  isMember = false,
  isOwner = false,
  cover = '',
  userTheme,
  onThemeChange
}: PatchHeaderProps) {
  const router = useRouter();
  const [member, setMember] = useState(isMember || isOwner);
  const [memberCount, setMemberCount] = useState(patch._count.members);
  const [membershipError, setMembershipError] = useState('');
  const membershipBusy = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groupCover, setGroupCover] = useState(cover);
  const [coverError, setCoverError] = useState('');
  const [coverBusy, setCoverBusy] = useState(false);
  const [copied, setCopied] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<UserPatchTheme>(
    userTheme || { mode: 'preset', preset: DEFAULT_THEME_INDEX }
  );

  useEffect(() => {
    setMember(isMember || isOwner);
  }, [isMember, isOwner]);

  useEffect(() => {
    setGroupCover(cover);
  }, [cover]);

  const handleJoin = () => {
    if (membershipBusy.current) return
    membershipBusy.current = true
    setMembershipError('')
    setMember(true)
    setMemberCount((count) => count + 1)
    void fetch(`/api/patches/${patch.handle}/members`, { method: 'POST' })
      .then(async (response) => {
        if (response.ok) return
        const data = await response.json().catch(() => null)
        setMember(isOwner)
        setMemberCount((count) => Math.max(0, count - 1))
        setMembershipError(data?.error || 'Could not join this group.')
      })
      .catch(() => {
        setMember(isOwner)
        setMemberCount((count) => Math.max(0, count - 1))
        setMembershipError('Could not join this group.')
      })
      .finally(() => {
        membershipBusy.current = false
      })
  }

  const handleLeave = () => {
    setMembershipError('')
    if (isOwner) {
      setMembershipError('You started this group, so you stay in it. Delete it from Settings to close it.')
      return
    }
    if (membershipBusy.current) return
    membershipBusy.current = true
    setMember(false)
    setMemberCount((count) => Math.max(0, count - 1))
    void fetch(`/api/patches/${patch.handle}/members`, { method: 'DELETE' })
      .then(async (response) => {
        if (response.ok) return
        const data = await response.json().catch(() => null)
        setMember(true)
        setMemberCount((count) => count + 1)
        setMembershipError(data?.error || 'Could not leave this group.')
      })
      .catch(() => {
        setMember(true)
        setMemberCount((count) => count + 1)
        setMembershipError('Could not leave this group.')
      })
      .finally(() => {
        membershipBusy.current = false
      })
  }

  

  const handleCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCoverBusy(true);
    setCoverError('');
    const body = new FormData();
    body.set('image', file);
    const response = await fetch(`/api/patches/${patch.handle}/cover`, { method: 'POST', body });
    const data = await response.json().catch(() => null);
    setCoverBusy(false);
    if (!response.ok || !data?.cover) {
      setCoverError(data?.error || 'That photo could not be saved.');
      return;
    }
    setGroupCover(`${data.cover}?v=${Date.now()}`);
  };

  const handleSettings = () => {
    setSettingsOpen(true);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete the "${patch.title}" patch? This action cannot be undone.`)) {
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
    fetch(`/api/patch/${patch.handle}/theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: newTheme.mode,
        preset: newTheme.preset !== undefined ? String(newTheme.preset) : undefined,
        imageUrl: newTheme.imageUrl
      })
    }).catch(() => null)
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/patch/${patch.handle}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
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
    <div className="border-b border-[#E6E8EC] bg-white text-[#0B0B0F]">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3 px-5 py-4">
        <Link href="/patch" className="shrink-0 text-sm font-semibold text-[#60646C]">← Groups</Link>
        <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">{patch.title}</span>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={member ? handleLeave : handleJoin} className={`h-9 rounded-full px-3.5 text-sm font-semibold ${member ? 'bg-[#0B0B0F] text-white' : 'border border-[#E6E8EC] bg-white'}`}>
            {member ? 'Leave group' : 'Join group'}
          </button>
          <button type="button" onClick={handleShare} className="h-9 rounded-full bg-[#FF6A00] px-3.5 text-sm font-semibold text-white">
            {copied ? 'Link copied' : 'Share'}
          </button>
          {isOwner && (
            <button type="button" onClick={handleSettings} className="h-9 rounded-full border border-[#E6E8EC] px-3.5 text-sm font-semibold">Settings</button>
          )}
        </div>
      </div>
      {membershipError && <p className="mx-auto max-w-[1120px] px-5 pb-3 text-sm text-red-600">{membershipError}</p>}
      {settingsOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={() => setSettingsOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-[#0B0B0F]" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold">Group settings</h2>
            <p className="mt-1 text-sm text-[#60646C]">This picture is the main image on the group card.</p>
            <div className="mt-4 h-40 overflow-hidden rounded-xl bg-[#141414]">
              {groupCover ? <img src={groupCover} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <label className="mt-4 flex h-11 cursor-pointer items-center justify-center rounded-full bg-[#0B0B0F] text-sm font-semibold text-white">
              {coverBusy ? 'Saving…' : 'Choose a new photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleCover} />
            </label>
            {coverError && <p className="mt-2 text-sm text-red-600">{coverError}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={handleDelete} className="h-10 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-700">Delete group</button>
              <button type="button" onClick={() => setSettingsOpen(false)} className="ml-auto h-10 rounded-full border border-[#E6E8EC] px-4 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}