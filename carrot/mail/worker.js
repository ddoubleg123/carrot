/**
 * Cloudflare Email Worker for carro7.com.
 *
 * Deploy this on the Workers paid plan, then set the catch-all
 * *@carro7.com to Send to this worker. Do not forward to Gmail.
 *
 * Secrets:
 *   CARROT_URL   https://gotcarrot.com
 *   MAIL_SECRET  same value as MAIL_INBOUND_SECRET on the Carrot server
 */
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).text()
    const response = await fetch(`${env.CARROT_URL}/api/messages/inbound`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-mail-secret': env.MAIL_SECRET,
      },
      body: JSON.stringify({
        to: message.to,
        from: message.from,
        subject: message.headers.get('subject') || '',
        text: plainText(raw),
        messageId: message.headers.get('message-id'),
      }),
    })
    if (!response.ok) message.setReject('Carrot could not accept this message.')
  },
}

function plainText(raw) {
  const split = raw.split(/\r?\n\r?\n/)
  const body = split.slice(1).join('\n\n')
  const stripped = body
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  return stripped.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 20000)
}
