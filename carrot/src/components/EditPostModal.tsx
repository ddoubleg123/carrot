"use client";

import React, { useState, useEffect } from "react";

interface EditPostModalProps {
  postId: string;
  initialContent: string;
  open: boolean;
  onClose: () => void;
  onSaved: (nextContent: string, meta?: { editedAt?: string; editCountIncrement?: number }) => void;
}

export default function EditPostModal({ postId, initialContent, open, onClose, onSaved }: EditPostModalProps) {
  const [value, setValue] = useState(initialContent || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(initialContent || "");
  }, [open, initialContent]);

  if (!open) return null;

  const save = async () => {
    if (saving) return;
    const next = (value || "").trim();
    if (next.length > 1000) {
      alert("Content too long (max 1000)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: next }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Failed to update (${res.status})`);
      }
      const updated = await res.json();
      onSaved(updated?.content ?? next, { editedAt: updated?.editedAt, editCountIncrement: 1 });
      onClose();
    } catch (e: any) {
      console.error("Edit post failed", e);
      alert(e?.message || "Failed to save edits");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-base font-semibold text-gray-900">Edit post</h3>
          <button type="button" onClick={onClose} className="px-2 py-1 rounded hover:bg-gray-100">Close</button>
        </div>
        <div className="p-4">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={6}
            className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-orange-200"
            placeholder="Update your post text"
            maxLength={1000}
          />
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <span>{value.length}/1000</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-full border text-gray-800 hover:bg-gray-50">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="px-4 py-2 rounded-full bg-gradient-to-r from-orange-400 to-red-500 text-white disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
