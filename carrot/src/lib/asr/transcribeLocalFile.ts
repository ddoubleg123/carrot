export async function transcribeLocalFile(file: Blob, filename = 'media') {
  const body = new FormData();
  body.append('file', file, filename);
  const response = await fetch('/api/transcribe/file', { method: 'POST', body });
  const data = (await response.json().catch(() => ({}))) as { text?: string; silent?: boolean; error?: string };
  if (!response.ok) throw new Error(data.error || 'Transcription failed');
  return { text: typeof data.text === 'string' ? data.text : '', silent: Boolean(data.silent) };
}
