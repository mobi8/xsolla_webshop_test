import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { isIPv4 } from 'node:net';
import { pathToFileURL } from 'node:url';

const projectId = process.env.XSOLLA_PROJECT_ID || '316922';
const locale = process.env.XSOLLA_LOCALE || 'en';
const projectApiKey = process.env.XSOLLA_PROJECT_API_KEY;
let publicIp;

async function getDevUserIp() {
  if (!publicIp) {
    publicIp = (async () => {
      if (process.env.XSOLLA_DEV_USER_IP) return process.env.XSOLLA_DEV_USER_IP;
      // On localhost, the browser and server share the same public egress IP.
      const response = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Unable to detect local buyer IP.');
      return (await response.text()).trim();
    })();
  }
  try {
    const ip = await publicIp;
    if (!isIPv4(ip)) throw new Error('A public IPv4 address is required.');
    return ip;
  } catch (error) {
    publicIp = undefined;
    throw error;
  }
}

function json(response, code, body) {
  response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function checkout(request, response) {
  const onVercel = process.env.VERCEL === '1';
  const origin = `${onVercel ? 'https' : 'http'}://${request.headers.host}`;
  if (request.headers.origin !== origin || (!onVercel && !['localhost', '127.0.0.1'].includes(new URL(origin).hostname))) {
    json(response, 403, { error: 'Checkout must be requested from this shop.' });
    return;
  }
  if (!projectApiKey) {
    json(response, 503, { error: 'Server checkout credentials are missing.' });
    return;
  }
  try {
    let body = request.body;
    if (body === undefined) {
      body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 4096) {
          json(response, 413, { error: 'Checkout request is too large.' });
          return;
        }
      }
    }
    if ((typeof body === 'string' ? body : JSON.stringify(body)).length > 4096) {
      json(response, 413, { error: 'Checkout request is too large.' });
      return;
    }
    let input;
    try { input = typeof body === 'string' ? JSON.parse(body) : body; } catch {
      json(response, 400, { error: 'Invalid checkout request.' });
      return;
    }
    if (typeof input?.sku !== 'string' || !/^[A-Za-z0-9._-]{1,255}$/.test(input.sku) || typeof input.userId !== 'string' || !/^local-test-[a-f0-9-]{36}$/.test(input.userId)) {
      json(response, 400, { error: 'Invalid product or test-buyer ID.' });
      return;
    }
    let ip;
    const country = request.headers['x-vercel-ip-country'];
    if (onVercel) {
      ip = request.headers['x-vercel-forwarded-for']?.split(',')[0].trim();
      if (!isIPv4(ip || '') && !/^[A-Z]{2}$/.test(country || '')) {
        json(response, 503, { error: 'Unable to determine buyer location for checkout.' });
        return;
      }
    } else {
      ip = await getDevUserIp();
    }
    // Xsolla accepts IPv4 only; Vercel supplies a country for IPv6 buyers.
    const buyerCountry = isIPv4(ip || '') ? { allow_modify: true } : { value: country, allow_modify: true };
    const upstream = await fetch(`https://store.xsolla.com/api/v3/project/${projectId}/admin/payment/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${projectId}:${projectApiKey}`).toString('base64')}`,
        ...(isIPv4(ip || '') ? { 'X-User-Ip': ip } : {}),
      },
      body: JSON.stringify({
        sandbox: true,
        user: { id: { value: input.userId }, country: buyerCountry },
        purchase: { items: [{ sku: input.sku, quantity: 1 }] },
        settings: { language: locale, return_url: `${origin}/` },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await upstream.json();
    if (!upstream.ok || typeof result.token !== 'string' || !result.token) {
      const code = Number.isInteger(result.errorCode) ? `, code ${result.errorCode}` : '';
      json(response, 502, { error: `Xsolla could not open checkout (${upstream.status}${code}).` });
      return;
    }
    const url = new URL('https://sandbox-secure.xsolla.com/paystation4/');
    url.searchParams.set('token', result.token);
    json(response, 200, { checkoutUrl: url.href });
  } catch {
    json(response, 502, { error: 'Unable to connect to Xsolla checkout. Please try again.' });
  }
}
const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/catalog.js', ['catalog.js', 'text/javascript']],
]);

export async function handler(request, response) {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/checkout' && request.method === 'POST') {
    await checkout(request, response);
    return;
  }
  if (request.method !== 'GET') {
    response.writeHead(405).end();
    return;
  }
  if (path === '/config.json') {
    json(response, 200, { projectId, locale });
    return;
  }
  const file = files.get(path);
  if (!file) {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` });
    response.end(body);
  } catch {
    response.writeHead(500).end('Unable to load page.');
  }
}

// Try the next port if another local app already uses this one.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer(handler);
  let port = Number(process.env.PORT || 5173);
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') server.listen(++port, '127.0.0.1');
    else throw error;
  });
  server.on('listening', () => console.log(`Yalla Ball: http://localhost:${port}`));
  server.listen(port, '127.0.0.1');
}
