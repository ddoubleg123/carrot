# Cloudflare Cutover Runbook (gotcarrot.com)

This runbook guides the switch to Cloudflare in front of the Next.js app, with media-optimized caching and safe validation.

Related doc: see `docs/cloudflare-cdn.md` for detailed rules and validation commands.
Startup context: see `CASCADE_STARTUP_GUIDE.md` for environment flags and media performance stack overview.

## Prereqs
- Domain access to Cloudflare zone for `gotcarrot.com`.
- Render service URL for the Next.js web app.
- App flags enabled:
  - `NEXT_PUBLIC_FEED_HLS=1`
  - `NEXT_PUBLIC_MEDIA_SW=1`

## Steps

1) DNS
- In Cloudflare → DNS, add a CNAME for the app hostname (e.g., `app.gotcarrot.com`) pointing to your Render hostname.
- Enable the orange cloud (proxied) so Cloudflare sits in front.

2) Cache Rules (Cloudflare Dashboard → Rules → Cache Rules)
- HLS Segments (immutable)
  - If: URL Path matches `*.ts` OR `*.m4s`
  - Then: Cache Everything; Edge TTL 7–30 days; Ignore origin cache control.
- HLS Playlists (short TTL)
  - If: URL Path matches `*.m3u8`
  - Then: Cache Everything; Edge TTL 60s (30–120s ok); Ignore origin cache control.
- API Video Proxy (respect origin)
  - If: URL Path starts with `/api/video`
  - Then: Respect origin cache control. (Our proxy already short‑caches negatives for 60s.)
- Bypass Dynamic APIs
  - If: URL Path matches `/api/auth/*` OR `/api/user/*` OR `/api/rum`
  - Then: Bypass cache.

3) Transform Rule (optional)
- Response header: set `Timing-Allow-Origin: *` for paths matching `*.m3u8`, `*.ts`, `*.m4s`, and `/api/video*`.

4) Validation (curl)
- Replace `<host>` with gotcarrot.com or your chosen subdomain.

Playlists (short TTL):
```bash
curl -I https://<host>/path/to/master.m3u8
# Expect: CF-Cache-Status: MISS (first) then HIT on second call
```

Segments (long TTL):
```bash
curl -I https://<host>/path/to/seg0.ts
# Expect: CF-Cache-Status: MISS then HIT; Accept-Ranges: bytes
```

API proxy:
```bash
curl -I "https://<host>/api/video?url=<encoded>"
# Expect: cache headers from origin; negatives respect 60s per proxy
```

5) App-level Observability
- Check server logs:
  - `[api/video] minute status counts { '200': N, '206': M, '404': K, ... }`
  - `[api/rum] minute metrics { 'first_frame_ms': X, 'rebuffer_ms': Y, 'rebuffer_count': Z, ... }`
- Browser DevTools Network: ensure visible tiles only attach media; fewer 404s; no duplicate `/api/video` requests.

6) Rollback
- In Cloudflare DNS, gray-cloud the app record (disable proxy) to route directly to Render if needed.

## Notes
- Uploads remain direct to Firebase Storage; Cloudflare only fronts reads.
- For best cache hit rate, keep HLS segments public/immutable and playlists short‑lived.
- Service Worker prefetch is optional and controlled by `NEXT_PUBLIC_MEDIA_SW`.
