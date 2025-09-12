"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import GalleryGrid from "./GalleryGrid";
import type { Media } from "./MediaTile";
import MediaEditorModal from "./MediaEditorModal";
import { uploadFilesToFirebase } from "../../lib/uploadToFirebase";

export default function MediaLibraryModal({ open, onClose, onInsert }: {
  open: boolean;
  onClose: () => void;
  onInsert: (m: Media & { inMs?: number; outMs?: number; aspect?: string }) => void;
}) {
  const [tab, setTab] = useState<'gallery'|'upload'|'external'>('gallery');
  const [editItem, setEditItem] = useState<Media | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [extUrl, setExtUrl] = useState("");
  const [extMsg, setExtMsg] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<number | null>(null);

  // Poll ingest job status when jobId is present
  useEffect(() => {
    let timer: any;
    let cancelled = false;
    async function poll() {
      if (!jobId) return;
      try {
        const res = await fetch(`/api/ingest?jobId=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
        if (res.ok) {
          const j = await res.json();
          const s = j?.job?.status || j?.status || null;
          const p = typeof j?.job?.progress === 'number' ? j.job.progress : null;
          if (!cancelled) {
            setJobStatus(s);
            setJobProgress(p);
          }
        }
      } catch {}
      if (!cancelled) timer = setTimeout(poll, 3000);
    }
    if (jobId) poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [jobId]);

  if (!open || typeof document === 'undefined') return null;

  const body = (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-0 top-8 mx-auto w-full max-w-[980px] rounded-2xl overflow-hidden shadow-xl border border-[#E6E8EC] bg-white">
        {/* Brand strip */}
        <div className="h-2 w-full bg-gradient-to-r from-orange-500 via-pink-500 to-blue-600" />
        <div className="px-4 py-3 flex items-center gap-3 border-b border-[#E6E8EC]">
          <div className="flex items-center gap-2">
            <button className={`px-3 py-1.5 rounded-md text-sm ${tab==='gallery' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('gallery')}>Gallery</button>
            <button className={`px-3 py-1.5 rounded-md text-sm ${tab==='upload' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('upload')}>Upload</button>
            <button className={`px-3 py-1.5 rounded-md text-sm ${tab==='external' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('external')}>External URL</button>
          </div>
          <button className="ml-auto text-sm text-gray-500" onClick={onClose} aria-label="Close">Close ✕</button>
        </div>
        <div className="p-4 max-h-[78vh] overflow-auto">
          {tab === 'gallery' && (
            <GalleryGrid onOpen={(m) => setEditItem(m)} />
          )}
          {tab === 'upload' && (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">Upload an image or GIF to your media library.</div>
              <input type="file" accept="image/*,.gif" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {uploadError ? <div className="text-xs text-red-600">{uploadError}</div> : null}
              <div>
                <button
                  className="px-3 py-2 rounded-md border border-[#E6E8EC] text-sm disabled:opacity-60"
                  disabled={!file || uploading}
                  onClick={async () => {
                    if (!file) return;
                    setUploading(true);
                    setUploadError(null);
                    try {
                      const [url] = await uploadFilesToFirebase([file], 'media/uploads/');
                      const res = await fetch('/api/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, type: file.type.includes('gif') ? 'gif' : 'image', title: file.name, thumbUrl: url, source: 'upload' }) });
                      const j = await res.json();
                      if (!res.ok) throw new Error(j?.error || 'Create media failed');
                      const media: Media = { id: j.id, kind: file.type.includes('gif') ? 'image' : 'image', title: file.name, duration: undefined, thumbPath: '', posterUrl: url, url, storagePath: '', tags: [], hidden: false };
                      setEditItem(media);
                    } catch (e: any) {
                      setUploadError(String(e?.message || e));
                    } finally {
                      setUploading(false);
                    }
                  }}
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          )}
          {tab === 'external' && (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">Import from an external URL (YouTube, etc.).</div>
              <input value={extUrl} onChange={(e) => setExtUrl(e.target.value)} placeholder="https://..." className="w-full border border-[#E6E8EC] rounded-md px-3 py-2 text-sm" />
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 rounded-md border border-[#E6E8EC] text-sm"
                  onClick={async () => {
                    setExtMsg(null);
                    try {
                      const res = await fetch('/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: extUrl }) });
                      const j = await res.json();
                      if (!res.ok) throw new Error(j?.error || 'Failed to start ingest');
                      const id = j?.job?.id || j?.job_id || null;
                      if (id) setJobId(id);
                      setExtMsg('Ingest started. Monitoring status below…');
                    } catch (e: any) {
                      setExtMsg(String(e?.message || e));
                    }
                  }}
                >Start Ingest</button>
                {extMsg ? <div className="text-xs text-gray-600">{extMsg}</div> : null}
              </div>
              {jobId && (
                <div className="mt-2 text-xs text-gray-700 border border-gray-200 rounded p-2">
                  <div><span className="text-gray-500">Job:</span> {jobId}</div>
                  <div><span className="text-gray-500">Status:</span> {jobStatus || '…'}</div>
                  {typeof jobProgress === 'number' ? (
                    <div className="mt-1">
                      <div className="h-1.5 bg-gray-200 rounded">
                        <div className="h-1.5 bg-gray-800 rounded" style={{ width: `${Math.max(0, Math.min(100, jobProgress))}%` }} />
                      </div>
                      <div className="mt-1 text-gray-500">{jobProgress}%</div>
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      className="px-2 py-1 rounded border text-xs"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/media/backfill', { method: 'GET' });
                          if (res.ok) setExtMsg('Backfill triggered. Check Gallery.');
                        } catch {}
                      }}
                    >Backfill now</button>
                    <span className="text-[11px] text-gray-500">Use Gallery → Refresh to see imported media once complete.</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {editItem && (
        <MediaEditorModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onInsert={(v) => { setEditItem(null); onClose(); onInsert(v); }}
        />
      )}
    </div>
  );

  return createPortal(body, document.body);
}
