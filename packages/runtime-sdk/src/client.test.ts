import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaveRuntime } from './client.js';

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeStreamResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n'));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('WaveRuntime', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('chat returns content and usage', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        choices: [{ message: { content: 'Hello there' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    );

    const rt = new WaveRuntime({ apiKey: 'test-key' });
    const result = await rt.chat({
      model: 'qwen3.7-flash',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content).toBe('Hello there');
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
    expect(result.raw).toBeDefined();
  });

  it('chat carries the apiKey as Bearer auth', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ choices: [{ message: { content: 'ok' } }] }),
    );

    const rt = new WaveRuntime({ apiKey: 'sk-my-key' });
    await rt.chat({ model: 'm', messages: [{ role: 'user', content: 'x' }] });

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer sk-my-key');
  });

  it('chat throws on non-200 with upstream message', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ error: 'rate limited' }, 429),
    );

    const rt = new WaveRuntime({ apiKey: 'k' });
    await expect(
      rt.chat({ model: 'm', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toThrow('Runtime API error 429');
  });

  it('chatStream accumulates chunks and surfaces [DONE]', async () => {
    const lines = [
      'data: {"choices":[{"delta":{"content":"He"}}]}',
      'data: {"choices":[{"delta":{"content":"llo"}}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}',
      'data: [DONE]',
    ];
    fetchSpy.mockResolvedValueOnce(makeStreamResponse(lines));

    const rt = new WaveRuntime({ apiKey: 'k' });
    const chunks: { content: string; done: boolean }[] = [];
    for await (const chunk of rt.chatStream({
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
    })) {
      chunks.push({ content: chunk.content, done: chunk.done });
    }

    expect(chunks).toEqual([
      { content: 'He', done: false },
      { content: 'Hello', done: false },
      { content: 'Hello', done: true },
    ]);
  });
});
