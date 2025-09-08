"use client";
import * as React from "react";
import { MediaCard, type GalleryAsset } from "./MediaCard";

// Lightweight virtualized grid without external deps.
// - Fixed aspect ratio tiles (16:9)
// - Computes columns from container width
// - Renders only visible rows (+ small overscan)

type Props = {
  items: GalleryAsset[];
  onSelect: (asset: GalleryAsset) => void;
  onMenu?: (asset: GalleryAsset) => void;
  className?: string;
  maxHeight?: number; // px, default 56vh
};

export function MediaGrid({ items, onSelect, onMenu, className, maxHeight }: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0, scrollTop: 0 });

  // Resize observer to track container size
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize((s) => ({ ...s, width: el.clientWidth, height: el.clientHeight }));
    });
    ro.observe(el);
    const onScroll = () => {
      setSize((s) => ({ ...s, scrollTop: el.scrollTop }));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // init
    setSize({ width: el.clientWidth, height: el.clientHeight, scrollTop: el.scrollTop });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Layout constants
  const GAP = 12; // px
  const minCell = 200; // min tile width

  const columnCount = Math.max(1, Math.floor((size.width + GAP) / (minCell + GAP)));
  const columnWidth = Math.floor((size.width - GAP * (columnCount - 1)) / columnCount);
  const rowHeight = Math.round(columnWidth * 9 / 16) + 16; // aspect-video + chrome
  const rowCount = Math.ceil(items.length / columnCount);

  // Visible window
  const overscan = 3; // rows
  const startRow = Math.max(0, Math.floor(size.scrollTop / rowHeight) - overscan);
  const endRow = Math.min(rowCount - 1, Math.floor((size.scrollTop + size.height) / rowHeight) + overscan);

  const children: React.ReactNode[] = [];
  for (let row = startRow; row <= endRow; row++) {
    const top = row * rowHeight;
    for (let col = 0; col < columnCount; col++) {
      const i = row * columnCount + col;
      if (i >= items.length) break;
      const left = col * (columnWidth + GAP);
      const asset = items[i];
      children.push(
        <div key={asset.id}
             style={{ position: 'absolute', top, left, width: columnWidth, height: rowHeight, padding: 6 }}>
          <MediaCard asset={asset} selected={(asset as any)._selected}
                     onSelect={() => onSelect(asset)} onMenu={() => onMenu?.(asset)} />
        </div>
      );
    }
  }

  const totalHeight = rowCount * rowHeight;

  return (
    <div ref={containerRef}
         className={"relative w-full overflow-auto " + (className ?? "")}
         style={{ maxHeight: maxHeight ? `${maxHeight}px` : '56vh', willChange: 'transform' }}>
      <div style={{ position: 'relative', width: '100%', height: totalHeight }}>
        {children}
      </div>
    </div>
  );
}
