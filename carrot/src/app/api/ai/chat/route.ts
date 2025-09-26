import { chatStream, type ChatMessage } from '@/lib/llm/providers/DeepSeekClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const { provider = 'deepseek', model = 'deepseek-v3', messages = [], temperature = 0.3, max_tokens = 1024 } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('messages required', { status: 400 });
    }

    if (provider !== 'deepseek') {
      return new Response('unsupported provider', { status: 400 });
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event: string) => controller.enqueue(enc.encode(`data: ${event}\n\n`));
        try {
          for await (const chunk of chatStream({ model, messages: messages as ChatMessage[], temperature, max_tokens })) {
            if (chunk.type === 'token' && chunk.token) {
              send(JSON.stringify({ type: 'token', token: chunk.token }));
            } else if (chunk.type === 'error') {
              send(JSON.stringify({ type: 'error', error: chunk.error }));
              break;
            } else if (chunk.type === 'done') {
              send(JSON.stringify({ type: 'done', usage: chunk.usage }));
              break;
            }
          }
        } catch (e: any) {
          send(JSON.stringify({ type: 'error', error: String(e?.message || e) }));
        } finally {
          controller.enqueue(enc.encode('data: [DONE]\n\n'));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      }
    });
  } catch (e: any) {
    return new Response(`Bad request: ${String(e?.message || e)}`, { status: 400 });
  }
}
