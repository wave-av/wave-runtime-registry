/** A single message in the chat conversation. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Usage information returned by the runtime. */
export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Result of a non-streaming chat completion. */
export interface ChatResult {
  content: string;
  usage?: Usage;
  raw: unknown;
}

/** A single chunk from a streaming response. */
export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: Usage;
}

/** Options for constructing a WaveRuntime client. */
export interface WaveRuntimeOptions {
  /** API key for authenticating with the WAVE runtime. */
  apiKey: string;
  /** Base URL of the runtime API. Defaults to https://runtime.wave.online */
  baseUrl?: string;
}

/** Parameters for a chat completion request. */
export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  stream?: boolean;
  tools?: unknown[];
}

interface SSEEvent {
  data: string;
}

const DEFAULT_BASE_URL = 'https://runtime.wave.online';

/**
 * Thin TypeScript SDK for the WAVE Runtime API.
 *
 * Wraps `/v1/chat/completions` with typed helpers for both
 * one-shot and streaming completions, surfacing usage metrics
 * returned by the runtime.
 */
export class WaveRuntime {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: WaveRuntimeOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  /**
   * Send a non-streaming chat completion request.
   *
   * Returns the assistant message content, usage metrics, and the
   * raw response body for inspection or passthrough.
   */
  async chat(params: ChatParams): Promise<ChatResult> {
    const body = { ...params, stream: false };
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Runtime API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const content = json.choices?.[0]?.message?.content ?? '';
    const usage = json.usage
      ? {
          promptTokens: json.usage.prompt_tokens,
          completionTokens: json.usage.completion_tokens,
          totalTokens: json.usage.total_tokens,
        }
      : undefined;

    return { content, usage, raw: json };
  }

  /**
   * Send a streaming chat completion request.
   *
   * Yields chunks as they arrive over SSE. Each chunk contains the
   * accumulated delta content so far, a `done` flag, and usage
   * metrics when the runtime emits them on the finish chunk.
   */
  async *chatStream(params: ChatParams): AsyncGenerator<StreamChunk> {
    const body = { ...params, stream: true };
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Runtime API error ${res.status}: ${text}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            yield { content: accumulated, done: true };
            return;
          }

          try {
            const event = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
              usage?: {
                prompt_tokens?: number;
                completion_tokens?: number;
                total_tokens?: number;
              };
            };

            const delta = event.choices?.[0]?.delta?.content ?? '';
            accumulated += delta;

            const usage = event.usage
              ? {
                  promptTokens: event.usage.prompt_tokens,
                  completionTokens: event.usage.completion_tokens,
                  totalTokens: event.usage.total_tokens,
                }
              : undefined;

            yield { content: accumulated, done: false, usage };
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
