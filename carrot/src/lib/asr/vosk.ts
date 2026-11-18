// Speech recognition runs on this machine with the open-source Vosk model.
import { transcribeLocalUrl } from './localVosk';

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
  try {
    const result = await transcribeLocalUrl(req.audioUrl);
    const transcription = result.text || (result.silent ? 'No speech detected.' : '');
    if (!transcription) return { success: false, postId: req.postId, error: 'No speech detected' };
    return { success: true, postId: req.postId, transcription, status: 'completed' };
  } catch (error) {
    return {
      success: false,
      postId: req.postId,
      error: error instanceof Error ? error.message : 'transcription failed',
    };
  }
}
