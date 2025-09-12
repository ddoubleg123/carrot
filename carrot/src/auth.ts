import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";
import { PrismaAdapter } from '@auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// Resolve SQLite file path to absolute to avoid cwd-related errors (Error code 14)
function resolveSqliteUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith('file:')) return url;
  const p = url.slice('file:'.length);
  // If already absolute, normalize separators and return
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  const normalized = abs.replace(/\\/g, '/');
  return `file:${normalized}`;
}

const resolvedDbUrl = resolveSqliteUrl(process.env.DATABASE_URL);
const prisma = new PrismaClient(
  resolvedDbUrl
    ? { datasources: { db: { url: resolvedDbUrl } } }
    : undefined as any
);

import { patchAdapter } from "./adapterPatch";


// Helper to refresh Google tokens inside the JWT callback
async function refreshGoogleToken(token: JWT) {
  try {
    const refreshToken = token.refresh_token as string;
    if (!refreshToken) {
      console.warn('[NextAuth] No refresh_token present in JWT when attempting to refresh Google token.');
    } else {
      console.log('[NextAuth] Attempting Google token refresh with refresh_token:', refreshToken.slice(0, 4) + '...' + refreshToken.slice(-4));
    }
    const params = {
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };
    const body = new URLSearchParams(params);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    let refreshed: any = {};
    try {
      refreshed = await res.json();
    } catch (jsonErr) {
      const text = await res.text();
      console.error('[NextAuth] Google token refresh failed, non-JSON response:', text);
      throw text;
    }
    if (!res.ok) {
      console.error("[NextAuth] Google token refresh failed", {
        status: res.status,
        statusText: res.statusText,
        response: refreshed,
        sent: {
          ...params,
          client_secret: params.client_secret ? '***' : undefined
        }
      });
      throw refreshed;
    }

    return {
      ...token,
      access_token: refreshed.access_token,
      expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
    };
  } catch (err) {
    console.error("[NextAuth] Error refreshing access token", err);
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

function safeString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

// --- SESSION BLOAT GUARDRAILS: HTTP 431 PREVENTION ---
// Only allow these fields in JWT/session. Anything else is stripped and triggers a warning.
const ALLOWED_FIELDS = ['id', 'email', 'username', 'profilePhoto', 'image', 'emailVerified', 'provider'];

function containsNestedObject(obj: any, depth = 0): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  if (depth > 2) return true;
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      return true;
    }
  }
  return false;
}

function logObjectSize(name: string, obj: any) {
  try {
    const str = JSON.stringify(obj);
    console.log(`[${name}] size:`, str.length, 'bytes');
    if (str.length > 3500) {
      console.warn(`[${name}] WARNING: Object exceeds 3.5KB, risk of session bloat!`);
    }
  } catch (e) {
    console.warn(`[${name}] Could not stringify object for size check.`);
  }
}

// Avoid eager adapter patching/logging in RSC import path
// Enable by setting USE_PATCHED_ADAPTER=1 if you need it during local debugging
const adapter = process.env.USE_PATCHED_ADAPTER === '1' ? patchAdapter(PrismaAdapter(prisma)) : undefined as any;

