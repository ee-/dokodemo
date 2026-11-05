import wisp from 'wisp-worker/src/index.js'

type Env = {
  ASSETS: Fetcher
  ALLOW_HOSTNAME: string
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/wisp/') {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('WebSocket required', { status: 426 })
      }
      if (request.headers.get('origin') !== url.origin) {
        return new Response('Cross-origin tunnel access denied', { status: 403 })
      }
      if (!env.ALLOW_HOSTNAME?.trim()) {
        return new Response('Configure ALLOW_HOSTNAME before opening the tunnel', { status: 503 })
      }
      return wisp.fetch(request, env, ctx)
    }
    if (request.headers.has('upgrade')) return new Response('Not found', { status: 404 })
    return env.ASSETS.fetch(request)
  },
}
