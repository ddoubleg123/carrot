import { redirect } from 'next/navigation';
import { headers as nextHeaders } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Try NextAuth auth() first (dynamic import to avoid RSC init issues)
  let session: any = null;
  try {
    const mod: any = await import('../../auth');
    const authFn: any = typeof mod?.auth === 'function' ? mod.auth : (typeof mod?.default?.auth === 'function' ? mod.default.auth : null);
    if (authFn) {
      session = await authFn();
      if (process.env.NODE_ENV !== 'production') {
        try { console.log('[layout] auth() result user?', !!session?.user); } catch {}
      }
    }
  } catch {}

  // Fallback: fetch session from API with forwarded cookies
  if (!session?.user) {
    const hdrs = await nextHeaders();
    const cookieHeader = hdrs.get('cookie') || '';
    try {
      const res = await fetch(`/api/auth/session`, {
        headers: { 'cookie': cookieHeader },
        cache: 'no-store',
      });
      if (process.env.NODE_ENV !== 'production') {
        try { console.log('[layout] cookie length', cookieHeader.length, 'status', res.status); } catch {}
      }
      if (res.ok) {
        session = await res.json().catch(() => null);
      }
    } catch {}
  }

  // Only handle onboarding redirect here if we do have a user
  if (session?.user && !session.user.isOnboarded) {
    redirect('/onboarding');
  }

  return (
    <main className="flex-1 min-h-screen bg-gray-50">{children}</main>
  );
}
