const DOMAIN = 'carro7.com'
const SITE = 'https://gotcarrot.com'

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The letter a recipient sees: the note, then the sender's Carrot account and gotcarrot.com. */
export function signedLetter(input: { name: string; username: string; text: string }): { text: string; html: string } {
  const username = input.username.trim()
  const name = input.name.trim() || username
  const account = `${SITE}/people/${encodeURIComponent(username)}`
  const address = mailAddress(username)
  const words = input.text.trim()
  const text = [words, '', '—', name, address, account, '', 'gotcarrot.com'].join('\n')
  const paragraphs = words.split(/\n{2,}/).map((part) => (
    `<p style="margin:0 0 14px;">${escapeHtml(part).replace(/\n/g, '<br>')}</p>`
  )).join('')
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f3f0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f0;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:28px 28px 4px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.5;color:#1c1917;">${paragraphs}</td></tr>
<tr><td style="padding:8px 28px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e7e5e4;">
<tr><td style="padding-top:16px;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#1c1917;">${escapeHtml(name)}</td></tr>
<tr><td style="padding-top:2px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#78716c;">${escapeHtml(address)}</td></tr>
<tr><td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;"><a href="${account}" style="color:#c2410c;text-decoration:none;">Carrot account</a></td></tr>
<tr><td style="padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.04em;"><a href="${SITE}" style="color:#1c1917;text-decoration:none;">gotcarrot.com</a></td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
  return { text, html }
}

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
export async function sendCarroMail(input: { from: string; to: string; subject: string; text: string; image?: string | null; name?: string; username?: string }): Promise<string | null> {
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
        from: input.username ? { address: bare(input.from), name: input.name || input.username } : bare(input.from),
        reply_to: bare(input.from),
        subject: input.subject || '(no subject)',
        ...(input.username
          ? signedLetter({ name: input.name || input.username, username: input.username, text: input.text })
          : { text: input.text }),
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
