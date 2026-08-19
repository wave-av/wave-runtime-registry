import { WaveRuntime } from '@wave-av/runtime-sdk';
import type { Readable, Writable } from 'node:stream';
import { createInterface } from 'node:readline';

/** JSON-RPC request shape (subset we handle). */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC response shape. */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'wave-runtime-mcp', version: '0.1.0' };

const TOOLS: ToolDefinition[] = [
  {
    name: 'runtime_chat',
    description:
      'Send a chat completion request to the WAVE runtime via runtime.wave.online.',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model identifier (e.g. qwen2.5:3b)' },
        prompt: { type: 'string', description: 'The user prompt to send' },
        maxTokens: {
          type: 'number',
          description: 'Maximum tokens in the response (optional)',
        },
      },
      required: ['model', 'prompt'],
    },
  },
  {
    name: 'runtime_models',
    description: 'List available models on the WAVE runtime with capability flags.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'runtime_usage',
    description:
      'Return the documented meter shape for a model (best-effort — meters are best-effort).',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model identifier to get usage meters for' },
      },
      required: ['model'],
    },
  },
];

const STATIC_MODELS = [
  { id: 'qwen2.5:3b', toolSupport: true },
  { id: 'qwen3-coder:30b', toolSupport: false, note: 'Content-only; pending tool-capable endpoint' },
  { id: 'gemma4:31b', toolSupport: true },
  { id: 'deepcoder:14b', toolSupport: true },
  { id: 'wave-qwen38-ad-iq3s', toolSupport: true },
];

function resolveApiKey(): string {
  const key = process.env.WAVE_RUNTIME_API_KEY ?? process.env.WAVE_GATEWAY_API_KEY;
  if (!key) {
    throw new Error(
      'Missing API key. Set WAVE_RUNTIME_API_KEY or WAVE_GATEWAY_API_KEY.',
    );
  }
  return key;
}

function errorResponse(id: number | string | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function resultResponse(id: number | string | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function handleToolsCall(
  args: Record<string, unknown>,
  runtime: WaveRuntime,
): Promise<unknown> {
  const name = args.name as string;
  const input = (args.arguments as Record<string, unknown>) ?? {};

  switch (name) {
    case 'runtime_chat': {
      const model = input.model as string;
      const prompt = input.prompt as string;
      const maxTokens = input.maxTokens as number | undefined;
      return runtime
        .chat({ model, messages: [{ role: 'user', content: prompt }], maxTokens })
        .then((res) => ({
          content: [{ type: 'text', text: res.content }],
          usage: res.usage,
        }));
    }

    case 'runtime_models':
      return Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify(STATIC_MODELS, null, 2) }],
      });

    case 'runtime_usage': {
      const model = input.model as string;
      return Promise.resolve({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                model,
                meters: [
                  {
                    name: `wave_ai_tokens_inference_${model}`,
                    description: `Token usage for ${model} (best-effort)`,
                  },
                ],
                note: 'Best-effort meter data — actual counts depend on runtime reporting.',
              },
              null,
              2,
            ),
          },
        ],
      });
    }

    default:
      return Promise.reject(new Error(`Unknown tool: ${name}`));
  }
}

export interface ServerHandle {
  /** Promise that resolves when the server shuts down. */
  ready: Promise<void>;
  /** Signal the server to shut down. */
  stop(): void;
}

/**
 * Run the MCP server over a readable/writable stream pair.
 * Returns a handle so callers can await shutdown.
 */
export function runServer(
  input: Readable,
  output: Writable,
): ServerHandle {
  let runtime: WaveRuntime;
  try {
    const apiKey = resolveApiKey();
    runtime = new WaveRuntime({ apiKey });
  } catch (err) {
    return {
      ready: Promise.reject(err),
      stop() {},
    };
  }

  const rl = createInterface({ input });
  let stopped = false;
  let resolveDone: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const write = (msg: JsonRpcResponse) => {
    output.write(JSON.stringify(msg) + '\n');
  };

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let req: JsonRpcRequest;
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      return;
    }

    if (req.method === 'notifications/initialized') return;

    try {
      let result: unknown;

      switch (req.method) {
        case 'initialize':
          result = {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: SERVER_INFO,
          };
          break;

        case 'tools/list':
          result = { tools: TOOLS };
          break;

        case 'tools/call':
          result = await handleToolsCall(
            req.params as Record<string, unknown>,
            runtime,
          );
          break;

        default:
          write(errorResponse(req.id, -32601, `Method not found: ${req.method}`));
          return;
      }

      write(resultResponse(req.id, result));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      write(errorResponse(req.id, -32000, message));
    }
  });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    rl.close();
    resolveDone();
  };

  rl.on('close', stop);

  return { ready: done, stop };
}

// Self-start when executed as the bin (node dist/server.js): wire stdio and run until stdin closes.
// The bin MUST self-start — an export-only module runs and exits silently (the 0.1.0 bug).
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
// macOS /tmp is a symlink to /private/tmp — URL comparison alone never matches; compare realpaths.
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  runServer(process.stdin, process.stdout);
}
