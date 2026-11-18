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
const LOCAL_ROUTER_ENDPOINT = process.env.DEEPSEEK_ROUTER_URL || 'http://localhost:8080/v1/chat/completions';
function hasKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

function hasLocalRouter() {
  return Boolean(process.env.DEEPSEEK_ROUTER_URL || process.env.NODE_ENV === 'development');
}

function tagsFromGroupPrompt(params: ChatParams) {
  const userText = params.messages.find((msg) => msg.role === 'user')?.content || '';
  const name = userText.match(/Group Name:\s*"([^"]+)"/)?.[1] || '';
  const description = userText.match(/Description:\s*"([^"]+)"/)?.[1] || '';
  const words = `${name} ${description}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const slug = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
  const tags = Array.from(new Set([slug, ...words, 'community', 'discussion', 'knowledge'].filter(Boolean))).slice(0, 8);
  return { tags, categories: ['General', 'Community'] };
}

async function* mockStream(params: ChatParams): AsyncGenerator<StreamChunk> {
  // Check if this is a group metadata generation request
  const isGroupMetadata = params.messages.some(msg => 
    msg.content && typeof msg.content === 'string' && 
    msg.content.includes('generate relevant tags and categories')
  );
  
  let demo: string;
  if (isGroupMetadata) {
    demo = JSON.stringify(tagsFromGroupPrompt(params));
  } else {
    demo = 'This is a DeepSeek mock response. To use the real DeepSeek API, set DEEPSEEK_API_KEY environment variable. To use the local DeepSeek infrastructure, start the router service at localhost:8080.';
  }
  
  // Add a small delay to simulate real streaming
  await new Promise(r => setTimeout(r, 100));
  
  for (const ch of demo.split(' ')) {
    await new Promise(r => setTimeout(r, 80));
    yield { type: 'token', token: ch + ' ' };
  }
  yield { type: 'done', usage: { prompt_tokens: 0, completion_tokens: demo.length / 4, total_tokens: demo.length / 4 } };
}

async function* readSse(resp: Response): AsyncGenerator<StreamChunk> {
  if (!resp.body) {
    yield { type: 'error', error: 'DeepSeek API returned no response body' };
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
            
            // Check for error in the response
            if (json.error) {
              console.log('[DeepSeek] API returned error:', json.error);
              yield { type: 'error', error: json.error.message || json.error };
              return;
            }
            
            const delta = json?.choices?.[0]?.delta?.content || '';
            if (delta) yield { type: 'token', token: delta };
            
            // Optionally emit usage when provided at end
            const usage = json?.usage;
            if (usage && (usage.prompt_tokens || usage.completion_tokens)) {
              yield { type: 'done', usage };
              return;
            }
          } catch (e) {
            console.log('[DeepSeek] Failed to parse JSON:', payload, e);
            // Ignore malformed lines but log them for debugging
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

export async function* chatStream(params: ChatParams): AsyncGenerator<StreamChunk> {
  // Local router first when one is configured or we are in dev. If it is not
  // running, continue to the cloud API, then to local suggestions.
  const planned: { endpoint: string; local: boolean }[] = [];
  if (hasLocalRouter()) planned.push({ endpoint: LOCAL_ROUTER_ENDPOINT, local: true });
  if (hasKey()) planned.push({ endpoint: DEFAULT_ENDPOINT, local: false });

  if (planned.length === 0) {
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

  for (const attempt of planned) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };
    if (attempt.local) headers['X-Task-Type'] = 'chat';
    if (!attempt.local && process.env.DEEPSEEK_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.DEEPSEEK_API_KEY}`;
    }

    console.log('[DeepSeek] Making request to:', attempt.endpoint);
    let resp: Response;
    try {
      resp = await fetch(attempt.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
    } catch (fetchError: any) {
      console.warn('[DeepSeek] Endpoint unreachable:', attempt.endpoint, fetchError?.cause?.code || fetchError?.message);
      continue;
    }

    if (!resp.ok) {
      const errorText = await resp.text();
      console.warn('[DeepSeek] HTTP', resp.status, 'from', attempt.endpoint, errorText.slice(0, 180));
      continue;
    }

    yield* readSse(resp);
    return;
  }

  console.warn('[DeepSeek] No endpoint responded. Using local tag suggestions.');
  yield* mockStream(params);
}
