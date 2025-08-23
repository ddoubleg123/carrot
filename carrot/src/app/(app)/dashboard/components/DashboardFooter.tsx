"use client";
import { useSession } from "next-auth/react";
import { useState } from 'react';
import { logoutClient } from "@/lib/logoutClient";

import type { Session } from 'next-auth';

type ExtendedUser = Session['user'] & {
  firstName?: string;
  lastName?: string;
  username?: string;
  isOnboarded?: boolean;
};

export default function DashboardFooter() {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser;
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!user) return null;

  return (
    <footer className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 py-3 px-4 flex items-center justify-between z-50 shadow-lg">
      <div className="flex items-center gap-3">
        <img
          src={user.image || "/avatar-placeholder.svg"}
          alt={user.name || user.username || "User"}
          className="h-10 w-10 rounded-full object-cover border border-gray-300"
        />
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900 text-sm">
            {user.name || user.firstName || ""} {user.lastName || ""}
          </span>
          {user.username && (
            <span className="text-xs text-gray-500">@{user.username}</span>
          )}
        </div>
      </div>
      <button
        onClick={async () => {
          if (isSigningOut) return;
          setIsSigningOut(true);
          try { await logoutClient(); } catch { window.location.href = '/login'; } finally { /* keep disabled until redirect */ }
        }}
        disabled={isSigningOut}
        className={`px-4 py-2 rounded-md font-semibold text-sm transition ${isSigningOut ? 'bg-orange-300 text-white cursor-not-allowed' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
      >
        {isSigningOut ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            Signing out…
          </span>
        ) : (
          'Log out'
        )}
      </button>
    </footer>
  );
}
