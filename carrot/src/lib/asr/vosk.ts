// Vosk ASR client wrapper
export type VoskTranscribeRequest = {
  postId?: string;
  audioUrl: string;
};

export type VoskTranscribeResponse = {
  success: boolean;
  postId?: string;
  transcription?: string;
  status?: string;
  error?: string;
};

export async function transcribeWithVosk(req: VoskTranscribeRequest): Promise<VoskTranscribeResponse> {
  const base = process.env.TRANSCRIPTION_SERVICE_URL;
  if (!base) return { success: false, error: 'TRANSCRIPTION_SERVICE_URL not set' };
  const url = base.replace(/\/$/, '') + '/transcribe';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { success: false, error: `Vosk ${res.status}: ${text}` };
  }

  const data = (await res.json()) as VoskTranscribeResponse;
  return data;
}
