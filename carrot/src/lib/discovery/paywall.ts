import { canonicalizeUrlFast } from './canonicalize'

export type PaywallBranch =
  | 'canonical'
  | 'amp'
  | 'mobile'
  | 'print'
  | 'primary'
  | 'mirror'

export interface PaywallBranchPlanItem {
  branch: PaywallBranch | `${PaywallBranch}:${string}`
  url: string
}

export interface PaywallPlanOptions {
  canonicalUrl: string
  meta?: Record<string, any>
}

export function buildPaywallPlan(options: PaywallPlanOptions): PaywallBranchPlanItem[] {
  const { canonicalUrl, meta } = options
  const plan: PaywallBranchPlanItem[] = []
  const seen = new Set<string>()

  const push = (branch: PaywallBranchPlanItem) => {
    const key = canonicalizeUrlFast(branch.url)
    if (!key || seen.has(key)) return
    seen.add(key)
    plan.push(branch)
  }

  push({ branch: 'canonical', url: canonicalUrl })

  const url = safeUrl(canonicalUrl)
  if (url) {
    const baseHost = url.hostname.replace(/^www\./i, '')
    const path = url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`
    const search = url.search ?? ''

    const ampHosts = [
      `https://amp.${baseHost}${path}${search}`,
      `https://${baseHost}/amp${path}${search}`
    ]

    ampHosts.forEach((candidate) => {
      if (!candidate.toLowerCase().includes('/amp/')) {
        push({ branch: 'amp', url: candidate })
      }
    })

    const mobileHost = `https://m.${baseHost}${path}${search}`
    push({ branch: 'mobile', url: mobileHost })

    const printUrl = appendQuery(url, [
      ['output', '1'],
      ['print', '1']
    ])
    push({ branch: 'print', url: printUrl })
  }

  const primarySources = normaliseStrings(meta?.primaryUrl || meta?.primaryUrls || meta?.officialUrls)
  primarySources.forEach((primaryUrl, index) => {
    const branch: PaywallBranchPlanItem = {
      branch: primarySources.length > 1 ? (`primary:${index + 1}` as const) : 'primary',
      url: primaryUrl
    }
    push(branch)
  })

  const mirrorSources = normaliseStrings(meta?.mirrorUrls || meta?.alternateUrls || meta?.mirrors)
  mirrorSources.forEach((mirrorUrl, index) => {
    const branch: PaywallBranchPlanItem = {
      branch: mirrorSources.length > 1 ? (`mirror:${index + 1}` as const) : 'mirror',
      url: mirrorUrl
    }
    push(branch)
  })

  return plan
}

function safeUrl(input: string): URL | null {
  try {
    return new URL(input)
  } catch {
    return null
  }
}

function appendQuery(url: URL, params: Array<[string, string]>): string {
  const cloned = new URL(url.toString())
  params.forEach(([key, value]) => {
    if (!cloned.searchParams.has(key)) {
      cloned.searchParams.set(key, value)
    }
  })
  return cloned.toString()
}

function normaliseStrings(value: unknown): string[] {
  if (!value) return []
  if (typeof value === 'string') return [value].filter(Boolean)
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : null))
      .filter((entry): entry is string => Boolean(entry && entry.length))
  }
  return []
}


