//example.com/dokodemo
const dokodemo_path = ''

async function handleRequest(request: Request): Promise<Response> {
  const proxyUrl = new URL(request.url)
  const path = proxyUrl.href.substr(proxyUrl.origin.length)
  //redirect http to https
  if (proxyUrl.protocol === 'http:') {
    proxyUrl.protocol = 'https:'
    const headers: Record<string, string> = {
      'Strict-Transport-Security':
        'max-age=31536000; includeSubDomains; preload',
      location: proxyUrl.href,
    }
    return new Response('http not allowed', { status: 301, headers: headers })
  }

  //fetch resource
  const matchArray = path.match(/\/(https?:)\/+(.*)/)
  const upstreamString = matchArray ? `${matchArray[1]}//${matchArray[2]}` : ''

  try {
    const upstreamUrl = new URL(upstreamString)
    console.log('Proxy to: ' + upstreamUrl.href)
    return proxy(request, upstreamUrl)
  } catch (error) {
    return new Response('What is that URL?', { status: 400 })
  }
}

async function proxy(request: Request, upstreamUrl: URL): Promise<Response> {
  const proxyUrl = new URL(request.url)
  let proxyHeaders = new Headers(request.headers)
  proxyHeaders.set('Host', upstreamUrl.origin)
  proxyHeaders.set('Referer', proxyUrl.origin)

  let UpstreamResponse = await fetch(upstreamUrl.href, {
    method: request.method,
    headers: proxyHeaders,
  })
  console.log('Upstream response received.')

  //modifiying response headers
  let responseHeaders = new Headers(UpstreamResponse.headers)
  responseHeaders.set('access-control-allow-origin', '*')
  responseHeaders.set('access-control-allow-credentials', 'true')
  responseHeaders.delete('content-security-policy')
  responseHeaders.delete('content-security-policy-report-only')
  responseHeaders.delete('clear-site-data')

  //rewrite response body
  const rewriter = new HTMLRewriter()
    .on('*', new AttributeRewriter('href', proxyUrl, upstreamUrl))
    .on('*', new AttributeRewriter('src', proxyUrl, upstreamUrl))
    .on('form', new AttributeRewriter('action', proxyUrl, upstreamUrl))
  // todo: rewrite-srcset

  let isHtml = String(responseHeaders.get('content-type')).includes('text/html')
  let responseBody = isHtml
    ? rewriter.transform(UpstreamResponse).body
    : UpstreamResponse.body
  let responseStatus = UpstreamResponse.status
  return new Response(responseBody, {
    status: responseStatus,
    headers: responseHeaders,
  })
}

/**
 * Rewrites the url from https://google.com to https://example.com/dokodemo/https://google.com
 * @class
 */
class AttributeRewriter {
  private attributeName: string
  private proxyUrl: URL
  private upstream: URL

  constructor(attributeName: string, proxyUrl: URL, upstreamUrl: URL) {
    this.attributeName = attributeName
    this.proxyUrl = proxyUrl
    this.upstream = upstreamUrl
  }
  element(element: Element) {
    let attribute = element.getAttribute(this.attributeName)
    if (attribute) {
      if (!attribute.match(/^[\w-]+:\/\/.*/) && !attribute.match(/^data:.*/)) {
        //rewrite relative paths to upstream absolute path
        attribute = new URL(attribute, this.upstream.origin).href
      }
      element.setAttribute(
        this.attributeName,
        attribute.replace(
          /^(https?:\/\/.*)/,
          `${this.proxyUrl.origin}/${dokodemo_path}/$1`,
        ),
      )
    }
  }
}

export async function handleFetch(event: FetchEvent) {
  event.respondWith(handleRequest(event.request))
}
