import { join } from 'node:path'
import sharp from 'sharp'

const DOMAIN = 'carro7.com'
const SITE = 'https://gotcarrot.com'

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function properName(name: string, username: string): string {
  const raw = (name || username).trim()
  if (!raw) return username
  if (raw !== raw.toLowerCase()) return raw
  return raw.replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1))
}

/** The letter a recipient sees: the note, then a signature with the account and gotcarrot.com. */
export function signedLetter(input: { name: string; username: string; text: string; html?: string }): { text: string; html: string } {
  const username = input.username.trim()
  const name = properName(input.name, username)
  const account = `${SITE}/people/${encodeURIComponent(username)}`
  const accountLabel = `gotcarrot.com/people/${username}`
  const address = mailAddress(username)
  const words = input.text.trim()
  const text = [words, '', name, 'gotcarrot.com', `Email ${address}`, `Account ${account}`].join('\n')
  const paragraphs = input.html?.trim()
    ? input.html
    : words.split(/\n{2,}/).map((part) => (
      `<p style="margin:0 0 14px;">${escapeHtml(part).replace(/\n/g, '<br>')}</p>`
    )).join('')
  const safeName = escapeHtml(name)
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td style="padding:4px 2px 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#202124;">${paragraphs}</td></tr>
<tr><td style="padding:26px 2px 0 2px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid #e6e6e6;">
<tr>
<td width="76" valign="middle" style="padding:16px 14px 0 0;vertical-align:middle;"><img src="cid:carrot-mark" width="64" height="64" alt="Carrot" style="display:block;border:0;outline:none;text-decoration:none;"></td>
<td valign="middle" style="padding:16px 0 0 0;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;">
<div style="font-size:16px;line-height:20px;font-weight:700;color:#1a365d;">${safeName}</div>
<div style="padding-top:2px;font-size:13px;line-height:18px;color:#5f6b76;">gotcarrot.com</div>
</td>
</tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#3c4043;">
<tr><td style="padding:0 14px 2px 0;color:#5f6b76;">Email</td><td><a href="mailto:${escapeHtml(address)}" style="color:#1a73e8;text-decoration:none;">${escapeHtml(address)}</a></td></tr>
<tr><td style="padding:0 14px 0 0;color:#5f6b76;">Account</td><td><a href="${account}" style="color:#1a73e8;text-decoration:none;">${escapeHtml(accountLabel)}</a></td></tr>
</table>
</td></tr>
</table>
</body></html>`
  return { text, html }
}

async function markAttachment() {
  try {
    const content = await sharp(join(process.cwd(), 'public', 'carrot-logo.png'))
      .resize(128, 128, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer()
    return { content: content.toString('base64'), filename: 'carrot.png', type: 'image/png', disposition: 'inline', content_id: 'carrot-mark' }
  } catch {
    return null
  }
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
export async function sendCarroMail(input: { from: string; to: string; subject: string; text: string; image?: string | null; name?: string; username?: string; html?: string }): Promise<string | null> {
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
        from: input.username ? { address: bare(input.from), name: properName(input.name || '', input.username) } : bare(input.from),
        reply_to: bare(input.from),
        subject: input.subject || '(no subject)',
        ...(input.username
          ? signedLetter({ name: input.name || '', username: input.username, text: input.text, html: input.html })
          : { text: input.text }),
        attachments: [input.username ? await markAttachment() : null, ...(attachment(input.image) || [])].filter(Boolean),
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
