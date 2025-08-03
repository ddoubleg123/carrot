import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

  // Generate 8-digit code
  const code = Math.floor(10000000 + Math.random() * 90000000).toString();

  // TODO: Store code in DB or cache with expiry

  // Send email
  try {
    // Debug logging
    console.log('[Resend] Attempting to send signup code', { email, code });
    console.log('[Resend] ENV:', {
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
      RESEND_API_KEY_LENGTH: process.env.RESEND_API_KEY?.length
    });
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: 'Your Carrot Signup Code',
      html: `<!DOCTYPE html>
<html>
  <body style="background: linear-gradient(135deg, #f5f3ff 0%, #e0e7ff 100%); font-family: 'Inter', Arial, sans-serif; padding: 0; margin: 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 40px auto; background: #fff; border-radius: 18px; box-shadow: 0 4px 24px 0 rgba(80, 80, 120, 0.07); overflow: hidden;">
      <tr>
        <td style="padding: 40px 0 0 0; text-align: center;">
          <!-- Carrot Logo SVG -->
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="24" cy="38" rx="14" ry="6" fill="#F3F4F6"/>
            <path d="M26.1 6.5c.5-2.1 3.6-2.2 4.3-.2.5 1.4-.7 3.5-1.2 4.6-.3.6-.9.8-1.5.5-.6-.3-.8-.9-.5-1.5.3-.7 1-2.1.9-2.6-.1-.5-.9-.4-1 .2-.2.7-.5 2.1-.6 2.7-.1.6-.7 1-1.3.9-.6-.1-1-.7-.9-1.3.2-1.1.7-3.2 2.8-3.3z" fill="#4ADE80"/>
            <path d="M19.9 7.1c-1.1-1.9-4-1.1-4 1 .1 1.5 2.1 2.8 2.9 3.2.6.3 1.2.1 1.5-.5.3-.6.1-1.2-.5-1.5-.7-.3-2-1.1-2-1.6 0-.5.7-.8 1-.3.3.5 1 1.5 1.2 1.8.3.5.9.7 1.4.4.5-.3.7-.9.4-1.4-.3-.5-1.1-1.6-1.9-2.1z" fill="#4ADE80"/>
            <path d="M24 13c-6.1 0-11 4.9-11 11 0 7.5 7.6 13.5 10.2 15.3.5.3 1.1.3 1.6 0C27.4 37.5 35 31.5 35 24c0-6.1-4.9-11-11-11z" fill="#F59E42"/>
            <ellipse cx="24" cy="24" rx="6" ry="9" fill="#FBBF24"/>
          </svg>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 32px 0 32px; text-align: center;">
          <h2 style="font-size: 2rem; font-weight: 800; color: #1f2937; margin: 24px 0 8px 0;">Your Carrot Signup Code</h2>
          <p style="font-size: 1rem; color: #6b7280; margin: 0 0 24px 0;">Use this code to continue creating your account.</p>
          <div style="background: linear-gradient(90deg, #fbbf24 0%, #f59e42 100%); color: #fff; font-size: 2.5rem; font-weight: bold; letter-spacing: 0.25em; border-radius: 12px; padding: 24px 0; margin: 0 0 24px 0; box-shadow: 0 2px 8px 0 rgba(245, 158, 66, 0.07);">
            ${code}
          </div>
          <p style="font-size: 1rem; color: #6b7280; margin: 0 0 32px 0;">If you did not request this, you can ignore this email.</p>
        </td>
      </tr>
      <tr>
        <td style="padding: 0 0 32px 0; text-align: center; color: #d1d5db; font-size: 0.9rem;">
          &copy; ${new Date().getFullYear()} Carrot
        </td>
      </tr>
    </table>
  </body>
</html>`
    });
    console.log('[Resend] Email send response:', response);
    if (response && response.error) {
      console.error('[Resend] Email send error:', response.error);
      return NextResponse.json({ error: response.error.message || 'Resend error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Resend] Failed to send signup code', { email, error: err });
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
