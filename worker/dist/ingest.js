import { Storage } from '@google-cloud/storage';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import fetch from 'node-fetch';
// Provide sensible local defaults to avoid silent no-callbacks in dev
const CALLBACK_URL = (process.env.INGEST_CALLBACK_URL || 'http://localhost:3005/api/ingest/callback').replace(/\/$/, '');
const CALLBACK_SECRET = process.env.INGEST_CALLBACK_SECRET || 'dev_ingest_secret';
const GCS_BUCKET = process.env.GCS_BUCKET || '';
const TRIM_SECONDS = Math.max(0, Number(process.env.INGEST_TRIM_SECONDS || '0'));
const WORKER_PUBLIC_URL = (process.env.WORKER_PUBLIC_URL || 'http://localhost:8080').replace(/\/$/, '');
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
function execCmd(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd });
        const stderrChunks = [];
        const stdoutChunks = [];
        const maxBytes = 64 * 1024; // keep last 64KB for diagnostics
        p.stdout?.on('data', (d) => {
            stdoutChunks.push(d);
            // Trim if too large
            let total = stdoutChunks.reduce((n, b) => n + b.length, 0);
            while (total > maxBytes && stdoutChunks.length > 1) {
                const shift = stdoutChunks.shift();
                total -= shift ? shift.length : 0;
            }
        });
        p.stderr?.on('data', (d) => {
            stderrChunks.push(d);
            let total = stderrChunks.reduce((n, b) => n + b.length, 0);
            while (total > maxBytes && stderrChunks.length > 1) {
                const shift = stderrChunks.shift();
                total -= shift ? shift.length : 0;
            }
        });
        p.on('error', reject);
        p.on('close', (code) => {
            if (code === 0)
                return resolve();
            const stderr = Buffer.concat(stderrChunks).toString('utf8');
            const stdout = Buffer.concat(stdoutChunks).toString('utf8');
            const err = new Error(`${cmd} exited with code ${code}`);
            (err.stderr = stderr), (err.stdout = stdout);
            return reject(err);
        });
    });
}
// Trim an existing video into a new clip and make it available similarly to ingest output
export async function runTrim(req) {
    const jobId = req.id;
    const workdir = path.join(process.cwd(), 'tmp', `trim-${jobId}`);
    await fs.mkdir(workdir, { recursive: true });
    const outLocalDir = path.join(process.cwd(), 'data', 'ingest');
    await fs.mkdir(outLocalDir, { recursive: true }).catch(() => { });
    const finalLocalPath = path.join(outLocalDir, `${jobId}.mp4`);
    const outPath = GCS_BUCKET ? path.join(workdir, 'output.mp4') : finalLocalPath;
    // Normalize start/end
    const start = Math.max(0, Number(req.startSec || 0));
    const end = Number(req.endSec || 0);
    const hasEnd = !Number.isNaN(end) && end > start;
    // Watchdog to avoid stuck jobs
    const watchdog = setTimeout(async () => {
        console.warn('[worker] Trim watchdog timeout; marking failed', { jobId });
        await sendCallback(jobId, {
            status: 'failed',
            progress: 0,
            error: 'Trim timeout. Check source availability.'
        });
        try {
            await fs.rm(workdir, { recursive: true, force: true });
        }
        catch { }
    }, 4 * 60 * 1000);
    try {
        console.log('[worker] Trim start', { jobId, sourceUrl: req.sourceUrl, start, end: hasEnd ? end : undefined });
        await sendCallback(jobId, { status: 'downloading', progress: 10, postId: req.postId });
        // Transcode/trim directly from URL; ffmpeg can read http(s). Use veryfast baseline output.
        let transcodeProgress = 20;
        const keepalive = setInterval(() => {
            transcodeProgress = Math.min(transcodeProgress + 4, 85);
            sendCallback(jobId, { status: 'transcoding', progress: transcodeProgress, postId: req.postId });
        }, 2000);
        const ffArgs = [
            '-y',
            ...(start ? ['-ss', String(start)] : []),
            '-i', req.sourceUrl,
            ...(hasEnd ? ['-to', String(end)] : []),
            // Prefer stream copy when possible for speed; fall back to encode in case of errors handled by ffmpeg itself
            // Here we encode to ensure broad compatibility similar to ingest output
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-profile:v', 'baseline',
            '-level', '3.1',
            '-c:a', 'aac',
            '-movflags', '+faststart',
            outPath,
        ];
        await execCmd('ffmpeg', ffArgs).finally(() => clearInterval(keepalive));
        console.log('[worker] Trim transcode complete', { jobId, outPath });
        await sendCallback(jobId, { status: 'uploading', progress: 90, postId: req.postId });
        let mediaUrl = '';
        let cfUid;
        if (GCS_BUCKET) {
            const storage = new Storage();
            const bucket = storage.bucket(GCS_BUCKET);
            const dest = `ingest/${jobId}.mp4`;
            await bucket.upload(outPath, { destination: dest, contentType: 'video/mp4' });
            await bucket.file(dest).makePublic().catch(() => { });
            mediaUrl = `https://storage.googleapis.com/${GCS_BUCKET}/${dest}`;
        }
        else if (CF_ACCOUNT_ID && CF_API_TOKEN) {
            // For parity with ingest: upload to Cloudflare Stream if configured
            const cfResp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/direct_upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ requireSignedURLs: false, thumbnailTimestampPct: 0 }),
            });
            if (!cfResp.ok) {
                const t = await cfResp.text().catch(() => '');
                throw new Error(`Cloudflare direct_upload create failed (trim): ${cfResp.status} ${t}`);
            }
            const cfJson = await cfResp.json();
            const uploadURL = cfJson?.result?.uploadURL;
            cfUid = cfJson?.result?.uid;
            if (!uploadURL || !cfUid) {
                throw new Error('Cloudflare direct_upload response missing uploadURL or uid (trim)');
            }
            let Tus = null;
            try {
                const mod = await import('tus-js-client');
                Tus = { Upload: mod.Upload, NodeHttpStack: mod.NodeHttpStack };
            }
            catch (e) {
                throw new Error('tus-js-client is required for Cloudflare uploads but is not installed.');
            }
            const stat = fsSync.statSync(outPath);
            const stream = fsSync.createReadStream(outPath);
            await new Promise((resolve, reject) => {
                const uploader = new Tus.Upload(stream, {
                    endpoint: uploadURL,
                    uploadSize: stat.size,
                    retryDelays: [500, 1000, 2000, 5000],
                    httpStack: new Tus.NodeHttpStack(),
                    metadata: { filename: `${jobId}.mp4`, filetype: 'video/mp4' },
                    onError: (error) => reject(error),
                    onSuccess: () => resolve(),
                    onProgress: (bytesSent, bytesTotal) => {
                        const p = Math.max(90, Math.min(99, Math.floor((bytesSent / bytesTotal) * 100)));
                        sendCallback(jobId, { status: 'uploading', progress: p, postId: req.postId });
                    },
                });
                uploader.start();
            });
            // mediaUrl left empty when using CF; prefer cfUid
        }
        else {
            mediaUrl = `${WORKER_PUBLIC_URL}/media/ingest/${jobId}.mp4`;
        }
        await sendCallback(jobId, { status: 'finalizing', progress: 95, postId: req.postId });
        await sendCallback(jobId, {
            status: 'completed',
            progress: 100,
            mediaUrl,
            cfUid,
            cfStatus: cfUid ? 'uploaded' : undefined,
            postId: req.postId,
        });
        console.log('[worker] Trim completed', { jobId });
    }
    catch (e) {
        const msg = e?.message || String(e);
        await sendCallback(jobId, {
            status: 'failed',
            progress: 0,
            error: `Worker trim failed: ${msg}`,
            postId: req.postId,
        });
        console.error('[worker] Trim failed', { jobId, error: msg });
    }
    finally {
        try {
            await fs.rm(workdir, { recursive: true, force: true });
        }
        catch { }
        clearTimeout(watchdog);
        // local watchdog cleared inside finally
    }
}
async function runYtDlp(url, opts) {
    // Build flags first, then add URL. Ensure short flags are prefixed with '-'.
    const args = [];
    for (const [k, v] of Object.entries(opts)) {
        const flag = k.startsWith('-') ? k : `-${k}`;
        if (typeof v === 'boolean') {
            if (v)
                args.push(flag);
        }
        else if (v !== undefined && v !== null) {
            args.push(flag, String(v));
        }
    }
    // URL last per yt-dlp CLI convention
    args.push(url);
    const candidates = [
        process.env.YT_DLP_PATH,
        'yt-dlp',
        process.platform === 'win32' ? 'yt-dlp.exe' : undefined,
        process.platform === 'win32' ? 'C\\\\Tools\\\\yt-dlp\\\\yt-dlp.exe' : undefined,
    ].filter(Boolean);
    let lastErr;
    for (const bin of candidates) {
        try {
            if (bin && (!bin.includes('yt-dlp.exe') || fsSync.existsSync(bin))) {
                await execCmd(bin, args);
                return;
            }
        }
        catch (e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error('yt-dlp not found in PATH or YT_DLP_PATH');
}
async function sendCallback(jobId, payload) {
    if (!CALLBACK_URL || !CALLBACK_SECRET) {
        console.warn('[worker] Missing callback config; skipping callback', {
            hasUrl: Boolean(CALLBACK_URL),
            hasSecret: Boolean(CALLBACK_SECRET),
        });
        return;
    }
    try {
        await fetch(CALLBACK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-ingest-callback-secret': CALLBACK_SECRET,
            },
            body: JSON.stringify({ id: jobId, ...payload }),
        });
    }
    catch (e) {
        console.warn('[worker] Callback POST failed (best-effort)', e);
    }
}
export async function runIngest(req) {
    const jobId = req.id;
    const workdir = path.join(process.cwd(), 'tmp', `ingest-${jobId}`);
    await fs.mkdir(workdir, { recursive: true });
    const rawBase = path.join(workdir, 'raw');
    // Final output path: either local media dir or tmp (when uploading to GCS)
    const localMediaDir = path.join(process.cwd(), 'data', 'ingest');
    await fs.mkdir(localMediaDir, { recursive: true }).catch(() => { });
    const finalLocalPath = path.join(localMediaDir, `${jobId}.mp4`);
    const outPath = GCS_BUCKET ? path.join(workdir, 'output.mp4') : finalLocalPath;
    // Watchdog to avoid stuck jobs (20 minutes for ingest; large videos can take time)
    const watchdog = setTimeout(async () => {
        console.warn('[worker] Ingest watchdog timeout; marking failed', { jobId });
        await sendCallback(jobId, {
            status: 'failed',
            progress: 0,
            error: 'Ingest timeout. Check network or source URL.'
        });
        try {
            await fs.rm(workdir, { recursive: true, force: true });
        }
        catch { }
    }, 20 * 60 * 1000);
    try {
        console.log('[worker] Ingest start', { jobId, url: req.url, type: req.type, workdir });
        await sendCallback(jobId, { status: 'downloading', progress: 0 });
        // Download best video format. yt-dlp will use ffmpeg if remuxing is needed.
        // Keepalive while downloading
        let downloadProgress = 0;
        const keepalive1 = setInterval(() => {
            // Smoothly advance download progress up to 55%
            downloadProgress = Math.min(downloadProgress + 5, 55);
            sendCallback(jobId, { status: 'downloading', progress: downloadProgress });
        }, 2000);
        // Build yt-dlp options; allow optional cookies to bypass app-gating/age/region
        const ytOpts = {
            // Prefer best video+audio; yt-dlp will remux if possible
            f: 'mp4/bv*+ba/b',
            // Write with detected extension; we'll discover the file afterwards
            o: `${rawBase}.%(ext)s`,
            q: true,
            // Network robustness
            '--socket-timeout': '30',
            '--retries': '5',
            '--fragment-retries': '5',
            '--retry-sleep': '3',
            '--file-access-retries': '10',
            '--force-ipv4': true,
            '--concurrent-fragments': '4',
            '--abort-on-unavailable-fragment': true,
            '--no-check-certificate': true,
            '--ignore-config': true,
            // Try to bypass YouTube app restrictions by mimicking a modern client
            '--user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
            '--add-header': 'Referer:https://www.youtube.com',
            // Prefer an alternate player client which often avoids the "not available on this app" block
            '--extractor-args': 'youtube:player_client=android',
            // Help with region restrictions
            '--geo-bypass': true,
            '--geo-bypass-country': 'US',
        };
        const cookiesPath = process.env.YT_DLP_COOKIES;
        const cookiesFromBrowserProfile = process.env.YT_DLP_COOKIES_FROM_BROWSER_PROFILE; // e.g., 'chrome:Default'
        const cookiesFromBrowser = process.env.YT_DLP_COOKIES_FROM_BROWSER; // e.g., 'chrome'
        if (cookiesPath) {
            ytOpts['--cookies'] = cookiesPath;
        }
        else if (cookiesFromBrowserProfile) {
            ytOpts['--cookies-from-browser'] = cookiesFromBrowserProfile;
        }
        else if (cookiesFromBrowser) {
            ytOpts['--cookies-from-browser'] = cookiesFromBrowser;
        }
        else {
            // Frictionless default: try Chrome profile automatically per platform
            // Windows/Mac/Linux default profile name is usually 'Default'
            const defaultProfile = 'chrome:Default';
            ytOpts['--cookies-from-browser'] = defaultProfile;
        }
        // Log safe snapshot of yt-dlp config (exclude file contents)
        const safeLog = {
            f: ytOpts.f,
            o: ytOpts.o ? String(ytOpts.o).replace(/\\\\/g, '/') : undefined,
            ua: ytOpts['--user-agent'] ? 'set' : 'unset',
            extractorArgs: ytOpts['--extractor-args'],
            geoBypass: ytOpts['--geo-bypass'],
            geoCountry: ytOpts['--geo-bypass-country'],
            cookies: cookiesPath ? 'file' : (cookiesFromBrowserProfile || cookiesFromBrowser ? `browser:${cookiesFromBrowserProfile || cookiesFromBrowser}` : 'none'),
        };
        console.log('[worker] yt-dlp config', { jobId, yt: safeLog });
        try {
            await runYtDlp(req.url, ytOpts);
        }
        catch (e) {
            const errText = String(e?.stderr || e?.message || e || '');
            const APP_GATE_MSG = 'The following content is not available on this app';
            if (errText.includes(APP_GATE_MSG)) {
                // Retry with a different player client that often bypasses the gate
                const ytOptsRetry1 = { ...ytOpts, '--extractor-args': 'youtube:player_client=web' };
                console.error('[worker] yt-dlp retry#1 with web client due to app gate', { jobId });
                try {
                    await runYtDlp(req.url, ytOptsRetry1);
                }
                catch (e2) {
                    // Second retry: switch UA again and force no-redirect client
                    const ytOptsRetry2 = {
                        ...ytOptsRetry1,
                        '--user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
                    };
                    console.error('[worker] yt-dlp retry#2 with alternate UA', { jobId });
                    await runYtDlp(req.url, ytOptsRetry2).catch((e3) => {
                        throw new Error(`yt-dlp failed after retries: ${e3?.stderr || e3?.message || String(e3)}`);
                    });
                }
            }
            else {
                throw new Error(`yt-dlp failed: ${errText}`);
            }
        }
        finally {
            clearInterval(keepalive1);
        }
        console.log('[worker] Download complete', { jobId });
        // Immediately bump to 60% to reflect download completion
        await sendCallback(jobId, { status: 'transcoding', progress: 60 });
        // Discover actual downloaded file path (raw.<ext>)
        const dirEntries = await fs.readdir(workdir, { withFileTypes: true });
        const rawCandidate = dirEntries
            .filter((d) => d.isFile() && d.name.startsWith('raw.'))
            .map((d) => path.join(workdir, d.name))
            // Prefer video container files first
            .sort((a, b) => {
            const pref = ['.mp4', '.mkv', '.webm', '.m4v'];
            const extA = path.extname(a).toLowerCase();
            const extB = path.extname(b).toLowerCase();
            return pref.indexOf(extA) - pref.indexOf(extB);
        })[0];
        if (!rawCandidate) {
            throw new Error('Could not locate downloaded media from yt-dlp');
        }
        console.log('[worker] Discovered input', { jobId, rawCandidate });
        // Start transcoding at 65% to avoid regressions in the UI
        await sendCallback(jobId, { status: 'transcoding', progress: 65 });
        // Use system ffmpeg binary
        console.log('[worker] Transcoding start', { jobId, ffmpeg: 'ffmpeg' });
        let transcodeProgress = 65;
        const keepalive2 = setInterval(() => {
            transcodeProgress = Math.min(transcodeProgress + 3, 90);
            sendCallback(jobId, { status: 'transcoding', progress: transcodeProgress });
        }, 2000);
        const ffArgs = [
            '-y',
            '-i', rawCandidate,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-profile:v', 'baseline',
            '-level', '3.1',
            '-c:a', 'aac',
            '-movflags', '+faststart',
        ];
        if (TRIM_SECONDS > 0) {
            ffArgs.push('-t', String(TRIM_SECONDS));
        }
        ffArgs.push(outPath);
        await execCmd('ffmpeg', ffArgs).finally(() => clearInterval(keepalive2));
        console.log('[worker] Transcoding complete', { jobId, outPath });
        await sendCallback(jobId, { status: 'uploading', progress: 90 });
        let mediaUrl = '';
        let cfUid;
        if (GCS_BUCKET) {
            const storage = new Storage();
            const bucket = storage.bucket(GCS_BUCKET);
            const dest = `ingest/${jobId}.mp4`;
            await bucket.upload(outPath, { destination: dest, contentType: 'video/mp4' });
            // Make public URL (or configure signed URLs as needed)
            await bucket.file(dest).makePublic().catch(() => { });
            mediaUrl = `https://storage.googleapis.com/${GCS_BUCKET}/${dest}`;
        }
        else if (CF_ACCOUNT_ID && CF_API_TOKEN) {
            // Upload to Cloudflare Stream via direct upload + tus
            // 1) Create direct upload
            const cfResp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/direct_upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ requireSignedURLs: false, thumbnailTimestampPct: 0 }),
            });
            if (!cfResp.ok) {
                const t = await cfResp.text().catch(() => '');
                throw new Error(`Cloudflare direct_upload create failed: ${cfResp.status} ${t}`);
            }
            const cfJson = await cfResp.json();
            const uploadURL = cfJson?.result?.uploadURL;
            cfUid = cfJson?.result?.uid;
            if (!uploadURL || !cfUid) {
                throw new Error('Cloudflare direct_upload response missing uploadURL or uid');
            }
            // 2) Upload file via tus from Node (dynamically import to avoid hard dependency)
            let Tus = null;
            try {
                const mod = await import('tus-js-client');
                Tus = { Upload: mod.Upload, NodeHttpStack: mod.NodeHttpStack };
            }
            catch (e) {
                throw new Error('tus-js-client is required for Cloudflare uploads but is not installed.');
            }
            const stat = fsSync.statSync(outPath);
            const stream = fsSync.createReadStream(outPath);
            await new Promise((resolve, reject) => {
                const uploader = new Tus.Upload(stream, {
                    endpoint: uploadURL,
                    uploadSize: stat.size,
                    retryDelays: [500, 1000, 2000, 5000],
                    httpStack: new Tus.NodeHttpStack(),
                    metadata: { filename: `${jobId}.mp4`, filetype: 'video/mp4' },
                    onError: (error) => reject(error),
                    onSuccess: () => resolve(),
                    onProgress: (bytesSent, bytesTotal) => {
                        const p = Math.max(90, Math.min(99, Math.floor((bytesSent / bytesTotal) * 100)));
                        sendCallback(jobId, { status: 'uploading', progress: p });
                    },
                });
                uploader.start();
            });
            // For CF we prefer returning cfUid; mediaUrl left empty
        }
        else {
            // No bucket/CF: serve the local file via worker's static /media route (dev only)
            mediaUrl = `${WORKER_PUBLIC_URL}/media/ingest/${jobId}.mp4`;
        }
        console.log('[worker] Upload/serve ready', { jobId, mediaUrl });
        await sendCallback(jobId, { status: 'finalizing', progress: 95 });
        await sendCallback(jobId, {
            status: 'completed',
            progress: 100,
            mediaUrl,
            cfUid,
            cfStatus: cfUid ? 'uploaded' : undefined,
            title: 'Ingested video',
            channel: undefined,
        });
        console.log('[worker] Ingest completed', { jobId });
    }
    catch (e) {
        const msg = e?.message || String(e);
        await sendCallback(jobId, {
            status: 'failed',
            progress: 0,
            error: `Worker ingest failed: ${msg}. Using bundled yt-dlp/ffmpeg; check network access and input URL.`,
        });
        console.error('[worker] Ingest failed', { jobId, error: msg });
    }
    finally {
        // Cleanup (best effort)
        try {
            await fs.rm(workdir, { recursive: true, force: true });
        }
        catch { }
        clearTimeout(watchdog);
    }
}
