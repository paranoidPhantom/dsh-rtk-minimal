// Smoke test with a fake `rtk` binary — no DSH needed.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const bin = join(mkdtempSync(join(tmpdir(), 'rtk-')), 'rtk')
writeFileSync(
  bin,
  '#!/bin/sh\n[ "$1" = rewrite ] || exit 1\necho "rtk $2"\nexit ${FAKE_EXIT:-0}\n',
)
chmodSync(bin, 0o755)
process.env.DSH_RTK_BIN = bin

const { apply } = await import('./index.js')

// Minimal stand-in for the DSH tool registry: `next` reads exec.arguments at
// dispatch time, exactly like dispatchToolBody does.
function harness({ name = 'bash', command = 'git status' } = {}) {
  let listener
  apply({ on: (_n, fn) => (listener = fn) })
  const exec = { name, arguments: { command } }
  const ran = []
  const next = async () => {
    ran.push(exec.arguments.command)
    return { isError: false, value: 'ok' }
  }
  return { exec, next, ran, run: () => listener(exec, next) }
}

test('rewrites bash and restores the original arguments', async () => {
  const h = harness()
  await h.run()
  assert.deepEqual(h.ran, ['rtk git status'])
  assert.equal(h.exec.arguments.command, 'git status')
})

test('adopts the rewrite on exit code 3 (ask)', async () => {
  process.env.FAKE_EXIT = '3'
  const h = harness()
  await h.run()
  delete process.env.FAKE_EXIT
  assert.deepEqual(h.ran, ['rtk git status'])
})

test('passes through when rtk has no equivalent (exit 1)', async () => {
  process.env.FAKE_EXIT = '1'
  const h = harness()
  await h.run()
  delete process.env.FAKE_EXIT
  assert.deepEqual(h.ran, ['git status'])
})

test('passes through other tools untouched', async () => {
  const h = harness({ name: 'grep' })
  await h.run()
  assert.deepEqual(h.ran, ['git status'])
})

test('passes through when rtk is missing', async () => {
  process.env.DSH_RTK_BIN = join(tmpdir(), 'does-not-exist-rtk')
  const h = harness()
  await h.run()
  process.env.DSH_RTK_BIN = bin
  assert.deepEqual(h.ran, ['git status'])
})

test('RTK_PREFIX_ONLY skips the rule engine', async () => {
  process.env.RTK_PREFIX_ONLY = '1'
  const h = harness({ command: 'ls -la' })
  await h.run()
  delete process.env.RTK_PREFIX_ONLY
  assert.deepEqual(h.ran, ['rtk ls -la'])
})
