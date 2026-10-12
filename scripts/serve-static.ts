import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dir, '../out');
const portIndex = process.argv.findIndex(arg => arg === '--port' || arg === '-p');
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Provide a valid TCP port.');
const server = Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(request) {
    let path: string;
    try { path = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response('Invalid URL', { status: 400 }); }
    const full = resolve(root, `.${path}`);
    if (full !== root && !full.startsWith(root + sep)) return new Response('Forbidden', { status: 403 });
    const candidates = path.endsWith('/') ? [resolve(full, 'index.html')] : [full, resolve(full, 'index.html'), `${full}.html`];
    for (const candidate of candidates) {
      const file = Bun.file(candidate); if (!(await file.exists())) continue;
      const response = new Response(request.method === 'HEAD' ? null : file, { headers: { 'Content-Type': file.type } });
      if (path.startsWith('/_next/static/')) response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return response;
    }
    return new Response(Bun.file(resolve(root, '404.html')), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  },
});
console.log(`Static POLY-VORTEX running at http://localhost:${server.port}`);
