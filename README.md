# Dokodemo — single-Worker browsing proxy PoC

One Cloudflare Worker hosts the browser assets and a `/wisp/` WebSocket tunnel.
Scramjet rewrites websites in the browser; libcurl sends traffic through that
same Worker's TCP relay. No public Wisp server, external asset CDN, VPS, database,
or Durable Object is required.

This is a technical proof of concept, not a claim of reliable YouTube playback.
It replaces the previous single-origin `UPSTREAM` reverse proxy.

## Run

Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open the local URL printed by Wrangler. Paste an absolute HTTP(S) URL and press
**Go**. The default destination is `https://www.google.com/`.

To attempt YouTube, use an ordinary public watch URL, for example:

```text
https://www.youtube.com/watch?v=M7lc1UVf-VE
```

The browser requires a secure context: HTTPS when deployed, or localhost during
development. Prebuilt JS/WASM files are copied from pinned npm packages; Rust and
a frontend framework are not needed to build this PoC.

## Deploy

```sh
npx wrangler login
npm run deploy
```

Only the Worker and its Static Assets binding are deployed. `npm run build` is a
local deployment dry run; `npm run typecheck` and `npm test` check the Worker and
its tunnel access guards. None of these commands deploys unless you run `deploy`.

`ALLOW_HOSTNAME` in `wrangler.toml` permits Google, YouTube, and their related
resource domains. Other destinations are rejected by the relay. Extend this list
when deliberately testing a different site. Missing configuration fails closed.
Private and loopback destinations are blocked by default. The browser uses only
the same-origin `/wisp/` endpoint; cross-origin WebSocket handshakes are rejected.
This origin check is not authentication.

## What was actually verified

Local browser checks against Wrangler's real Workers runtime:

- The Google homepage renders through Scramjet and the same-Worker Wisp tunnel.
- A YouTube watch page renders, but its player says **"Sign in to confirm you're
  not a bot"**. The video remains paused at time 0; playback has not been proved.
- A temporary, controlled HTTP upstream served an MP4 with byte-range support.
  Through the complete proxy, playback advanced, audio and video frames decoded,
  seeking landed at 40 seconds, and playback resumed beyond 41 seconds. The
  upstream received `Range` requests and the browser received `206` responses
  with matching `Content-Range` headers.
- During those captured navigations, the Wisp socket was
  `ws://localhost:18787/wisp/`; no direct browser HTTP requests to the upstream
  origins were observed.
- The regression test checks cross-origin tunnel denial and refusal of a
  non-allowlisted Wisp destination without contacting the Internet.

The temporary media upstream was a test target, not an application backend. It
and its localhost-only relay overrides are not part of the deployed app. The
media sample was Blender Foundation's Sintel trailer, obtained from the
[Chrome Media Session sample](https://googlechrome.github.io/samples/media-session/video.html).
A successful controlled media test does **not** establish YouTube playback.

## Hosting and cost

Workers Free costs $0 (100,000 requests/day, 10 ms CPU per invocation). Workers
Paid starts at $5/month and includes 10 million requests, 30 million CPU
milliseconds, and free egress; extra usage is billed per million requests and per
million CPU milliseconds. WebSocket upgrades count as one request and relayed
messages are not billed as requests. See the
[Workers pricing page](https://developers.cloudflare.com/workers/platform/pricing/).

Two platform limits matter more than price for this workload:

- **Six simultaneous outbound connections per invocation**, on both plans. One
  Wisp connection is one invocation, so a browser tunnel gets at most six
  in-flight TCP streams. Video playback requests more than that.
- **10 ms CPU per invocation on Free**, which sustained relaying can exceed; Paid
  raises the budget but not the connection limit.

An already-paid Lightsail instance running Node is therefore a reasonable host
for the tunnel: it has no per-invocation connection or CPU cap, supports UDP, and
can serve the static assets from the same origin. Serve it over HTTPS and keep
`ALLOW_HOSTNAME` plus authentication enabled, or the machine becomes an open TCP
relay into its own network.

Moving hosts does not fix the seek stalls observed locally. Both causes travel
with the client code: the per-host connection cap in `public/app.js` and dropped
abort signals that leave earlier requests running. Fix cancellation and re-check
that cap after any move.

## Limits

- Live Cloudflare deployment, sustained video playback, and Free-plan CPU usage
  have not been verified. A successful local run does not establish Free-plan
  capacity. Watch CPU metrics and `1102` errors during a deployed experiment.
- Cloudflare TCP restrictions and per-invocation connection limits apply. The
  transport is configured for six active connections, with two per host. UDP is
  not supported. See [Workers TCP limits](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/).
- Requests to hosts outside `ALLOW_HOSTNAME` fail before TCP connects. The relay
  returns Wisp close reason `0x48` (`HOST_BLOCKED`), which surfaces in the page as
  `Internal Service Worker Error: TypeError: Request failed with error code 7:
  Could not connect to server`. Add the site and its resource domains, then
  restart the dev server or redeploy.
- This has no authentication. Do not expose it as an unrestricted public proxy or
  use it for sensitive accounts. Use a dedicated hostname; proxied content and
  the controller share a real browser origin, and Scramjet is experimental.
- Google/YouTube can require consent, challenges, or login. There is no challenge
  workaround, login automation, server-side video extraction, or transcoding.

## Reused code and licenses

The original Dokodemo MIT / Apache-2.0 notices remain in `LICENSE_MIT` and
`LICENSE_APACHE`. The bundled proxy stack includes AGPL-licensed code; the combined
PoC must not be represented as permissive-only software. The asset build serves
the AGPL license at `/libcurl/LICENSE`.

Pinned upstream sources:

- [Scramjet](https://github.com/MercuryWorkshop/scramjet), npm `2.0.67-alpha.2`.
- [Scramjet Controller](https://www.npmjs.com/package/@mercuryworkshop/scramjet-controller), `0.0.14`; its runtime guard expects that exact Scramjet version.
- [libcurl transport](https://github.com/MercuryWorkshop/libcurl-transport), `2.0.6`.
- [Worker Wisp adapter](https://github.com/alpgul/worker-wisp-server/tree/c226c6547377fc1b2cfd6428f9e27a00442618f4), pinned source commit; its optional Durable Object limiter is not configured here.

Publish the corresponding source and preserve upstream notices when distributing
or hosting this stack. No upstream protocol implementation was copied into
Dokodemo's maintained source files.
