import LibcurlClient from '/libcurl/index.mjs'

const form = document.querySelector('form')
const input = document.querySelector('#url')
const button = document.querySelector('button')
const status = document.querySelector('#status')
const iframe = document.querySelector('iframe')

try {
  await navigator.serviceWorker.register('/sw.js')
  const registration = await navigator.serviceWorker.ready
  if (!navigator.serviceWorker.controller) {
    await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
  }
  const wisp = new URL('/wisp/', location.href)
  wisp.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const controller = new $scramjetController.Controller({
    serviceworker: registration.active,
    transport: new LibcurlClient({ wisp: wisp.href, connections: [6, 6, 2] }),
  })
  await controller.wait()
  const frame = controller.createFrame(iframe)
  const navigate = () => {
    try {
      const url = new URL(input.value)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Enter an HTTP(S) URL without credentials')
      }
      status.textContent = 'Opening through this Worker’s /wisp/ tunnel…'
      frame.go(url.href)
    } catch (error) {
      status.textContent = error.message
    }
  }
  iframe.addEventListener('load', () => {
    status.textContent = 'Page loaded through Scramjet. Playback and upstream access may still be restricted.'
  })
  form.addEventListener('submit', event => {
    event.preventDefault()
    navigate()
  })
  button.disabled = false
  input.value = new URL(location.href).searchParams.get('url') || input.value
  navigate()
} catch (error) {
  status.textContent = `Proxy startup failed: ${error.message}`
  console.error(error)
}
