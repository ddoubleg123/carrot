const DOMAIN = 'carro7.com'

export function mailAddress(username: string): string {
  return `${username}@${DOMAIN}`
}

function bare(address: string): string {
  const match = address.match(/<([^>]+)>/)
  return (match?.[1] || address).trim()
}

function said(status: number, message: string): string {
  if (/recipient_plan_restricted/i.test(message)) {
    return 'This Cloudflare account can only send to verified addresses. Workers Paid sends to any address.'
  }
  if (status === 401 || /unauthorized|bad_token|authentication/i.test(message)) {
    return 'The Cloudflare token cannot send mail yet.'
  }
  return message || 'The message was not accepted.'
}

function attachment(image: string | null | undefined) {
  const match = image?.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) return undefined
  const type = match[1]
  const ext = type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1]
  return [{ content: match[2], filename: `photo.${ext}`, type, disposition: 'attachment' }]
}

/** Send one message through Cloudflare Email Sending. Returns an error string when it does not go out. */
export async function sendCarroMail(input: { from: string; to: string; subject: string; text: string; image?: string | null }): Promise<string | null> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_EMAIL_TOKEN || process.env.CLOUDFLARE_API_TOKEN
  if (!account || !token) return 'Mail sending is not configured yet.'
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/email/sending/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [bare(input.to)],
        from: bare(input.from),
        subject: input.subject || '(no subject)',
        text: input.text,
        attachments: attachment(input.image),
      }),
      signal: AbortSignal.timeout(20000),
    })
    const payload = await response.json().catch(() => null) as { success?: boolean; errors?: { message?: string }[] } | null
    if (!response.ok || payload?.success === false) {
      return said(response.status, payload?.errors?.[0]?.message || '')
    }
    return null
  } catch {
    return 'The message could not be sent.'
  }
}
