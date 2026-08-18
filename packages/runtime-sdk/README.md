# @wave-av/runtime-sdk

Thin TypeScript SDK for the [WAVE Runtime API](https://runtime.wave.online).

## Install

```sh
npm install @wave-av/runtime-sdk
```

## Usage

```ts
import { WaveRuntime } from '@wave-av/runtime-sdk';

const rt = new WaveRuntime({ apiKey: process.env.WAVE_API_KEY! });

// One-shot
const { content, usage } = await rt.chat({
  model: 'qwen3.7-flash',
  messages: [{ role: 'user', content: 'Hello' }],
});
console.log(content, usage);

// Streaming
for await (const chunk of rt.chatStream({
  model: 'qwen3.7-flash',
  messages: [{ role: 'user', content: 'Hello' }],
})) {
  process.stdout.write(chunk.content);
  if (chunk.done) console.log('\nUsage:', chunk.usage);
}
```

The runtime meters usage per request and returns it on the finish chunk (streaming) or in the response body (one-shot).
