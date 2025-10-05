// Server-side DeepSeek Audit client (mockable)
export type AuditInput = {
  text: string;
  kind: 'article' | 'video' | 'image' | 'pdf' | 'text';
  hints?: { url?: string; title?: string };
};

export type AuditOutput = {
  summaryShort: string;
  keyPoints: string[]; // 3-5
  notableQuote?: string;
  categories: string[];
  tags: string[];
  entities: Array<{ name: string; type: string }>;
  readingTimeSec: number;
  qualityScore: number; // 0..1
  flags: { nsfw?: boolean; paywall?: boolean; pii?: boolean };
};

function calcReadingTimeSec(text: string) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(30, Math.round(words / 3.5)); // ~210 wpm
}

export async function deepseekAudit(input: AuditInput): Promise<AuditOutput> {
  // If env configured, call real API here
  const useMock = !process.env.DEEPSEEK_API_URL || !process.env.DEEPSEEK_API_KEY;
  if (useMock) {
    const readingTimeSec = calcReadingTimeSec(input.text);
    const baseTags = ['open-source', 'metadata', 'search'];
    return {
      summaryShort: (input.text.slice(0, 178) + '…').replace(/\s+/g, ' ').trim(),
      keyPoints: ['Schema patterns', 'Search facets', 'APIs & docs'],
      notableQuote: undefined,
      categories: ['catalog'],
      tags: baseTags,
      entities: [],
      readingTimeSec,
      qualityScore: 0.85,
      flags: {},
    };
  }
  // Real call (placeholder)
  const res = await fetch(process.env.DEEPSEEK_API_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`DeepSeek error ${res.status}`);
  const data = await res.json();
  return data as AuditOutput;
}
