export interface DiscoveryFact {
  label: string
  value: string
  citation: string
}

export interface DiscoveryQuote {
  text: string
  speaker?: string
  citation?: string
}

export interface DiscoveryContested {
  note: string
  supporting: string
  counter: string
  claim?: string
}

export interface DiscoveryHero {
  url: string
  source: 'ai' | 'wikimedia' | 'skeleton'
}

export interface DiscoveryCardPayload {
  id: string
  title: string
  url: string
  canonicalUrl: string
  domain: string
  sourceType?: string
  category?: string
  credibilityTier?: number
  angle?: string
  noveltySignals?: string[]
  expectedInsights?: string[]
  reason?: string
  whyItMatters: string
  facts: DiscoveryFact[]
  quotes: DiscoveryQuote[]
  provenance: string[]
  contested: DiscoveryContested | null
  contestedClaim?: string
  hero?: DiscoveryHero | null
  heroScore?: number
  relevanceScore: number
  qualityScore: number
  importanceScore: number
  viewSourceOk: boolean
  isControversy?: boolean
  isHistory?: boolean
  savedAt: string
}
