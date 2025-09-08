import { EyeOff, Check, MoreHorizontal, Film, Image as ImageIcon } from "lucide-react";
import { Thumb } from "./Thumb";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GalleryAsset = {
  id: string;
  type: string; // 'image' | 'video' | 'gif' | 'audio'
  url?: string | null;
  title?: string | null;
  thumbUrl?: string | null;
  posterUrl?: string | null;
  durationSec?: number | null;
  hidden?: boolean | null;
  inUseCount?: number | null;
  labels?: string[] | null;
};

type Props = {
  asset: GalleryAsset;
  selected?: boolean;
  onSelect: () => void;
  onMenu?: () => void;
};

export function MediaCard({ asset, selected, onSelect, onMenu }: Props) {
  const isVideo = asset.type?.toLowerCase() === "video";
  const isImage = asset.type?.toLowerCase() === "image";
  const src = isVideo
    ? (asset.posterUrl || asset.thumbUrl || undefined)
    : (asset.thumbUrl || asset.url || undefined);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-[#E6E8EC] bg-white shadow-sm focus:outline-none",
        selected && "ring-2 ring-[#FF6A00]"
      )}
      aria-pressed={selected ? true : undefined}
    >
      <div className="aspect-video w-full">
        {isImage || isVideo ? (
          <Thumb
            src={src}
            type={isVideo ? "VIDEO" : "IMAGE"}
            alt={asset.title || (isVideo ? "video" : "image")}
            className={cn("h-full w-full", asset.hidden && "opacity-60")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#F7F8FA] text-[#60646C]">
            {isVideo ? <Film className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
          </div>
        )}
      </div>

      {/* badges */}
      <div className="pointer-events-none absolute left-2 top-2 flex gap-2">
        {isVideo && asset.durationSec ? (
          <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[12px] text-white">
            {formatDuration(asset.durationSec)}
          </span>
        ) : null}
        {asset.hidden ? (
          <span className="flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[12px] text-white">
            <EyeOff className="h-3.5 w-3.5" /> Hidden
          </span>
        ) : null}
        {asset.inUseCount && asset.inUseCount > 0 ? (
          <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[12px] text-[#60646C]">In use</span>
        ) : null}
      </div>

      {/* labels */}
      {asset.labels && asset.labels.length > 0 ? (
        <div className="absolute bottom-2 left-2 flex max-w-[85%] flex-wrap gap-1">
          {asset.labels.slice(0, 3).map((l) => (
            <span key={l} className="rounded-md bg-[#F7F8FA] px-1.5 py-0.5 text-[11px] text-[#60646C]">{l}</span>
          ))}
        </div>
      ) : null}

      {/* hover actions */}
      <div className="absolute right-2 top-2 hidden items-center gap-2 group-hover:flex">
        <button aria-label="More" onClick={(e) => { e.stopPropagation(); onMenu?.(); }} className="rounded-md bg-white/95 p-1 shadow-sm">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <button aria-label="Select" onClick={(e) => { e.stopPropagation(); onSelect(); }} className="rounded-md bg-[#FF6A00] p-1 text-white">
          <Check className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
