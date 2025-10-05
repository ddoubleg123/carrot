import { decideByScore } from './policies';

export type RelevanceInput = {
  content: {
    tags?: string[];
    categories?: string[];
    qualityScore?: number; // 0..1
    freshnessScore?: number; // 0..1
    embeddingSim?: number; // 0..1 (optional for now)
  };
  patchRules?: {
    mustTags?: string[];
    blockTags?: string[];
  };
};

export function jaccard(a: string[] = [], b: string[] = []): number {
  const A = new Set(a.map((x) => x.toLowerCase()));
  const B = new Set(b.map((x) => x.toLowerCase()));
  const inter = [...A].filter((x) => B.has(x)).length;
  const uni = new Set([...A, ...B]).size || 1;
  return inter / uni;
}

export function relevanceScore(input: RelevanceInput): { score: number; decision: ReturnType<typeof decideByScore> } {
  const quality = input.content.qualityScore ?? 0.7;
  const freshness = input.content.freshnessScore ?? 0.5;
  const sim = input.content.embeddingSim ?? 0.6;
  const overlap = jaccard(input.content.tags, input.patchRules?.mustTags);

  const score = 0.55 * sim + 0.25 * quality + 0.15 * overlap + 0.05 * freshness;
  const decision = decideByScore(score);
  return { score, decision };
}
