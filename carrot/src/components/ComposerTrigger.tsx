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
      <div className="relative mb-4">
        <div
          className="relative bg-white rounded-[18px] border border-[#E6E8EC] px-4 py-3.5 cursor-pointer"
          onClick={onOpenModal}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-[#FF6A00] rounded-full flex items-center justify-center text-white font-semibold">
                U
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[#8A8F98] text-[17px]">
                What's happening?
              </div>
            </div>
            <button className="h-[38px] px-4 bg-[#FF6A00] text-white font-bold rounded-full">
              Create post
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
    <div className="relative mb-4">
      <div
        className="relative bg-white rounded-[18px] border border-[#E6E8EC] px-4 py-3.5 cursor-pointer"
        onClick={onOpenModal}
      >
        <div className="flex items-center gap-3">
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
              <div className="w-10 h-10 bg-[#FF6A00] rounded-full flex items-center justify-center text-white font-semibold">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1 text-left">
            <div className="text-[#8A8F98] text-[17px]">
              What's happening?
            </div>
          </div>
          <button
            className="h-[38px] px-4 bg-[#FF6A00] text-white font-bold rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal();
            }}
          >
            Create post
          </button>
        </div>
      </div>
    </div>
  );
}

