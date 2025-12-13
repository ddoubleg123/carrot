export interface ContentPreview {
  id: string
  title: string
  summary: string
  keyPoints: string[]
  excerptHtml: string
  quotes?: string // Fair use quotes (up to 3 paragraphs, max 1200 chars)
  context?: string
  entities: Array<{
    name: string
    type: string
    url?: string
  }>
  timeline: Array<{
    date: string
    fact: string
  }>
  media: {
    hero?: string
    dominant?: string
  }
  source: {
    url: string
    domain: string
    favicon?: string
    title?: string
    verified?: boolean
  }
  meta: {
    author?: string
    publishDate?: string
    readingTime?: number
    domain?: string
    url?: string
    canonicalUrl?: string
  }
}

export interface ContentPreviewResponse {
  success: boolean
  data?: ContentPreview
  error?: string
}
