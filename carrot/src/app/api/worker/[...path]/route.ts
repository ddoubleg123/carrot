import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// If your original file had other helpers/imports, keep them here as-is.

// GET /api/worker/[...path]
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  // Existing logic can continue to use `path` as an array of segments
  // Example: if you had `const segments = (context?.params?.path ?? [])`, keep the behavior:
  // const segments = path || [];

  // ... your existing GET logic here ...
  // Make sure to return a Response/NextResponse
  // Example passthrough:
  return new NextResponse('OK');
}

// POST /api/worker/[...path]
// If your file defines POST, convert it as well
export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  // ... your existing POST logic here ...
  return NextResponse.json({ ok: true, path });
}

// If your file has other methods (PUT, PATCH, DELETE), convert them the same way:
// - First param: Request
// - Second param: { params: Promise<{ path: string[] }> }
// - Access params with: const { path } = await context.params