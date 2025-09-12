"use client";
import React from "react";

export type Comment = {
  id: string;
  user: { id: string; username?: string | null; avatar?: string | null };
  text: string;
  createdAt: string;
};

export default function CommentItem({ c }: { c: Comment }) {
  return (
    <div className="flex gap-3 py-2">
      <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.user.avatar || "/avatar-placeholder.svg"} alt="avatar" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-900 font-medium truncate">{c.user.username ? (c.user.username.startsWith('@') ? c.user.username : `@${c.user.username}`) : '@user'}</div>
        <div className="text-[13px] text-gray-800 whitespace-pre-wrap break-words">{c.text}</div>
        <div className="text-[11px] text-gray-500 mt-1">{new Date(c.createdAt).toLocaleString()}</div>
      </div>
    </div>
  );
}
