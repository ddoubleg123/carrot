import type { Adapter } from "@auth/core/adapters";

const ALLOWLIST = ["id", "email", "username", "profilePhoto", "image", "emailVerified"] as const;
type SafeUser = Pick<any, typeof ALLOWLIST[number]>;

function isBase64Image(val: any): boolean {
  if (typeof val !== 'string') return false;
  return val.startsWith('data:image');
}

export function sanitizeUser(u: any): SafeUser {
  const sanitized: any = {};
  for (const key of ALLOWLIST) {
    if (key in u) {
      if ((key === 'image' || key === 'profilePhoto') && isBase64Image(u[key])) {
        sanitized[key] = null;
      } else {
        sanitized[key] = u[key];
      }
    }
  }
  return sanitized;
}


export function patchAdapter(original: Adapter): Adapter {
  console.error('PATCHED ADAPTER LOADED');
  console.error('PATCHED ADAPTER LOADED');
  return {
    ...original,
    getUser: original.getUser
      ? async (id) => {
          console.error('[patchAdapter] getUser called with id:', id);
          if (!original.getUser) throw new Error('original.getUser is undefined');
          let user = await original.getUser(id);
          console.error('[patchAdapter] getUser result:', user);
          if (user) {
            delete user.image;
            // @ts-expect-error: profile may not exist on AdapterUser
delete user.profile;
            // @ts-expect-error: accounts may not exist on AdapterUser
delete user.accounts;
            // @ts-expect-error: sessions may not exist on AdapterUser
delete user.sessions;
          }
          return user ? sanitizeUser(user) : null;
        }
      : undefined,
    getUserByEmail: original.getUserByEmail
      ? async (email) => {
          console.error('[patchAdapter] getUserByEmail called with email:', email);
          if (!original.getUserByEmail) throw new Error('original.getUserByEmail is undefined');
          let user = await original.getUserByEmail(email);
          console.error('[patchAdapter] getUserByEmail result:', user);
          if (user) {
            delete user.image;
            // @ts-expect-error: profile may not exist on AdapterUser
delete user.profile;
            // @ts-expect-error: accounts may not exist on AdapterUser
delete user.accounts;
            // @ts-expect-error: sessions may not exist on AdapterUser
delete user.sessions;
          }
          return user ? sanitizeUser(user) : null;
        }
      : undefined,
    getUserByAccount: original.getUserByAccount
      ? async (account) => {
          console.error('[patchAdapter] getUserByAccount called with account:', account);
          if (!original.getUserByAccount) throw new Error('original.getUserByAccount is undefined');
          let user = await original.getUserByAccount(account);
          console.error('[patchAdapter] getUserByAccount result:', user);
          if (user) {
            delete user.image;
            // @ts-expect-error: profile may not exist on AdapterUser
delete user.profile;
            // @ts-expect-error: accounts may not exist on AdapterUser
delete user.accounts;
            // @ts-expect-error: sessions may not exist on AdapterUser
delete user.sessions;
          }
          return user ? sanitizeUser(user) : null;
        }
      : undefined,
    createUser: original.createUser
      ? async (data) => {
          console.error('[patchAdapter] createUser called with data:', data);
          if (!original.createUser) throw new Error('original.createUser is undefined');
          let user = await original.createUser(data);
          console.error('[patchAdapter] createUser result:', user);
          if (user) {
            delete user.image;
            // @ts-expect-error: profile may not exist on AdapterUser
delete user.profile;
            // @ts-expect-error: accounts may not exist on AdapterUser
delete user.accounts;
            // @ts-expect-error: sessions may not exist on AdapterUser
delete user.sessions;
          }
          return sanitizeUser(user);
        }
      : undefined,
    updateUser: original.updateUser
      ? async (data) => {
          console.error('[patchAdapter] updateUser called with data:', data);
          if (!original.updateUser) throw new Error('original.updateUser is undefined');
          let user = await original.updateUser(data);
          console.error('[patchAdapter] updateUser result:', user);
          if (user) {
            delete user.image;
            // @ts-expect-error: profile may not exist on AdapterUser
delete user.profile;
            // @ts-expect-error: accounts may not exist on AdapterUser
delete user.accounts;
            // @ts-expect-error: sessions may not exist on AdapterUser
delete user.sessions;
          }
          return sanitizeUser(user);
        }
      : undefined,
    // leave other methods untouched
  };
}
