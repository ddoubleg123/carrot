"use client";
import { useSession, signOut } from "next-auth/react";

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
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="px-4 py-2 rounded-md bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition"
      >
        Log out
      </button>
    </footer>
  );
}
