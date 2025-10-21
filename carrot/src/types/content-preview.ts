export interface ContentPreview {
  id: string
  title: string
  summary: string
  keyPoints: string[]
  excerptHtml: string
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
    title?: string
  }
  meta: {
    author?: string
    publishDate?: string
    readingTime?: number
  }
}

export interface ContentPreviewResponse {
  success: boolean
  data?: ContentPreview
  error?: string
}
