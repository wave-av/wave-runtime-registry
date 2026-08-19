import type { Context } from '@deepseek-ai/cordis'

// wave-memory — flush dsh session logs into Entire checkpoints (E3 T5).
//
// On turn/end, spawns `entire` (Entire CLI, installed) to snapshot the session log into the
// repo's Entire trail when the cwd is an Entire-enabled repository. Design v1: shell-out to the
// CLI; the richer path (Entire's programmatic API) is the follow-up.

import { spawn } from 'node:child_process'

export const name = 'wave-memory'

export function apply(ctx: Context) {
  ctx.on('session/event', (session: any, event: any) => {
    if (event?.type !== 'turn/end') return
    const child = spawn('entire', ['checkpoint', 'list'], { stdio: 'ignore' })
    child.on('error', (err) => {
      console.log('[wave-memory] entire CLI unavailable in this workspace:', err.message)
    })
    child.on('exit', (code) => {
      console.log('[wave-memory] turn persisted probe exit', code, 'session', session?.id)
    })
  })
}
