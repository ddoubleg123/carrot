"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Link2, Mail, Share2, Copy } from "lucide-react";

export default function ShareSheet({ open, onClose, url, title = "Check out this post on Carrot" }: { open: boolean; onClose: () => void; url: string; title?: string }) {
  if (!open || typeof document === 'undefined') return null;

  const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;

  const body = (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[440px] w-full max-w-full px-4">
        <div className="rounded-2xl overflow-hidden bg-white shadow-xl border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold text-gray-900 flex items-center gap-2"><Share2 size={18} /> Share</div>
            <button className="px-2 py-1 rounded hover:bg-gray-100" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <div className="p-4 space-y-3">
            <button
              className="w-full flex items-center justify-between px-3 py-2 rounded-md border hover:bg-gray-50"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                } catch {}
                onClose();
              }}
            >
              <span className="flex items-center gap-2 text-gray-800"><Copy size={18} /> Copy link</span>
              <span className="text-xs text-gray-500">{url.length > 40 ? url.slice(0,40) + '…' : url}</span>
            </button>

            <a href={mailto} className="w-full flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50 text-gray-800">
              <Mail size={18} /> Share via Email
            </a>

            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50 text-gray-800"
              onClick={async () => {
                try {
                  if ((navigator as any).share) {
                    await (navigator as any).share({ title, url });
                    onClose();
                    return;
                  }
                } catch {}
                try { await navigator.clipboard.writeText(url); } catch {}
                onClose();
              }}
            >
              <Link2 size={18} /> Share with apps
            </button>

            {/* Future: in-app share to user/group */}
            <div className="text-xs text-gray-500">Coming soon: share directly to followers or groups.</div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
