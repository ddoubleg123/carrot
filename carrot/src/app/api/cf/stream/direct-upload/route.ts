import { NextRequest, NextResponse } from 'next/server';

// POST /api/cf/stream/direct-upload
// Creates a one-time Direct Upload URL for Cloudflare Stream (tus-compatible)
// Env required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
export async function POST(req: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return NextResponse.json(
      { error: 'Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    // Optional parameters
    const { maxDurationSeconds, requireSignedURLs, creatorId } = body || {};

    const cfResp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: typeof maxDurationSeconds === 'number' ? maxDurationSeconds : undefined,
          requireSignedURLs: typeof requireSignedURLs === 'boolean' ? requireSignedURLs : undefined,
          creator: creatorId,
        }),
      }
    );

    const data = await cfResp.json();

    if (!cfResp.ok || !data?.success) {
      return NextResponse.json({ error: data?.errors || 'Cloudflare API error' }, { status: 502 });
    }

    // Cloudflare returns: { upload: { url }, result: { id, ... } }
    const uploadURL = data?.result?.uploadURL || data?.uploadURL || data?.result?.upload?.url;
    const uid = data?.result?.id;

    return NextResponse.json({ uploadURL, uid });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