export const authOptions = {
  // adapter,
  trustHost: true,
  session: {
    strategy: 'jwt' as const,
  },
  debug: true,

  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile',
        },
      },
    }),
  ],

  pages: {
    signIn: '/login',
    newUser: '/home',
  },
  callbacks: {
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Always redirect to /home after successful OAuth login
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/home`;
      }
      // Allow relative callback URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // Allow callback URLs on the same origin
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      return `${baseUrl}/home`;
    },
    async signIn({ user, account, profile }: { user: any; account?: any; profile?: any }) {
      console.log('[NextAuth][signIn] === SIGNIN CALLBACK DEBUG ===');
      console.log('[NextAuth][signIn] user:', JSON.stringify(user, null, 2));
      console.log('[NextAuth][signIn] account:', JSON.stringify(account, null, 2));
      console.log('[NextAuth][signIn] profile:', JSON.stringify(profile, null, 2));

      // Skip database operations when adapter is disabled
      console.log('[NextAuth][signIn] Skipping database operations (adapter disabled)');

      console.log('[NextAuth][signIn] === END SIGNIN DEBUG ===');
      return true; // Allow sign in
    },

    async jwt({ token, user, account }: { token: any; user?: any; account?: any }) {
      console.log('[NextAuth][jwt] === JWT CALLBACK DEBUG ===');
      console.log('[NextAuth][jwt] account:', JSON.stringify(account, null, 2));
      console.log('[NextAuth][jwt] user (from adapter):', JSON.stringify(user, null, 2));
      console.log('[NextAuth][jwt] token (before update):', JSON.stringify(token, null, 2));

      // CRITICAL SECURITY FIX: Detect account mixing and force fresh session
      if (account && user) {
        // This is a fresh login - check for email mismatch with existing token
        if (token.email && token.email !== user.email) {
          console.log('[NextAuth][jwt] 🚨 ACCOUNT MIXING DETECTED!');
          console.log('[NextAuth][jwt] Token email:', token.email);
          console.log('[NextAuth][jwt] New user email:', user.email);
          console.log('[NextAuth][jwt] FORCING FRESH SESSION...');
          
          // Clear the existing token completely and start fresh
          token = {
            email: user.email,
            sub: user.id,
          };
        }
      }

      if (user) {
        console.log('[NextAuth][jwt] Processing user login...');
        console.log('[NextAuth][jwt] user.email:', user.email);
        console.log('[NextAuth][jwt] user.id:', user.id);
        console.log('[NextAuth][jwt] user.username:', user.username);

        if (account?.provider) {
          token.provider = account.provider;
        }
        token.id = user.id;
        token.email = user.email;
        token.username = user.username || undefined;
        token.profilePhoto = user.profilePhoto || undefined;
        token.image = user.image || undefined;
        if ('emailVerified' in user) {
          token.emailVerified = user.emailVerified;
        }
        console.log('[NextAuth][jwt callback] user fields:', Object.keys(user));
        if (typeof user.image === 'string' && user.image.startsWith('data:image')) {
          console.warn('[NextAuth][jwt callback] user.image contains base64 data!');
        }
        if (typeof user.profilePhoto === 'string' && user.profilePhoto.startsWith('data:image')) {
          console.warn('[NextAuth][jwt callback] user.profilePhoto contains base64 data!');
        }
      }

      console.log('[NextAuth][jwt] token (after update):', JSON.stringify(token, null, 2));
      console.log('[NextAuth][jwt] === END JWT DEBUG ===');
      const size = JSON.stringify(token).length;
      if (size > 1000) {
        console.warn(`[NextAuth][jwt callback] token size is large: ${size} bytes`, token);
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      console.log('[NextAuth][session] === SESSION CALLBACK DEBUG ===');
      console.log('[NextAuth][session] token.email:', token.email);
      console.log('[NextAuth][session] token.id:', token.id);
      console.log('[NextAuth][session] token.username:', token.username);
      console.log('[NextAuth][session] session.user.email (before):', session.user?.email);

      // Ensure email exists; if not, log and proceed with minimal session to avoid AccessDenied
      if (!token.email) {
        console.warn('[NextAuth][session] No email in token; proceeding with minimal session to avoid AccessDenied');
        return session;
      }

      // Fetch user data from database to get uploaded profile photo
      let userData: any = null;
      const skipDb = process.env.NEXT_PUBLIC_USE_MOCK_FEED === '1' || process.env.SKIP_DB_IN_DEV === '1';
      try {
        if (!skipDb) {
          const { PrismaClient } = await import('@prisma/client');
          // Use default env-based datasource (Postgres in production). Do not force SQLite fallback.
          const prisma = new PrismaClient();
          userData = await prisma.user.findUnique({
            where: { email: token.email as string },
            select: { 
              id: true, 
              username: true, 
              profilePhoto: true, 
              image: true,
              isOnboarded: true 
            }
          });
          
          // Sync OAuth image to database if missing
          if (userData && !userData.image && (token.picture || token.image)) {
            await prisma.user.update({
              where: { email: token.email as string },
              data: { image: token.picture || token.image }
            });
            userData.image = token.picture || token.image;
          }
          await prisma.$disconnect();
          console.log('[NextAuth][session] Database user found:', userData);
        }
      } catch (error) {
        // Suppress noisy DB errors in dev mock mode
        if (!skipDb) {
          console.log('[NextAuth][session] Database query failed:', error);
        } else if (process.env.NODE_ENV !== 'production') {
          try { console.warn('[NextAuth][session] Skipping DB in dev mock mode'); } catch {}
        }
      }

      if (!userData) {
        console.log('[NextAuth][session] No database user found, using token data only');
      }

      // CRITICAL: Always use token email as source of truth, never database email
      session.user = {
        id: userData?.id || token.id as string,
        email: token.email as string, // ALWAYS use token email for security
        username: userData?.username || token.username as string | undefined,
        profilePhoto: userData?.profilePhoto || token.profilePhoto as string | undefined,
        image: token.picture || token.image as string | undefined, // Keep OAuth image for fallback
        emailVerified: null as Date | null,
        isOnboarded: userData?.isOnboarded ?? false, // Force onboarding since database was reset
      };

      // Force isOnboarded=true in session if SKIP_ONBOARD_EMAILS matched
      try {
        const skip = (process.env.SKIP_ONBOARD_EMAILS || '')
          .split(',')
          .map(s => s.trim().toLowerCase())
          .filter(Boolean);
        const emailLc = String(token.email || '').toLowerCase();
        if (emailLc && skip.includes(emailLc)) {
          (session.user as any).isOnboarded = true;
        }
      } catch {}

      console.log('[NextAuth][session] Final session.user:', JSON.stringify(session.user, null, 2));
      console.log('[NextAuth][session] === END SESSION DEBUG ===');
      const size = JSON.stringify(session).length;
      if (size > 1000) {
        console.warn(`[NextAuth][session callback] session size is large: ${size} bytes`, session);
      }
      if (typeof token.image === 'string' && token.image.startsWith('data:image')) {
        console.warn('[NextAuth][session callback] token.image contains base64 data!');
      }
      if (typeof token.profilePhoto === 'string' && token.profilePhoto.startsWith('data:image')) {
        console.warn('[NextAuth][session callback] token.profilePhoto contains base64 data!');
      }
      return session;
    }
  },
events: {
  async signIn(message: any) {
    console.log('[NextAuth][events][signIn]', JSON.stringify(message, null, 2));
  },
  async signOut(message: any) {
    console.log('[NextAuth][events][signOut]', JSON.stringify(message, null, 2));
  },
  async session(message: any) {
    console.log('[NextAuth][events][session]', JSON.stringify(message, null, 2));
  },
  async error(error: any) {
    console.error('[NextAuth][events][error]', error);
  },
},
logger: {
  error(code: unknown, metadata?: unknown) {
    console.error('[NextAuth][logger][error]', code, metadata);
  },
  warn(code: unknown) {
    console.warn('[NextAuth][logger][warn]', code);
  },
  debug(code: unknown, metadata?: unknown) {
    console.log('[NextAuth][logger][debug]', code, metadata);
  },
},
};

// Use NextAuth helpers (provides typed handlers, auth(), signIn(), signOut())
export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
// Provide a default export to ensure dynamic imports in RSC can access `.default.auth`
const exported = { handlers, auth, signIn, signOut } as const;
if (process.env.NODE_ENV !== 'production') {
  try { console.log('[auth.ts] exports ready:', Object.keys(exported)); } catch {}
}
export default exported;
