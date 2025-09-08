"use client";

import React from "react";
import { X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { type GalleryItem } from "../lib/mediaGallery";
import { useServerMedia, patchMedia, type MediaAssetDTO } from "../lib/mediaClient";
import { MinimalSearch } from "./gallery/MinimalSearch";
import { MediaGrid } from "./gallery/MediaGrid";

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: "gallery" | "upload" | "external";
  onTabChange: (tab: "gallery" | "upload" | "external") => void;

  // Visual theme from Composer (optional; falls back to default if not provided)
  gradientFromColor?: string;
  gradientToColor?: string;

  // Upload
  onRequestSystemFilePicker: () => void;

  // External URL ingest wiring
  externalUrl: string;
  setExternalUrl: (v: string) => void;
  externalTosAccepted: boolean;
  setExternalTosAccepted: (v: boolean) => void;
  startExternalIngestion: () => Promise<void> | void;
  ingestError?: string | null;
  ingestStatus?: string | null;
  ingestProgress?: number | null;
  canAttachExternal: boolean;
  isIngestActive: boolean;

  // Gallery selection
  onSelectFromGallery: (item: GalleryItem) => void;
}

export default function MediaPickerModal(props: MediaPickerModalProps) {
  const {
    isOpen,
    onClose,
    activeTab,
    onTabChange,
    gradientFromColor,
    gradientToColor,
    onRequestSystemFilePicker,
    externalUrl,
    setExternalUrl,
    externalTosAccepted,
    setExternalTosAccepted,
    startExternalIngestion,
    ingestError,
    ingestStatus,
    ingestProgress,
    canAttachExternal,
    isIngestActive,
    onSelectFromGallery,
  } = props;

  if (!isOpen) return null;

  const [query, setQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  // Manual refresh nonce (no auto-interval to avoid flicker)
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const { items: serverItems, loading } = useServerMedia({ q: query || undefined, includeHidden: false, type: 'any', sort: 'newest', limit: 60, t: refreshNonce });

  const results = React.useMemo(() => {
    if (activeTab !== 'gallery') return [] as MediaAssetDTO[];
    return serverItems;
  }, [serverItems, activeTab]);

  // Backfill guard to avoid loops
  const triedBackfillRef = React.useRef(false);

  // Auto-backfill when the Gallery tab is visible and empty
  React.useEffect(() => {
    if (!isOpen) return;
    if (activeTab !== 'gallery') return;
    if (loading) return;
    if (serverItems && serverItems.length > 0) return;
    if (triedBackfillRef.current) return;
    triedBackfillRef.current = true;
    (async () => {
      try {
        await fetch('/api/media/backfill?hours=48&limit=50', { method: 'POST' });
      } catch {}
      setRefreshNonce((n) => n + 1);
    })();
  }, [isOpen, activeTab, loading, serverItems]);

  // One-shot backfill attempt when opening the modal on the Gallery tab
  React.useEffect(() => {
    if (!isOpen) return;
    if (activeTab !== 'gallery') return;
    // Delay a tick to let initial fetch happen
    const t = setTimeout(() => {
      if (!serverItems || serverItems.length === 0) {
        (async () => {
          try {
            await fetch('/api/media/backfill?hours=48&limit=50', { method: 'POST' });
          } catch {}
          setRefreshNonce((n) => n + 1);
        })();
      }
    }, 300);
    return () => clearTimeout(t);
  }, [isOpen, activeTab]);

  // Cmd/Ctrl+K to focus search
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onRename(item: MediaAssetDTO) {
    const next = window.prompt('Rename item', item.title || '');
    if (next == null) return;
    patchMedia(item.id, { title: next }).catch(() => {});
  }

  function onEditLabels(item: MediaAssetDTO) {
    const current = (item.labels || []).join(', ');
    const next = window.prompt('Labels (comma separated)', current);
    if (next == null) return;
    const labels = next.split(',').map((s) => s.trim()).filter(Boolean);
    patchMedia(item.id, { labels }).catch(() => {});
  }

  function onToggleHide(item: MediaAssetDTO) {
    patchMedia(item.id, { hidden: !item.hidden }).catch(() => {});
  }

  function toGalleryItem(dto: MediaAssetDTO): GalleryItem {
    return {
      id: dto.id,
      type: dto.type,
      url: dto.url,
      thumbUrl: dto.thumbUrl || undefined,
      title: dto.title || undefined,
      hidden: !!dto.hidden,
      labels: dto.labels || [],
      durationSec: dto.durationSec ?? undefined,
      width: dto.width ?? undefined,
      height: dto.height ?? undefined,
      createdAt: new Date(dto.createdAt).getTime(),
      updatedAt: new Date(dto.updatedAt).getTime(),
    } as GalleryItem;
  }

  // Map DTOs to GalleryAsset shape for the new MediaGrid/MediaCard components
  const galleryAssets = React.useMemo(() => {
    const derivePathFromUrl = (u?: string | null): string | undefined => {
      if (!u) return undefined;
      try {
        const m = u.match(/\/o\/([^?]+)(?:\?|$)/);
        if (m && m[1]) return decodeURIComponent(m[1]);
      } catch {}
      return undefined;
    };

    const toProxyUrl = (dto: MediaAssetDTO) => {
      // Prefer stable image paths first
      if (dto.thumbPath) return `/api/img?path=${encodeURIComponent(dto.thumbPath)}`;
      // Only use storagePath directly for images (video storagePath points to .mp4 which <img> can't render)
      if (dto.storagePath && dto.type === 'image') return `/api/img?path=${encodeURIComponent(dto.storagePath)}`;
      // Try deriving a path from Firebase-style URLs as a last resort
      if (dto.type === 'image') {
        const derivedFromThumb = derivePathFromUrl(dto.thumbUrl);
        if (derivedFromThumb) return `/api/img?path=${encodeURIComponent(derivedFromThumb)}`;
        const derivedFromUrl = derivePathFromUrl(dto.url);
        if (derivedFromUrl) return `/api/img?path=${encodeURIComponent(derivedFromUrl)}`;
      }
      // Fallback to URLs via proxy (may still be video poster/thumb URLs)
      if (dto.thumbUrl) return `/api/img?url=${encodeURIComponent(dto.thumbUrl)}`;
      if (dto.url && dto.type === 'image') return `/api/img?url=${encodeURIComponent(dto.url)}`;
      return undefined;
    };
    const list = (results || []).map((dto) => ({
      id: dto.id,
      type: dto.type, // 'image' | 'video' | 'gif' | 'audio'
      url: dto.url ? `/api/img?url=${encodeURIComponent(dto.url)}` : undefined,
      title: dto.title || null,
      thumbUrl: toProxyUrl(dto) || null,
      posterUrl: (dto as any).posterUrl ? `/api/img?url=${encodeURIComponent((dto as any).posterUrl)}` : null,
      durationSec: dto.durationSec ?? null,
      hidden: !!dto.hidden,
      inUseCount: (dto as any).inUseCount ?? null,
      labels: dto.labels || [],
    }));
    return list;
  }, [results]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden">
        {/* Thin gradient strip to echo the Composer color scheme */}
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg, ${gradientFromColor || '#F59E0B'}, ${gradientToColor || '#EF4444'})`,
          }}
        />
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-base font-semibold text-gray-900">Add media</h3>
          <button aria-label="Close" className="p-2 rounded-full hover:bg-gray-100" onClick={onClose}>
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as any)}>
            <TabsList className="mb-3 inline-flex items-center gap-1 rounded-full bg-gray-100 p-1">
              <TabsTrigger
                value="gallery"
                className="px-3 py-1.5 rounded-full text-sm data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-gray-900 text-gray-700"
              >
                Gallery
              </TabsTrigger>
              <TabsTrigger
                value="upload"
                className="px-3 py-1.5 rounded-full text-sm data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-gray-900 text-gray-700"
              >
                Upload
              </TabsTrigger>
              <TabsTrigger
                value="external"
                className="px-3 py-1.5 rounded-full text-sm data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-gray-900 text-gray-700"
              >
                External URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gallery">
              <div className="text-sm text-gray-700">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex-1">
                    <MinimalSearch
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onHotkey={() => searchInputRef.current?.focus()}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setRefreshNonce((n) => n + 1)}
                    className="shrink-0 px-3 py-2 rounded-xl border text-sm bg-white hover:bg-gray-50"
                    title="Refresh"
                    aria-label="Refresh gallery"
                  >
                    Refresh
                  </button>
                </div>
                {(!loading && results.length === 0) ? (
                  <div className="rounded-xl border border-dashed p-8 text-gray-600 text-center space-y-3">
                    <div className="text-sm">Your gallery is empty</div>
                    <div className="text-xs">We are syncing your recent ingests automatically…</div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRefreshNonce((n) => n + 1)}
                        className="px-3 py-2 rounded-xl border text-sm bg-white hover:bg-gray-50"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                ) : (
                  <MediaGrid
                    items={galleryAssets}
                    onSelect={(asset) => {
                      const dto = results.find((r) => r.id === asset.id);
                      if (dto) onSelectFromGallery(toGalleryItem(dto));
                    }}
                    onMenu={(asset) => {
                      const dto = results.find((r) => r.id === asset.id);
                      if (!dto) return;
                      // Open simple menu actions (reuse existing handlers)
                      // For now, just rename via prompt as before
                      onRename(dto);
                    }}
                    className="pr-1"
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="upload">
              <div className="space-y-3">
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <div className="mb-2 text-sm text-gray-700">Upload a photo or video from your computer</div>
                  <button
                    type="button"
                    onClick={onRequestSystemFilePicker}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-400 to-red-500 text-white font-medium hover:from-orange-500 hover:to-red-600"
                  >
                    Choose file
                  </button>
                </div>
                <div className="text-xs text-gray-500">Max size depends on your plan. Supported: images and videos.</div>
              </div>
            </TabsContent>

            <TabsContent value="external">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-800">Paste a video URL</label>
                  <input
                    type="text"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://... (YouTube, X, Facebook, Reddit, TikTok)"
                    className="mt-1 w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={externalTosAccepted}
                    onChange={(e) => setExternalTosAccepted(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I confirm I've read the{' '}
                    <a href="/terms" className="underline text-gray-800 hover:text-gray-900" target="_blank" rel="noopener noreferrer">
                      Terms of Service
                    </a>
                  </span>
                </label>

                {ingestError && (
                  <div className="text-sm text-red-600">{ingestError}</div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!canAttachExternal}
                    onClick={() => startExternalIngestion()}
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-orange-400 to-red-500 text-white font-medium disabled:opacity-50"
                  >
                    {isIngestActive ? 'Working…' : 'Ingest video'}
                  </button>
                  {typeof ingestProgress === 'number' && (
                    <div className="text-sm text-gray-700" aria-live="polite">
                      {Math.round(ingestProgress)}% {(() => {
                        const s = (ingestStatus || '').toString();
                        if (!s) return '';
                        const pretty = s.replace(/_/g, ' ').toLowerCase();
                        return pretty;
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

