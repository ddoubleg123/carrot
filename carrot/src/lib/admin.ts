/** The only accounts that see the admin menu and the tools behind it. */
export const ADMIN_EMAILS = ['danielgouldman@gmail.com', 'daniel@gotcarrot.com'] as const

export function isAdminEmail(email: string | null | undefined): boolean {
  const key = String(email || '').trim().toLowerCase()
  return ADMIN_EMAILS.some((item) => item === key)
}

export const ADMIN_LINKS = [
  { href: '/curator', label: 'Curator', note: 'What the desks kept, dropped, and posted.' },
  { href: '/channels', label: 'Channels', note: 'The YouTube channels the bots watch.' },
  { href: '/admin/qa', label: 'QA', note: 'Holds, corrections, and the weekly counts.' },
]
