import { handler } from '../server.js';

export default function shop(request, response) {
  // Vercel may pass the rewritten URL rather than the original public route.
  request.url = request.method === 'POST' ? '/checkout' : '/config.json';
  return handler(request, response);
}
