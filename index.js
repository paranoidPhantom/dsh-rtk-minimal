// One listener on the `tools/execute` waterfall, which sits downstream of the
// LLM adapter, so it applies to any provider route (including `llm-pi-ai`).
// `rtk rewrite` exit codes: 0 allow, 3 ask (adopted — the user mounted this),
// 1 no equivalent, 2 deny rule, other = spawn failure. Only 0/3 rewrite;
// everything else runs untouched, so a broken rtk can never fail a tool call.
// RTK_PREFIX_ONLY=1 runs `rtk <cmd>` directly; DSH_RTK_BIN pins the binary.
import { execFileSync } from 'node:child_process'

export const name = 'rtk-minimal'

function rtk(cmd) {
  let out = ''
  let code = 0
  try {
    out = execFileSync(process.env.DSH_RTK_BIN || 'rtk', ['rewrite', cmd], {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch (err) {
    if (typeof err.status !== 'number') return null
    code = err.status
    out = String(err.stdout ?? '')
  }
  out = out.trim()
  return (code === 0 || code === 3) && out !== '' && out !== cmd ? out : null
}

export function apply(ctx) {
  return ctx.on('tools/execute', (exec, next) => {
    const call = exec.arguments
    if (exec.name !== 'bash' || typeof call?.command !== 'string') return next()

    const command = process.env.RTK_PREFIX_ONLY ? `rtk ${call.command}` : rtk(call.command)
    if (command === null) return next()

    // The body reads `exec.arguments` at dispatch time; restore afterwards so
    // the transcript keeps the command the model actually asked for.
    exec.arguments = { ...call, command }
    return Promise.resolve(next()).finally(() => {
      exec.arguments = call
    })
  })
}
