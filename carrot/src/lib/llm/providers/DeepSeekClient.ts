import { ReadableStream } from 'stream/web';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface StreamChunk {
  type: 'token' | 'done' | 'error';
  token?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: string;
}

const DEFAULT_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

function hasKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

async function* mockStream(_: ChatParams): AsyncGenerator<StreamChunk> {
  const demo = 'This is a DeepSeek mock stream. Add DEEPSEEK_API_KEY to use the real API.';
  for (const ch of demo.split(' ')) {
    await new Promise(r => setTimeout(r, 80));
    yield { type: 'token', token: ch + ' ' };
  }
  yield { type: 'done', usage: { prompt_tokens: 0, completion_tokens: demo.length / 4, total_tokens: demo.length / 4 } };
}

export async function* chatStream(params: ChatParams): AsyncGenerator<StreamChunk> {
  if (!hasKey()) {
    yield* mockStream(params);
    return;
  }

  const body = {
    model: params.model || 'deepseek-chat',
    messages: params.messages,
    temperature: params.temperature ?? 0.3,
    max_tokens: params.max_tokens ?? 1024,
    stream: true,
  };

  const resp = await fetch(DEFAULT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '');
    yield { type: 'error', error: `DeepSeek HTTP ${resp.status}: ${text.slice(0,200)}` };
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') {
            yield { type: 'done' };
            return;
          }
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content || '';
            if (delta) yield { type: 'token', token: delta };
            // Optionally emit usage when provided at end
            const usage = json?.usage;
            if (usage && (usage.prompt_tokens || usage.completion_tokens)) {
              yield { type: 'done', usage };
              return;
            }
          } catch {
            // Ignore malformed lines
          }
        }
      }
    }
  } catch (e: any) {
    yield { type: 'error', error: String(e?.message || e) };
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}
