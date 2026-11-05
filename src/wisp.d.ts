declare module 'wisp-worker/src/index.js' {
  const handler: {
    fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response>
  }
  export default handler
}
