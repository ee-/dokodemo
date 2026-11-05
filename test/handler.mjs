import assert from 'node:assert/strict'
import test from 'node:test'
import { Miniflare } from 'miniflare'

function packet(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for Wisp packet')), 3000)
    socket.addEventListener('message', event => {
      clearTimeout(timer)
      resolve(new Uint8Array(event.data))
    }, { once: true })
  })
}

test('the tunnel rejects cross-origin access and non-allowlisted destinations', async () => {
  const worker = new Miniflare({
    modules: true,
    scriptPath: 'dist/index.js',
    compatibilityDate: '2026-07-30',
    bindings: { ALLOW_HOSTNAME: 'google.com' },
  })
  let socket
  try {
    const denied = await worker.dispatchFetch('https://proxy.example/wisp/', {
      headers: { Upgrade: 'websocket', Origin: 'https://other.example' },
    })
    assert.equal(denied.status, 403)
    await denied.text()

    const accepted = await worker.dispatchFetch('https://proxy.example/wisp/', {
      headers: { Upgrade: 'websocket', Origin: 'https://proxy.example' },
    })
    assert.equal(accepted.status, 101)
    socket = accepted.webSocket
    const ready = packet(socket)
    socket.accept()
    assert.equal((await ready)[0], 3) // Wisp v1 CONTINUE

    const blocked = packet(socket)
    // CONNECT stream 1, TCP, port 80, to a host outside the allowlist.
    socket.send(new Uint8Array([1, 1, 0, 0, 0, 1, 80, 0, ...new TextEncoder().encode('blocked.invalid')]))
    const close = await blocked
    assert.deepEqual([...close], [4, 1, 0, 0, 0, 0x48]) // CLOSE: blocked destination
  } finally {
    socket?.close(1000)
    await worker.dispose()
  }
})
