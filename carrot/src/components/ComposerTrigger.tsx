'use client';

// Temporarily disable for testing gradient changes
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { useState, useEffect } from 'react';

interface ComposerTriggerProps {
  onOpenModal: () => void;
}

export default function ComposerTrigger({ onOpenModal }: ComposerTriggerProps) {
  // Temporarily disable useSession for testing gradient changes
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="relative -mx-6 px-[1px] mb-6">
        <div
          className="relative bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={onOpenModal}
        >
          <div className="flex items-center gap-3">
            {/* Placeholder avatar during hydration */}
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-semibold">
                U
              </div>
            </div>
            <div className="flex-1">
              <div className="text-gray-500 text-lg">
                What's happening?
              </div>
            </div>
            <button className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-full shadow-sm relative overflow-hidden">
              <span className="relative z-10">Create post</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-200/75 via-white/25 to-transparent animate-wave"></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const avatarUrl = (session?.user as any)?.profilePhoto || (session?.user as any)?.image || '';
  const userNameOrEmail = (session?.user as any)?.username || (session?.user as any)?.name || (session?.user as any)?.email || '';
  const initials = userNameOrEmail
    ? userNameOrEmail
        .split(/[\s@._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s: string) => s[0]?.toUpperCase() || '')
        .join('') || 'U'
    : 'U';

  return (
    <div className="relative -mx-6 px-[1px] mb-6">
      <div
        className="relative bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={onOpenModal}
      >
        <div className="flex items-center gap-3">
          {/* User Avatar */}
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Your avatar"
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-semibold">
                {initials}
              </div>
            )}
          </div>
          
          {/* Placeholder Text */}
          <div className="flex-1">
            <div className="text-gray-500 text-lg">
              What's happening?
            </div>
          </div>
          
          {/* Create Post Button */}
          <button
            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-full shadow-sm relative overflow-hidden"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal();
            }}
          >
            <span className="relative z-10">Create post</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-200/75 via-white/25 to-transparent animate-wave"></div>
          </button>
        </div>
      </div>
    </div>
  );
}

