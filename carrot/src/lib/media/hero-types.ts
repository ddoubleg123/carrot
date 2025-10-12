export type HeroSource = 'og' | 'oembed' | 'inline' | 'video' | 'pdf' | 'image' | 'generated' | 'ai-generated'
export type HeroLicense = 'source' | 'generated'

export interface HeroInput {
  url?: string
  type: 'article' | 'video' | 'pdf' | 'image' | 'text'
  assetUrl?: string
  title?: string
  summary?: string
  patchTheme?: string
}

export interface HeroOutput {
  hero: string
  blurDataURL?: string
  dominant?: string
  source: HeroSource
  license: HeroLicense
}

export interface MediaAssets {
  hero?: string
  blurDataURL?: string
  dominant?: string
  source?: HeroSource
  license?: HeroLicense
  gallery?: string[]
  videoThumb?: string
  pdfPreview?: string
}

export interface OpenGraphResult {
  url: string
  source: 'og' | 'oembed'
  width?: number
  height?: number
}

export interface InlineImageResult {
  url: string
  width: number
  height: number
  alt?: string
}
