import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../web/', import.meta.url)));
const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const host = option('--host', '127.0.0.1');
const port = Number(option('--port', '3000'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__qa/mobile') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      const requestedWidth = Number(new URL(request.url, 'http://localhost').searchParams.get('width') || 390);
      const width = [320, 390, 768, 1024].includes(requestedWidth) ? requestedWidth : 390;
      const requestedHeight = Number(new URL(request.url, 'http://localhost').searchParams.get('height'));
      const height = [360, 420, 600].includes(requestedHeight) ? `${requestedHeight}px` : '100vh';
      response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Responsive QA · ${width} px</title><style>body{margin:0;background:#c8cccc;display:flex;justify-content:center}iframe{border:0;width:${width}px;height:${height};background:white}</style><iframe title="${width} pixel responsive preview" src="/"></iframe></html>`);
      return;
    }
    let target = path.resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Outside root');
    const info = await stat(target);
    if (info.isDirectory()) target = path.join(target, 'index.html');
    const file = await stat(target);
    if (!file.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'text/plain; charset=utf-8', 'Content-Length': file.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') response.end(); else createReadStream(target).pipe(response);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Not found'); }
}).listen(port, host, () => process.stdout.write(`Heli Briefing: http://${host}:${port}\n`));
