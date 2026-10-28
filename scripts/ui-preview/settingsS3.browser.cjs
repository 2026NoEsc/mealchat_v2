/** Chrome/CDP evidence, following uiV3.browser.cjs. No production backend access. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const output = path.resolve('tmp/settings-s3-render');
fs.mkdirSync(output, { recursive: true });
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style></head><body><div id="root"></div><script src="http://localhost:8097/scripts/ui-preview/settingsS3.preview.bundle?platform=web&dev=false&minify=false"></script></body></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get(`http://localhost:8097${request.url}`, (asset) => {
    response.writeHead(asset.statusCode, asset.headers); asset.pipe(response);
  }).on('error', () => { response.writeHead(502); response.end(); });
});
let browser;
let socket;
let call;
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 600; attempt++) { if (await evaluate(expression)) return; await delay(100); }
  throw new Error(`Browser condition timed out: ${expression}`);
}
async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-settings-s3-chrome-'));
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--force-device-scale-factor=2',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  const activePort = path.join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100 && !fs.existsSync(activePort); attempt++) await delay(100);
  const port = fs.readFileSync(activePort, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map();
  let sequence = 0;
  socket.onmessage = (event) => {
    const result = JSON.parse(event.data);
    if (!result.id) return;
    const task = pending.get(result.id); pending.delete(result.id);
    if (result.error) task.reject(new Error(result.error.message)); else task.resolve(result.result);
  };
  call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  await call('Page.enable');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const evidence = [];
  for (const width of [412, 375]) {
    const height = width === 412 ? 892 : 812;
    for (const scene of ['settings', 'terms', 'privacy', 'info', 'notification', 'signup', 'reconsent']) {
      await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
      await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?scene=${scene}` });
      await waitFor('document.body.innerText.trim().length > 0');
      await evaluate('document.fonts.ready.then(() => true)');
      await waitFor('[...document.images].every(image => image.complete && image.naturalWidth > 0)');
      await evaluate('Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))).then(() => true)');
      // Allow react-native-svg's initial dimensions to reach the compositor before capture.
      await delay(250);
      const capture = async (suffix = '') => {
        const metrics = await evaluate(`(() => {
          const rect = e => { const r = e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
          const visible = e => e.getClientRects().length > 0 && !e.closest('[aria-hidden="true"]');
          const style = e => { const s = getComputedStyle(e); return {fontSize:s.fontSize,lineHeight:s.lineHeight,color:s.color,backgroundColor:s.backgroundColor}; };
          return {overflow:document.documentElement.scrollWidth > innerWidth, text:document.body.innerText,
            buttons:[...document.querySelectorAll('[role="button"],[role="tab"],[role="checkbox"]')].filter(visible).map(e => ({label:e.getAttribute('aria-label') || e.innerText,...rect(e)})),
            sections:[...document.querySelectorAll('[data-testid^="legal-section-"]')].map(e => ({id:e.dataset.testid,...rect(e)})),
            headings:[...document.querySelectorAll('[role="heading"]')].map(e => ({text:e.innerText,...rect(e),...style(e)})),
            backIcon:document.querySelector('[aria-label="뒤로"] svg')?.outerHTML,
            legalText:document.querySelector('[data-testid^="legal-section-"]') ? [...document.querySelector('[data-testid^="legal-section-"]').children].map(e => ({text:e.innerText,...style(e)})) : [],
            licenses:document.querySelectorAll('[data-testid="license-row"]').length};
        })()`);
        assert.equal(metrics.overflow, false, `${scene}: horizontal overflow`);
        for (const button of metrics.buttons) assert.ok(button.width >= 44 && button.height >= 44, `${scene}: small target ${button.label}`);
        if (scene === 'terms') assert.equal(metrics.sections.length, 15);
        if (scene === 'privacy') assert.equal(metrics.sections.length, 11);
        if (scene === 'info') assert.equal(metrics.licenses, 24);
        const screenshot = `${scene}${suffix}-${width}x${height}.png`;
        await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const result = await call('Page.captureScreenshot', {format:'png',clip:{x:0,y:0,width,height,scale:0.5}});
        fs.writeFileSync(path.join(output,screenshot),Buffer.from(result.data,'base64'));
        evidence.push({scene,suffix,width,height,screenshot,metrics});
      };
      await capture();
      if (['terms','privacy','info'].includes(scene)) {
        await evaluate(`(() => { const scroll = [...document.querySelectorAll('div')].find(e => e.scrollHeight > e.clientHeight && getComputedStyle(e).overflowY === 'auto'); scroll.scrollTop = scroll.scrollHeight; })()`);
        await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        await capture('-end');
      }
      if (scene === 'signup' || scene === 'reconsent') {
        await evaluate(`document.querySelector('[role="button"][aria-label$="보기"]').click()`);
        await waitFor(`document.querySelectorAll('[data-testid^="legal-section-"]').length === 15`);
        await evaluate('Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))).then(() => true)');
        await capture('-legal');
      }
      if (scene === 'notification') {
        await evaluate(`document.querySelector('[role="button"]').click()`);
        await waitFor(`document.body.innerText.includes('Preview permission guide completed')`);
      }
    }
  }
  fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify(evidence, null, 2));
  const previews = [...evidence].sort((a, b) => (a.scene + a.suffix).localeCompare(b.scene + b.suffix) || b.width - a.width)
    .map(entry => `<article><h2>${entry.scene}${entry.suffix} · ${entry.width}×${entry.height}</h2><img src="${entry.screenshot}" width="${entry.width}" height="${entry.height}" alt="${entry.scene}${entry.suffix}, ${entry.width} by ${entry.height}"></article>`).join('');
  fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MealChat settings S3 render evidence</title><style>body{margin:24px;font:16px system-ui;background:#eee}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(375px,1fr));gap:24px}h2{font-size:16px}img{display:block;max-width:100%;height:auto;border:1px solid #bbb}</style><h1>MealChat settings S3</h1><p>Offline web render with production screen components. Source: supplied Phone handoff; no original Figma bitmap is included.</p><main>${previews}</main></html>`);
  process.stdout.write(`Settings S3 render checks passed. Evidence: ${output}\n`);
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }).finally(() => {
  socket?.close(); browser?.kill(); server.close();
});
