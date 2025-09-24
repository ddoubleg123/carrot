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

const DEFAULT_ENDPOINT = 'https://deepseekapi.org/v1/chat/completions';
const LOCAL_ROUTER_ENDPOINT = process.env.DEEPSEEK_ROUTER_URL || 'http://localhost:8080/v1/chat/completions';
const PROXY_ENDPOINT = process.env.DEEPSEEK_PROXY_URL;

function hasKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

function hasLocalRouter() {
  return Boolean(process.env.DEEPSEEK_ROUTER_URL || process.env.NODE_ENV === 'development');
}

function hasProxy() {
  return Boolean(PROXY_ENDPOINT);
}

async function* mockStream(params: ChatParams): AsyncGenerator<StreamChunk> {
  const demo = 'This is a DeepSeek mock response. To use the real DeepSeek API, set DEEPSEEK_API_KEY environment variable. To use the local DeepSeek infrastructure, start the router service at localhost:8080.';
  
  // Add a small delay to simulate real streaming
  await new Promise(r => setTimeout(r, 100));
  
  for (const ch of demo.split(' ')) {
    await new Promise(r => setTimeout(r, 80));
    yield { type: 'token', token: ch + ' ' };
  }
  yield { type: 'done', usage: { prompt_tokens: 0, completion_tokens: demo.length / 4, total_tokens: demo.length / 4 } };
}

export async function* chatStream(params: ChatParams): AsyncGenerator<StreamChunk> {
  // Try local router first, then proxy, then cloud API, then mock
  const useLocalRouter = hasLocalRouter();
  const useProxy = hasProxy();
  const useCloudAPI = hasKey();
  
  console.log('[DeepSeek] useLocalRouter:', useLocalRouter, 'useProxy:', useProxy, 'useCloudAPI:', useCloudAPI);
  console.log('[DeepSeek] DEEPSEEK_API_KEY exists:', !!process.env.DEEPSEEK_API_KEY);
  console.log('[DeepSeek] DEEPSEEK_ROUTER_URL:', process.env.DEEPSEEK_ROUTER_URL);
  console.log('[DeepSeek] DEEPSEEK_PROXY_URL:', PROXY_ENDPOINT);
  console.log('[DeepSeek] NODE_ENV:', process.env.NODE_ENV);
  
  if (!useLocalRouter && !useProxy && !useCloudAPI) {
    console.log('[DeepSeek] Using mock stream');
    yield* mockStream(params);
    return;
  }

  const body = {
    model: params.model || 'deepseek-v3',
    messages: params.messages,
    temperature: params.temperature ?? 0.3,
    max_tokens: params.max_tokens ?? 1024,
    stream: true,
  };

  const endpoint = useLocalRouter ? LOCAL_ROUTER_ENDPOINT : (useProxy ? PROXY_ENDPOINT : DEFAULT_ENDPOINT);
  
  if (!endpoint) {
    console.error('[DeepSeek] No valid endpoint found');
    yield { type: 'error', error: 'No valid endpoint configured' };
    return;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };

  // Add auth header for cloud API or proxy
  if ((!useLocalRouter && process.env.DEEPSEEK_API_KEY)) {
    headers['Authorization'] = `Bearer ${process.env.DEEPSEEK_API_KEY}`;
  }

  // Add task type header for local router
  if (useLocalRouter) {
    headers['X-Task-Type'] = 'chat';
  }

  console.log('[DeepSeek] Making request to:', endpoint);
  console.log('[DeepSeek] Headers:', headers);
  console.log('[DeepSeek] Body:', JSON.stringify(body, null, 2));

  let resp;
  try {
    // Try with additional fetch options for Render compatibility
    resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      // Add timeout and other options for Render compatibility
      signal: AbortSignal.timeout(30000), // 30 second timeout
      // Add additional options that might help with Render
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'omit',
    });
  } catch (fetchError: any) {
    console.error('[DeepSeek] Fetch error:', fetchError);
    console.error('[DeepSeek] Error details:', {
      message: fetchError.message,
      cause: fetchError.cause,
      stack: fetchError.stack,
      name: fetchError.name
    });
    
    // Check if it's a network/connectivity issue
    if (fetchError.message.includes('fetch failed') || fetchError.name === 'TypeError') {
      console.log('[DeepSeek] Network connectivity issue detected - using fallback response');
      yield { type: 'error', error: `Network connectivity issue: ${fetchError.message}. This may be due to Render's network restrictions.` };
    } else {
      yield { type: 'error', error: `Network error: ${fetchError.message}` };
    }
    return;
  }

  console.log('[DeepSeek] Response status:', resp.status, 'ok:', resp.ok);
  console.log('[DeepSeek] Response headers:', Object.fromEntries(resp.headers.entries()));
  
  // Log response body for debugging
  if (!resp.ok) {
    const errorText = await resp.text();
    console.log('[DeepSeek] Error response body:', errorText);
    yield { type: 'error', error: `DeepSeek HTTP ${resp.status}: ${errorText.slice(0,200)}` };
    return;
  }

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
