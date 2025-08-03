import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = cookieHeader.split('; ').filter(Boolean);
  const cookieSizes = cookies.map(c => ({
    name: c.split('=')[0],
    size: c.length,
  }));
  console.log('Cookie sizes:', cookieSizes);
  return NextResponse.json({ cookieSizes });
}
