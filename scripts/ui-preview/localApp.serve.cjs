process.env.EXPO_NO_DOTENV = '1';
process.env.EXPO_NO_CACHE = '1';
const path = require('node:path');
const http = require('node:http');
const Metro = require('metro');
const { loadConfig } = require('metro-config');
async function serve() {
  const config = await loadConfig({ config: path.join(path.dirname(module.filename), 'localApp.metro.cjs'), port: 8133, maxWorkers: 2, resetCache: true });
  const metro = await Metro.runServer(config, { host: '127.0.0.1', waitForBundler: true });
  const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MealChat 디자인 미리보기</title><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex;max-width:412px;margin:auto}body{background:#f1eee9}</style><div id="root"></div><script src="/scripts/ui-preview/localApp.preview.bundle?platform=web&dev=false&minify=false"></script></html>';
  const page = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1:8135');
    if (url.pathname === '/') { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html); return; }
    const proxy = http.get({ hostname: '127.0.0.1', port: 8133, path: url.pathname + url.search }, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); });
    proxy.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    response.on('close', () => proxy.destroy());
  });
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    page.close(); page.closeAllConnections();
    metro.close(); metro.closeAllConnections();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  page.on('error', error => { shutdown(); console.error(error); process.exitCode = 1; });
  await new Promise((resolve, reject) => { page.once('error', reject); page.listen(8135, '127.0.0.1', resolve); });
  console.log('Figma remaining gallery: http://127.0.0.1:8135');
}
serve().catch(error => { console.error(error); process.exitCode = 1; });
