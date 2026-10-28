/** Isolated contract-render evidence only: no Supabase, provider or production configuration. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const output = path.resolve('tmp/s4-app-render');
fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style><div id="root"></div><script src="http://127.0.0.1:8144/scripts/ui-preview/s4App.preview.bundle?platform=web&dev=false&minify=false"></script></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get(`http://127.0.0.1:8144${request.url}`, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); })
    .on('error', () => { response.writeHead(502); response.end(); });
});
let browser, socket, call;
const errors = [], requests = [];
async function evaluate(expression) {
  const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 600; attempt++) { if (await evaluate(expression)) return; await delay(100); }
  throw new Error('Preview condition timed out: ' + expression);
}
const click = label => evaluate(`(()=>{const b=[...document.querySelectorAll('[role="button"]')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)});if(!b)throw Error('Button not found');b.click();})()`);
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-s4-preview-'));
  browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--force-device-scale-factor=2', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await delay(100);
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map(); let sequence = 0;
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    if (!message.id) return;
    const task = pending.get(message.id); pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
  };
  call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `const RealDate=Date;class FixtureDate extends RealDate{constructor(...args){super(...(args.length?args:['2026-10-20T00:00:00Z']));}static now(){return RealDate.parse('2026-10-20T00:00:00Z');}}window.Date=FixtureDate;` });
  await call('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 2, mobile: true });
  const evidence = [];
  const expectedTime = '2026년 10월 20일 (화) 18:00–19:00 · 한국 시간';
  async function capture(name, scene, timezone) {
    await evaluate('document.fonts.ready.then(()=>true)'); await delay(180);
    const metrics = await evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{width:r.width,height:r.height};};return{text:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('[role="button"],[role="checkbox"],[role="radio"]')].filter(e=>e.getClientRects().length&&!e.closest('[aria-hidden="true"]')).map(e=>({label:e.getAttribute('aria-label'),...rect(e)})),calls:window.__s4Calls};})()`);
    assert.equal(metrics.overflow, false, name + ': horizontal overflow');
    for (const control of metrics.controls) assert.ok(control.width >= 43.9 && control.height >= 43.9, `${name}: small target ${control.label} ${control.width}x${control.height}`);
    assert.ok(!metrics.text.includes('2099'), name + ': inferred meeting_date');
    const image = await call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 412, height: 892, scale: 0.5 } });
    const filename = `${name}-412x892.png`; fs.writeFileSync(path.join(output, filename), Buffer.from(image.data, 'base64'));
    evidence.push({ scene, timezone, screenshot: filename, metrics });
  }
  const scenes = ['step2', 'time-waiting', 'time-manual', 'time-recommendations', 'submissions-waiting', 'submissions-ready', 'place-time', 'read-only', 'voting', 'no-time', 'mate', 'confirmation', 'capability-error', 'legacy', 'legacy-voting', 'detail', 'summary', 'settlement-actions', 'settlement-locked', 'legacy-settlement', 'legacy-settlement-sheet', 'legacy-settlement-detail', 'place-unset-edit'];
  for (const scene of scenes) {
    await call('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
    await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?scene=${scene}` });
    await waitFor(`document.body.innerText.length>60&&!document.body.innerText.includes('밥약 상태를 확인하고 있어요.')`);
    if (['step2', 'time-manual'].includes(scene)) {
      await waitFor(`document.querySelectorAll('[role="checkbox"]').length===50`);
      await capture(scene, scene, 'UTC');
      await evaluate(`document.querySelector('[role="checkbox"][aria-label^="10월 20일 18시"]').click()`);
      if (scene === 'step2') { await click('선택 완료'); await waitFor(`document.body.innerText.includes('일정을 제출했어요')`); }
      else { await waitFor(`document.body.innerText.includes(${JSON.stringify(expectedTime)})`); await evaluate(`document.querySelector('[data-testid="s4-selected-time"]').scrollIntoView({block:'nearest'})`); }
      await capture(scene + '-selected', scene, 'UTC');
    } else if (scene === 'time-recommendations') {
      await click('시간 추천받기'); await waitFor(`document.querySelector('[role="radio"]')!==null`);
      await evaluate(`document.querySelector('[role="radio"]').click()`); await capture(scene, scene, 'UTC');
      await click('시간 저장하고 식당 정하기');
      await waitFor(`window.__s4Calls.some(c=>c.name==='navigate:ChatRoom')`);
      assert.equal(await evaluate(`window.__s4Calls.find(c=>c.name==='select_room_meeting_time_v1').args.p_time.starts_at`), '2026-10-20T09:00:00.000Z');
    } else if (scene === 'confirmation') {
      await waitFor(`document.querySelector('[data-testid="voting-confirm-cta"]')!==null`); await click('모아 식당으로 정하기');
      await waitFor(`document.body.innerText.includes('약속을 확정할까요?')`); await capture(scene, scene, 'UTC');
      await click('확정하기'); await waitFor(`window.__s4Calls.some(c=>c.name==='confirm_room_appointment_v1')`);
    } else if (scene === 'place-unset-edit') {
      await click('일정 수정'); await waitFor(`document.querySelectorAll('[role="checkbox"]').length===50`); await capture(scene, scene, 'UTC');
    } else { await capture(scene, scene, 'UTC'); }
  }
  for (const [timezoneId, locale] of [['Asia/Seoul', 'ko-KR'], ['America/Los_Angeles', 'en-US']]) {
    await call('Emulation.setTimezoneOverride', { timezoneId }); await call('Emulation.setLocaleOverride', { locale });
    await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?scene=summary` });
    await waitFor(`document.body.innerText.includes(${JSON.stringify(expectedTime)})`);
    assert.equal(await evaluate(`document.body.innerText.split(${JSON.stringify(expectedTime)}).length-1`), 2);
    await capture('summary-' + timezoneId.replaceAll('/', '-'), 'summary', timezoneId);
  }
  assert.deepEqual(errors, []);
  assert.ok(requests.every(url => url.startsWith('http://127.0.0.1:') || url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank'), 'Unexpected external preview request');
  fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify({ evidence, errors, requests }, null, 2));
  fs.writeFileSync(path.join(output, 'browser-errors.json'), JSON.stringify(errors, null, 2));
  fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><title>S4 앱 계약 렌더</title><style>body{font:16px system-ui;background:#eee;margin:24px}main{display:flex;flex-wrap:wrap;gap:24px}img{width:412px;height:892px;border:1px solid #bbb}</style><h1>S4 앱 412×892</h1><p>격리된 mock RPC. 실제 DB·Edge·Figma 원본 대조 아님.</p><main>${evidence.map(item => `<article><h2>${item.screenshot}</h2><img src="${item.screenshot}" alt="${item.scene}"></article>`).join('')}</main></html>`);
  process.stdout.write(`S4 contract render checks passed: ${evidence.length} captures in ${output}\n`);
}
main().catch(async error => {
  fs.writeFileSync(path.join(output, 'browser-errors.json'), JSON.stringify(errors, null, 2));
  if (call) fs.writeFileSync(path.join(output, 'last-page.json'), JSON.stringify(await evaluate('({text:document.body.innerText,calls:window.__s4Calls,images:[...document.images].map(i=>({src:i.src,loaded:i.complete})),ready:document.readyState})'), null, 2));
  process.stderr.write(error.stack + '\n'); process.exitCode = 1;
})
  .finally(() => { socket?.close(); browser?.kill(); server.close(); });
