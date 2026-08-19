# @wave-av/wave-runtime-mcp

MCP server (stdio transport) exposing the WAVE Runtime to AI agents.
Mount it in any MCP client and agents can chat, list models, and inspect
usage meters through `runtime.wave.online`.

## Mounting

### dsh (mcp-client patch)

```json
{
  "mcpServers": {
    "wave-runtime": {
      "command": "wave-runtime-mcp",
      "env": {
        "WAVE_RUNTIME_API_KEY": "${WAVE_RUNTIME_API_KEY}"
      }
    }
  }
}
```

### Claude Desktop / opencode

```json
{
  "mcpServers": {
    "wave-runtime": {
      "command": "wave-runtime-mcp",
      "env": {
        "WAVE_RUNTIME_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Tools

### `runtime_chat`

Send a chat completion to the WAVE runtime.

| Param       | Type   | Required | Description                          |
|-------------|--------|----------|--------------------------------------|
| `model`     | string | yes      | Model ID (e.g. `qwen2.5:3b`)       |
| `prompt`    | string | yes      | The user prompt                      |
| `maxTokens` | number | no       | Max response tokens                  |

Returns the assistant content and token usage.

### `runtime_models`

List available models with capability flags.

Returns a JSON array of `{ id, toolSupport, note? }` entries:

- `qwen2.5:3b` — toolSupport: true
- `qwen3-coder:30b` — toolSupport: false (content-only; pending tool-capable endpoint)
- `gemma4:31b` — toolSupport: true
- `deepcoder:14b` — toolSupport: true
- `wave-qwen38-ad-iq3s` — toolSupport: true

### `runtime_usage`

Return the documented meter shape for a model.

| Param   | Type   | Required | Description  |
|---------|--------|----------|--------------|
| `model` | string | yes      | Model ID     |

Returns `wave_ai_tokens_inference_<model>` meter metadata (best-effort).

## Environment

| Variable              | Description                            |
|-----------------------|----------------------------------------|
| `WAVE_RUNTIME_API_KEY`  | API key (primary)                    |
| `WAVE_GATEWAY_API_KEY`  | API key (fallback if primary unset) |

**The key is never accepted from tool call parameters.**

## Development

```sh
npm install
npm run build   # tsc
npm test        # vitest run
```
