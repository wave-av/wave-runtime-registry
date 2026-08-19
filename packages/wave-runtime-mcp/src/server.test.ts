import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runServer } from './server.js';
import { PassThrough } from 'node:stream';

// Mock the runtime-sdk module
vi.mock('@wave-av/runtime-sdk', () => {
  return {
    WaveRuntime: vi.fn().mockImplementation(() => ({
      chat: vi.fn().mockResolvedValue({
        content: 'Hello from mocked runtime!',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        raw: {},
      }),
    })),
  };
});

beforeEach(() => {
  process.env.WAVE_RUNTIME_API_KEY = 'test-key-123';
});

function sendLine(input: PassThrough, obj: unknown) {
  input.write(JSON.stringify(obj) + '\n');
}

async function readLine(output: PassThrough): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for line')), 5000);
    output.once('data', (chunk: Buffer) => {
      clearTimeout(timeout);
      const line = chunk.toString().trim();
      resolve(JSON.parse(line));
    });
  });
}

describe('wave-runtime-mcp', () => {
  it('handles initialize round-trip', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const server = runServer(input, output);

    sendLine(input, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });

    const res = (await readLine(output)) as Record<string, unknown>;
    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    expect(res.result).toMatchObject({
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'wave-runtime-mcp', version: '0.1.2' },
    });

    server.stop();
    await server.ready;
  });

  it('returns 3 tools on tools/list', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const server = runServer(input, output);

    sendLine(input, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    await readLine(output);

    sendLine(input, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });

    const res = (await readLine(output)) as Record<string, unknown>;
    expect(res.id).toBe(2);
    const tools = (res.result as { tools: unknown[] }).tools;
    expect(tools).toHaveLength(3);
    expect((tools[0] as { name: string }).name).toBe('runtime_chat');
    expect((tools[1] as { name: string }).name).toBe('runtime_models');
    expect((tools[2] as { name: string }).name).toBe('runtime_usage');

    server.stop();
    await server.ready;
  });

  it('routes tools/call runtime_chat through mocked WaveRuntime', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const server = runServer(input, output);

    sendLine(input, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    await readLine(output);

    sendLine(input, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'runtime_chat',
        arguments: { model: 'qwen2.5:3b', prompt: 'Hello!' },
      },
    });

    const res = (await readLine(output)) as Record<string, unknown>;
    expect(res.id).toBe(3);
    const result = res.result as { content: { type: string; text: string }[]; usage: unknown };
    expect(result.content[0].text).toBe('Hello from mocked runtime!');
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });

    server.stop();
    await server.ready;
  });

  it('ignores notifications/initialized (no response)', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const server = runServer(input, output);

    sendLine(input, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    await readLine(output);

    sendLine(input, { jsonrpc: '2.0', method: 'notifications/initialized' });

    // Give it a moment to ensure no response is written
    await new Promise((r) => setTimeout(r, 200));

    // Now send tools/list to confirm server is still alive
    sendLine(input, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const res = (await readLine(output)) as Record<string, unknown>;
    expect(res.id).toBe(2);
    expect((res.result as { tools: unknown[] }).tools).toHaveLength(3);

    server.stop();
    await server.ready;
  });
});
