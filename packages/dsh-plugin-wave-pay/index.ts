import type { Context } from '@deepseek-ai/cordis'

// wave-pay — inert-by-design meter plugin (E3 T3).
//
// The gateway meters usage server-side (usage.ts). This plugin's job on the dsh side is a
// sidecar meter: it watches session events for usage-bearing chunks and appends meter lines to
// $DSH_HOME/wave-meter.jsonl. It deliberately does NOT append custom events into the session
// log — rc.6 persistence refuses unknown event kinds on READ, so polluting the session stream
// would make sessions unreadable. No charges are ever made by this plugin; settlement stays a
// gateway-side concern (the paid rail).

import { homedir } from 'node:os'
import { join } from 'node:path'
import { appendFileSync, mkdirSync } from 'node:fs'

export const name = 'wave-pay'

export function apply(ctx: Context) {
  const meterPath = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'wave-meter.jsonl')
  mkdirSync(process.env.DSH_HOME || join(homedir(), '.dsh'), { recursive: true })
  console.log('[wave-pay] sidecar meter at ' + meterPath)

  ctx.on('session/event', (_session: unknown, event: any) => {
    if (event?.type === 'assistant/chunk' && event.data?.usage) {
      const line = JSON.stringify({
        t: 'wave/meter',
        time: Date.now(),
        usage: event.data.usage,
        sessionId: event.sessionId ?? undefined,
      })
      appendFileSync(meterPath, line + '\n')
    }
  })
}
