import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("u");
    
    if (!username || username.length < 3) {
      return NextResponse.json({ available: false });
    }

    // Get current user session to check if this is their own username
    const session = await auth();
    const currentUserEmail = session?.user?.email;

    // Check if username exists in Prisma database
    const existingUser = await prisma.user.findUnique({
      where: { username: username },
      select: { email: true, username: true }
    });
    
    if (!existingUser) {
      // Username doesn't exist, it's available
      return NextResponse.json({ available: true });
    }

    // Username exists, check if it belongs to the current user
    if (currentUserEmail && existingUser.email === currentUserEmail) {
      // This is the current user's own username, treat as available
      return NextResponse.json({ available: true });
    }

    // Username exists and belongs to someone else
    return NextResponse.json({ available: false });

  } catch (error) {
    console.error('Username check error:', error);
    return NextResponse.json({ available: false, error: 'Failed to check username' }, { status: 500 });
  }
}
