import { NextRequest, NextResponse } from "next/server";

// MOCK: always returns available: true for demonstration
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("u");
  // TODO: Replace with real DB lookup
  if (!username || username.length < 3) {
    return NextResponse.json({ available: false });
  }
  return NextResponse.json({ available: true });
}
