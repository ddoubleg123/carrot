# Cloudflare CDN Configuration (Infra-only)

This guide documents the exact Cloudflare settings to place in front of the Next.js app and optimize media delivery without any UI changes.

## Overview
- Origin: your Render-hosted Next.js app (or your custom domain pointing to Render)
- Objective: fast HLS/MP4 delivery, low request storms, preserved Range, accurate caching

## DNS
1. Add your domain to Cloudflare (Zone).
2. Create a CNAME for the app subdomain to your Render hostname.
3. Enable the orange-cloud (proxy) for this record.

## Cache Rules
Cloudflare Dashboard → Rules → Cache Rules → Create

1) HLS Segments (immutable)
- Description: HLS segments long TTL
- If: URL Path matches `*.ts` OR `*.m4s`
- Then:
  - Cache → Cache Everything
  - Edge TTL → 7 days (or up to 30 days)
  - Origin Cache-Control → Ignore origin

2) HLS Playlists (short TTL)
- Description: HLS playlists short TTL
- If: URL Path matches `*.m3u8`
- Then:
  - Cache → Cache Everything
  - Edge TTL → 60 seconds (30–120s acceptable)
  - Origin Cache-Control → Ignore origin

3) API Video Proxy (respect origin)
- Description: API video proxy respect origin
- If: URL Path starts with `/api/video`
- Then:
  - Cache → Respect Origin Cache-Control
  - Note: Our proxy sets short caching on negative statuses (404/410/403) for 60s to mitigate storms.

4) Bypass dynamic APIs (safety)
- Description: Bypass dynamic APIs
- If: URL Path matches any of `/api/auth/*`, `/api/user/*`, `/api/rum`
- Then:
  - Cache → Bypass cache

## Transform Rules (optional)
Cloudflare Dashboard → Rules → Transform Rules → Modify Response Header

1) Timing-Allow-Origin for media
- If: URL Path matches `*.m3u8` or `*.ts` or `*.m4s` or `/api/video*`
- Then: Set Response Header `Timing-Allow-Origin` to `*`

## Network / Performance
- Range requests: Cloudflare preserves Range automatically. Verify with `curl -I -H "Range: bytes=0-1" https://<your-domain>/path/to/seg0.ts`.
- Brotli/Gzip: Disabled/minimal for media types (`video/*`, `application/vnd.apple.mpegurl`, `application/octet-stream`).

## Validation Steps
1. Playlists
```bash
curl -I https://<your-domain>/path/to/master.m3u8
# Expect: CF-Cache-Status: MISS (first), HIT (subsequent) and short Age
```
2. Segments
```bash
curl -I https://<your-domain>/path/to/seg0.ts
# Expect: CF-Cache-Status: MISS then HIT with long Age; Accept-Ranges: bytes
```
3. API Video Proxy (MP4)
```bash
curl -I "https://<your-domain>/api/video?url=<encoded_url>"
# Expect: Cache-Control from origin or default; negative statuses respected for 60s per proxy
```

## Rollout Flags in App
- `NEXT_PUBLIC_FEED_HLS=1` — prefer HLS when available.
- `NEXT_PUBLIC_MEDIA_SW=1` — enable media prefetch service worker.

## Observability Hooks
- Server proxy: `/api/video` logs a minute aggregate of upstream HTTP status codes.
- RUM intake: `/api/rum` collects first-frame and rebuffer counters (minute-aggregated). You can GET `/api/rum` to inspect ephemeral counts.

## Notes
- Uploads remain direct to Firebase/Storage; CDN only fronts reads.
- For signed URLs, cache hit rate depends on token TTL. Prefer public or stable tokenized segments for HLS; keep playlists short-lived.
