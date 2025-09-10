export type PlaybackPrefs = { reducedMotion: boolean; captionsDefault: boolean };
const DEFAULTS: PlaybackPrefs = { reducedMotion: false, captionsDefault: true };

function parseCookie(raw?: string | null): any | null {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function pickBool(...vals: (boolean | undefined)[]): boolean {
  for (const v of vals) if (typeof v === 'boolean') return v;
  return false;
}

export async function resolvePlaybackPrefs(opts: {
  cookie?: string | null;
  userId?: string | null;
  loader?: (userId: string) => Promise<Partial<PlaybackPrefs> | null>;
}): Promise<PlaybackPrefs> {
  const { cookie, userId, loader } = opts;
  const fromCookie = parseCookie(cookie);
  const fromDb = userId && loader ? await loader(userId).catch(() => null) : null;
  return {
    reducedMotion: pickBool(fromCookie?.reducedMotion, fromDb?.reducedMotion, DEFAULTS.reducedMotion),
    captionsDefault: pickBool(fromCookie?.captionsDefault, fromDb?.captionsDefault, DEFAULTS.captionsDefault),
  };
}
