import { spawn } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

export type LocalTranscript = {
  text: string;
  silent: boolean;
};

const SCRIPT = path.join(process.cwd(), 'scripts', 'vosk_transcribe.py');
const MODEL = path.join(process.cwd(), '.cache', 'vosk', 'vosk-model-small-en-us-0.15');

function runScript(inputPath: string, options?: { keep?: boolean; timeoutMs?: number }) {
  return new Promise<LocalTranscript>((resolve, reject) => {
    const env = {
      ...process.env,
      VOSK_MODEL_PATH: MODEL,
      VOSK_LOG_LEVEL: '-1',
      ...(options?.keep ? { VOSK_KEEP: '1' } : {})
    } as NodeJS.ProcessEnv;
    const child = spawn('python', [SCRIPT, inputPath], {
      env,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Transcription took too long.'));
    }, options?.timeoutMs ?? 180_000);

    child.stdout.on('data', (chunk) => {
      stdout = (stdout + chunk.toString()).slice(-1_500_000);
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const line = stdout
        .trim()
        .split(/\r?\n/)
        .reverse()
        .find((entry) => entry.trim().startsWith('{'));
      if (!line) {
        reject(new Error(stderr.trim().slice(-400) || `Transcription exited ${code}`));
        return;
      }
      const parsed = JSON.parse(line) as { ok?: boolean; text?: string; silent?: boolean; error?: string };
      if (!parsed.ok) {
        reject(new Error(parsed.error || 'Transcription failed'));
        return;
      }
      resolve({ text: parsed.text || '', silent: Boolean(parsed.silent) || !parsed.text });
    });
  });
}

export async function transcribeLocalPath(inputPath: string) {
  return runScript(inputPath);
}

export async function transcribeWholeFile(inputPath: string) {
  return runScript(inputPath, { keep: true, timeoutMs: 60 * 60 * 1000 });
}

export async function transcribeLocalBytes(bytes: Buffer, extension = 'media') {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'carrot-asr-'));
  const safeExtension = extension.replace(/[^\w]/g, '') || 'media';
  const inputPath = path.join(dir, `input.${safeExtension}`);
  try {
    await writeFile(inputPath, bytes);
    return await runScript(inputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function transcribeLocalUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read media (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || '';
  const extension = contentType.includes('video') ? 'mp4' : contentType.includes('webm') ? 'webm' : 'media';
  return transcribeLocalBytes(bytes, extension);
}
