# CASCADE AI - STARTUP GUIDE
**READ THIS FIRST EVERY SESSION**

## CRITICAL SYSTEM STATE

### Database & Architecture
- **Database**: SQLite at `carrot/prisma/dev.db`
- **Environment**: Windows development machine
- **URLs**: localhost:3005 (dev), gotcarrot.com (prod)
- **Tools Installed**: Google Cloud CLI, Docker, Node.js, Prisma

### SQLite & Prisma Studio (Windows)
- **Canonical DB path**: `carrot/prisma/dev.db`
- The app resolves `DATABASE_URL` to an absolute path internally. For Prisma Studio/CLI, set it explicitly to the absolute Windows path with forward slashes.

Steps to open Studio on the exact same DB:

```powershell
# From carrot/
$abs = (Resolve-Path .\prisma\dev.db).Path -replace '\\','/'
$env:DATABASE_URL = "file:$abs"   # NOTE: use file:C:/..., not file:/C:/
npx prisma studio --port 5556
```

Verify user and posts:
- In Studio (http://localhost:5556), open `User` → ensure `email`, `username`, `isOnboarded` are set.
- Open `Post` and filter by your `userId`.
- If tables look empty, click `Fields → All` to show all columns.

### Repository Structure
- **Main App**: `ddoubleg123/carrot` → `C:\Users\danie\CascadeProjects\windsurf-project\carrot\`
- **Video Ingestion**: `ddoubleg123/carrot-video-ingestion` → `C:\Users\danie\carrot-video-ingestion\`
- **⚠️ CRITICAL**: Video ingestion is in SEPARATE repository to avoid Railway Node.js detection issues

### Video Storage Architecture
- **Storage**: Firebase Storage with user-isolated namespaces
- **Path Structure**: `users/{uid}/{timestamp}_{index}_{filename}`
- **Security**: Storage rules enforce strict user isolation - users can only access their own files
- **Upload Flow**: ComposerModal → uploadFileToFirebase() → Firebase Storage → URL saved to database
- **Database Field**: Video URLs stored in `videoUrl` field with Firebase access tokens

### User's Main Issues (ONGOING)
1. **Avatar Display**: Custom uploaded profile photos disappear after page load due to hydration mismatches
2. **Transcription System**: Audio/video posts should auto-transcribe but currently use placeholder text
3. **Database Queries**: My command execution shows truncated output, making system verification difficult

### What Actually Works
- ✅ User authentication (Google OAuth)
- ✅ Post creation and display  
- ✅ File uploads to Firebase Storage
- ✅ Video processing via Cloudflare Stream
- ✅ Avatar system (with occasional hydration issues)

### What's Broken/Incomplete
- ❌ Real transcription (Vosk service not deployed, using placeholders)
- ❌ My ability to verify database state (commands succeed but show no output)
- ❌ Occasional avatar flickering on page load

## USER COMMUNICATION PREFERENCES
- **NO** unnecessary acknowledgment phrases like "You're absolutely right" or "I can see the issue"
- **Focus on direct problem-solving**
- **Don't assume tools are missing** - they're installed but my command output is truncated
- **Ask for manual verification** when my commands fail rather than making assumptions

## TRANSCRIPTION SYSTEM CURRENT STATE
- **Flow**: Post upload → trigger-transcription → transcribe → database update
- **Status**: Transcription service working but database updates failing (P2025 error)
- **Database Fields**: `audioTranscription`, `transcriptionStatus` in posts table
- **Auto-triggers**: Works for both audio and video posts
- **Current Issue**: Background process database connection differs from main app connection

## Transcription System Status
- **Current State**: Vosk transcription service DEPLOYED and ACTIVE
- **Service URL**: https://vosk-transcription-591459094147.us-central1.run.app
- **Location**: `carrot/transcription-service/` (Google Cloud Run deployment)
- **Cost**: ~$0.001 per transcription (very affordable)
- **Functionality**: Real speech-to-text transcription for audio/video posts
- **Environment Variable**: `TRANSCRIPTION_SERVICE_URL` in `.env.local`

## VIDEO INGESTION SERVICE
- **Repository**: `ddoubleg123/carrot-video-ingestion` (SEPARATE from main carrot repo)
- **Local Path**: `C:\Users\danie\carrot-video-ingestion\`
- **Technology**: Python FastAPI + yt-dlp + Redis
- **Deployment**: Railway (Docker build)
- **Status**: ✅ Successfully deployed
- **Purpose**: Video URL processing and metadata extraction
- **Files**: `main.py`, `requirements.txt`, `Dockerfile`
- **Integration**: Requires Railway service URL in carrot app config

## AVATAR SYSTEM PRIORITY
1. Database `profilePhoto` (user-uploaded)
2. Session `profilePhoto`  
3. Session OAuth `image`
4. Placeholder

## COMMON DEBUGGING ISSUES
- My commands return exit code 0 but show truncated output
- Database check scripts don't display results properly
- I often incorrectly assume things don't exist when they do
- User has audio/video posts but my queries don't show them

## DEPLOYMENT CONTEXT
- **Development**: Uses localhost:3005 endpoints
- **Production**: Uses gotcarrot.com endpoints
- **Transcription**: Google Cloud Run service (Vosk)
- **Video Ingestion**: Railway service (separate repository)
- **Database**: SQLite for development, production TBD

### Railway Video Ingestion Service
- **Status**: ✅ Deployed successfully
- **Repository**: `carrot-video-ingestion` (clean Python-only repo)
- **Build Method**: Docker (forced to avoid Node.js detection)
- **Required**: Redis service (needs to be added)
- **Integration**: Service URL needed in `carrot/.env.local`

## IMMEDIATE ACTIONS FOR NEW SESSIONS
1. Check `SYSTEM_STATE.md` for latest system status
2. Remember user has existing posts with audio/video
3. Don't assume missing tools - verify actual errors
4. Use todo_list tool to track progress
5. Focus on fixing transcription and avatar issues

## KEY FILES TO REMEMBER
- `carrot/src/app/api/audio/transcribe/route.ts` - Main transcription endpoint
- `carrot/src/app/api/audio/trigger-transcription/route.ts` - Triggers transcription
- `carrot/src/app/(app)/dashboard/DashboardClient.tsx` - Avatar display logic
- `carrot/prisma/schema.prisma` - Database schema
- `SYSTEM_STATE.md` - Detailed system documentation
- `DEPLOYMENT_ARCHITECTURE.md` - Complete deployment and repository structure

### Video Ingestion Service Files
- `C:\Users\danie\carrot-video-ingestion\main.py` - FastAPI service
- `C:\Users\danie\carrot-video-ingestion\requirements.txt` - Python dependencies
- `C:\Users\danie\carrot-video-ingestion\Dockerfile` - Docker build config

## USER'S FRUSTRATIONS
- I keep forgetting system state between sessions
- I make incorrect assumptions about missing tools/data
- I don't properly verify what actually exists in the database
- I suggest reinstalling things that are already installed

## Render Image Deploy Verification (carrot-worker)
Use these steps to verify Render is using the intended GHCR image and to interpret `/debug` correctly.

1. __Service type and Image URL__
   - Settings → Image URL must be the exact tag, e.g.
     `ghcr.io/ddoubleg123/carrot-worker:worker-<commit_sha>`
   - If GHCR is private, add a registry credential in Render (ghcr.io, GitHub username, PAT with read:packages) or make the package public.

2. __Deploy events__
   - Events → open the Deploy event. Prefer to see: “Pulling image ghcr.io/...”. If it’s missing, Render may be using a cached digest. Not necessarily a problem.

3. __/debug fields (from `carrot-worker/src/index.js`__
   - `deployment.commit` now includes:
     - `commit`: taken from `RELEASE_SHA || GITHUB_SHA || RENDER_GIT_COMMIT || 'unknown'`
     - `commitSource`: which env var provided it
     - `commitEnv`: echoes all three envs for transparency
   - `env.IMAGE_TAG` is optionally surfaced if you set it.

4. __Deterministic proof of the running build__
   - Set envs in Render → Environment and redeploy:
     - `RELEASE_SHA=<expected_full_sha>`
     - `IMAGE_TAG=ghcr.io/ddoubleg123/carrot-worker:worker-<commit_sha>`
   - Call `/debug` and confirm `deployment.commit` matches `RELEASE_SHA` and `env.IMAGE_TAG` matches.

5. __PORT behavior__
   - For Docker services on Render, PORT is injected (commonly 10000). Seeing 10000 is normal; do not set PORT manually.

6. __yt-dlp cookies and tools__
   - `/debug.tools` shows versions for `yt-dlp` and `ffmpeg`.
   - Cookies come from `YT_DLP_COOKIES` or `YT_DLP_COOKIES_FROM_BROWSER`. Inline Netscape cookies are supported and written to a temp file at runtime.

7. __Ingest auth__
   - Send `x-worker-secret` header matching `INGEST_WORKER_SECRET`. 401 indicates mismatch.

8. __Sanity workflow__
   - Verify `/debug` → run POST `/ingest` with secret → watch logs for yt-dlp/ffmpeg → confirm uploads and callback.

## Prisma Production Safety Plan (Must Follow)

This project MUST follow the guardrails below for any schema changes and DB access in production.

### Non‑negotiables

- Never run `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` against production.
- Use separate databases (or schemas) for dev / staging / prod.
- The running app uses a non‑DDL role (no ALTER/DROP). Only CI migration steps use the admin role.

### Roles (prod one‑time)

Create an app role with no DDL and an admin role for CI migrations.

```sql
CREATE ROLE carrot_app LOGIN PASSWORD '***';

GRANT CONNECT ON DATABASE carrot_prod TO carrot_app;
GRANT USAGE ON SCHEMA public TO carrot_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO carrot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO carrot_app;
```

Do NOT grant CREATE/DROP/ALTER to `carrot_app`. Keep an `carrot_admin` role ONLY for migrations.

### Environment variables (Render)

- Running app (non‑DDL): `DATABASE_URL=postgresql://carrot_app:***@host:5432/carrot_prod?schema=public`
- CI/Release migration step (admin): `MIGRATION_DATABASE_URL=postgresql://carrot_admin:***@host:5432/carrot_prod?schema=public`

### Commands

- Dev only (local/dev DB): `npx prisma migrate dev`
- Prod/staging deploy: `DATABASE_URL="$MIGRATION_DATABASE_URL" npx prisma migrate deploy`

### Guard script

Use `scripts/prisma-guard.cjs` instead of calling Prisma directly in release steps.

```bash
node scripts/prisma-guard.cjs deploy
```

This script blocks dangerous commands in prod and enforces that prod migrations use the admin role URL.

### CI checks

Add a workflow to fail PRs that attempt destructive ops without explicit approval and to block dangerous npm scripts on main.

Examples:

- Fail if `package.json` scripts include `db push`, `migrate reset`, or `migrate dev` for prod.
- Lint `prisma/migrations/**/migration.sql` for `DROP TABLE|DROP COLUMN|TRUNCATE`; require an adjacent `.allow-destructive` file to override.

### Build/Start commands (Render)

- Build:
  - `npm ci`
  - `npm run build`
  - `npx prisma generate`
- Start/Release:
  - `node scripts/prisma-guard.cjs deploy`
  - `node server.js`

Ensure the running service uses the non‑DDL `DATABASE_URL`; only the deploy step uses `MIGRATION_DATABASE_URL`.

### .gitignore and examples

- Ensure env files and Prisma dev artifacts are ignored. Provide `prisma/.env.example` with placeholders only.

### Seed scripts

- Make seeds no‑op in prod.

```javascript
// prisma/seed.ts
if (process.env.NODE_ENV === 'production') process.exit(0);
// dev seeding below
```

### Shadow DB (dev only)

- Use `shadowDatabaseUrl` only in dev; never set it in prod/staging.

### Backups & rollbacks

- Enable automated daily backups for prod.
- Before risky releases, take a manual snapshot.
- Keep previous app image and prior migration ready to rollback.

### Quick test (prove guards)

- Add `postinstall: prisma db push` → CI must fail.
- Add `DROP TABLE` in a migration → CI fails unless `.allow-destructive` sits next to it.
- Try deploy without `MIGRATION_DATABASE_URL` in prod → guard blocks.

## Recent Infrastructure & UX Improvements (September 2025)

This section captures all changes made to harden production safety, streamline Render deploys, and improve playback UX.

### Render Build Pipeline: Guarded Migrations + Health Check

- Build Command (Root Directory = `carrot/`):
  ```bash
  npm ci && node ./scripts/prisma-guard.cjs check-scripts && node ./scripts/prisma-guard.cjs lint-migrations && if [ "$RENDER_GIT_BRANCH" = "main" ] && [ "$ENABLE_MIGRATIONS" = "true" ]; then npx prisma migrate deploy && node ./scripts/health-check.mjs; fi && npm run build
  ```
- Location of scripts (new): `carrot/scripts/`
  - `prisma-guard.cjs`: blocks dangerous Prisma CLI usages in release steps, lints migration SQL for destructive ops, and can proxy a safe `deploy`.
  - `health-check.mjs`: verifies DB connectivity and counts successful migrations using Prisma Client; supports multiple Prisma migration schemas.
- Environment gating in Render (prod web service only):
  - `ENABLE_MIGRATIONS=true` (only prod; prevents accidental schema changes elsewhere)
  - `DATABASE_URL` → runtime app user
  - `MIGRATION_DATABASE_URL` → admin role for migrations
  - `NEXT_PUBLIC_COOKIE_DOMAIN=.gotcarrot.com`
  - `NEXT_PUBLIC_FEED_HLS=1`
- Root Directory must be `carrot/`. The guard and health scripts are referenced as `./scripts/...` from there.

### Prisma Production Safety: Roles, Overrides, CI

- Roles created on Postgres (prod):
  - `carrot_admin` (DDL allowed) → used only by `MIGRATION_DATABASE_URL` during gated `migrate deploy`.
  - `carrot_db_singapore_user` (existing runtime app role) → used by the running app via `DATABASE_URL`.
- New files and policies:
  - `.github/pull_request_template.md`: adds a dedicated "DB Migrations" section with a destructive override block and required PR label.
  - `.allow-destructive.example`: template tracked in repo. Real `.allow-destructive` is ignored by git; developers copy it locally when needed and include it in PRs.
  - `.gitignore`: ignores the real `.allow-destructive` file by default.
  - `carrot/.github/workflows/prisma-guards.yml`: CI runs Prisma guard checks and migration lint on PRs and main.
- Guard behavior:
  - Fails CI if `package.json` scripts contain `prisma db push`, `prisma migrate reset`, or `prisma migrate dev` that could hit prod.
  - Fails CI if `migration.sql` contains destructive SQL unless `.allow-destructive` exists and contains required approval fields.
  - Deploy step only runs `migrate deploy` on main when `ENABLE_MIGRATIONS=true`, then runs `health-check.mjs` to fail fast on DB issues.

### Auth and API Hardening

- `carrot/src/app/api/user/prefs/route.ts`:
  - Uses `import { auth } from '@/auth'` instead of brittle dynamic imports of `authOptions`.
  - Reads guest cookie from `NextRequest.cookies` to avoid typing issues with `cookies()` in different runtimes.
  - Writes/deletes cookie with `NextResponse.cookies` and respects `NEXT_PUBLIC_COOKIE_DOMAIN` in prod.

### Playback UX: SSR Prefs + Client Sync

- New SSR resolver usage and client sync to eliminate initial flicker:
  - `carrot/src/app/(app)/home/page.tsx` fetches `/api/user/prefs` server-side and passes `serverPrefs` to the client.
  - `carrot/src/app/(app)/dashboard/DashboardClient.tsx` accepts `serverPrefs` and writes them to localStorage on mount:
    - `carrot_reduced_motion`, `carrot_captions_default`, `carrot_autoplay_default`.
  - Result: stable video playback settings from first paint, fewer UI jumps.

### HLS Video: Lightweight Player and Dependency

- New component: `carrot/src/components/video/HlsFeedPlayer.tsx`.
  - Uses native HLS on Safari; dynamically imports `hls.js` on other browsers when available; falls back to basic `<video>` if not.
  - Captures basic QoE (first-frame timing), keeps a small network profile, and supports Warm/Active tile behavior.
- Dependency added: `hls.js` (in `carrot/package.json`).
  - Ensure it remains in dependencies; Next.js needs it present at build time even though it’s imported dynamically.

### Prisma Schema: Playback Preferences

- New model: `UserPref` with one-to-one relation to `User`.
  - `UserPref`: `userId` (PK), `captionsDefault`, `reducedMotion`, `autoplay`, timestamps.
  - `User` now has optional `userPref` inverse relation.
  - Used by `GET/PUT /api/user/prefs` and SSR pages to keep playback consistent across devices.

### Render Service Configuration Summary

- Web Service (Next.js app):
  - Root Directory: `carrot/`
  - Build Command: see top of this section.
  - Start Command: default Next.js (Render auto-detect) unless customized.
  - Env Vars (prod): `ENABLE_MIGRATIONS`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `NEXT_PUBLIC_COOKIE_DOMAIN`, `NEXT_PUBLIC_FEED_HLS`, plus existing OAuth/Firebase secrets.

### Failure Modes & Recovery

- Health check fails:
  - Logs "DB health FAILED" with reason; fix DB connectivity or migration state; redeploy.
- CI fails on destructive SQL:
  - Add `.allow-destructive` with rationale and approver, apply backups/rollback plan, add PR label `destructive-migration`.
- Build fails on `hls.js` not found:
  - Run `npm --prefix carrot install hls.js`, commit lockfile, push.
- Auth import errors in API route:
  - Ensure `import { auth } from '@/auth'` rather than dynamic `authOptions` imports.

### Verification Steps (Prod)

1. Push to `main`.
2. Render build runs guard checks, gated `migrate deploy` (if enabled), health check, and Next build.
3. Confirm logs show: `✅ DB health OK` and successful Next.js build.
4. On first page load in `/home`, verify no playback preference flicker (captions/autoplay/reduced motion align with server prefs).

