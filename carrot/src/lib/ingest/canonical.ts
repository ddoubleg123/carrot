export function normalizeUrl(input?: string | null): string | null {
  if (!input) return null;
  try {
    const u = new URL(input);
    u.hash = '';
    // strip common tracking params
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid'].forEach(p=>u.searchParams.delete(p));
    // normalize hostname (www.)
    u.hostname = u.hostname.replace(/^www\./, '');
    return u.toString();
  } catch {
    return null;
  }
}

export function chooseCanonical(sourceUrl?: string | null, declaredCanonical?: string | null) {
  const c = normalizeUrl(declaredCanonical || undefined);
  return c || normalizeUrl(sourceUrl || undefined);
}
