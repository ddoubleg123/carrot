export type DiscoveredItem = {
  id: string;
  type: 'article'|'video'|'pdf'|'image'|'text';
  title: string;
  url: string; // original
  canonicalUrl?: string;      // used for dedupe
  matchPct?: number;          // 0..1
  status: 'queued'|'fetching'|'enriching'|'pending_audit'|'ready'|'failed';
  media: {
    hero: string | null;      // OG image or generated cover
    gallery?: string[];       // max 4
    videoThumb?: string;
    pdfPreview?: string;
    dominant?: string;        // hex of dominant color (optional)
    mediaAssets?: any;        // Server-processed hero data with blur, source, etc.
  };
  content: {
    summary150: string;       // 120–180 chars
    keyPoints: string[];      // 3–5 bullets
    notableQuote?: string;    // optional
    readingTimeMin?: number;
  };
  meta: {
    sourceDomain: string;     // used with favicon
    favicon?: string;
    author?: string;
    publishDate?: string;     // ISO
  };
};
