/** Chrome/CDP evidence, following uiV3.browser.cjs. No production backend access. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const output = path.resolve('tmp/chat-schedule-v3-render');
fs.mkdirSync(output, { recursive: true });
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style></head><body><div id="root"></div><script src="http://localhost:8103/scripts/ui-preview/chatScheduleV3.preview.bundle?platform=web&dev=false&minify=false"></script></body></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get(`http://localhost:8103${request.url}`, (asset) => {
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-chat-schedule-v3-chrome-'));
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
  await call('Page.addScriptToEvaluateOnNewDocument', {source: `const RealDate=Date; class FixtureDate extends RealDate {constructor(...args){super(...(args.length?args:[2026,9,16,9]));} static now(){return new RealDate(2026,9,16,9).getTime();}} window.Date=FixtureDate;`});
  const width=412,height=892;
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});
  for (const scene of ['confirmed','pending-scheduling','pending-place','all-submitted','mate','editing','failure']) {
    await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?scene=${scene}`});
    await waitFor(scene==='failure' ? `!!document.querySelector('[role="alert"]')` : `!!document.querySelector('[data-testid="schedule-submissions"]')`);
    await evaluate('document.fonts.ready.then(()=>true)');
    await waitFor('[...document.images].every(i=>i.complete&&i.naturalWidth>0)');
    await evaluate('Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>undefined))).then(()=>true)');
    await delay(250);
    const capture=async suffix=>{
      const metrics=await evaluate(`(()=>{
        const rect=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,fontSize:s.fontSize,lineHeight:s.lineHeight,color:s.color,background:s.backgroundColor,radius:s.borderTopLeftRadius,paddingTop:s.paddingTop,paddingRight:s.paddingRight,gap:s.gap};};
        return {text:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth,
          sheet:rect(document.querySelector('[data-testid="auth-sheet-surface"]')),
          confirmed:document.querySelector('[data-testid="schedule-confirmed"]')?rect(document.querySelector('[data-testid="schedule-confirmed"]')):null,
          members:[...document.querySelectorAll('[data-testid^="schedule-submission-"]')].map(e=>({label:e.getAttribute('aria-label'),...rect(e)})),
          controls:[...document.querySelectorAll('[role="button"],[role="checkbox"]')].filter(e=>e.getClientRects().length&&!e.closest('[aria-hidden="true"]')).map(e=>({label:e.getAttribute('aria-label'),disabled:e.getAttribute('aria-disabled'),...rect(e)})),
          headings:[...document.querySelectorAll('[role="heading"]')].map(e=>({text:e.innerText,...rect(e)})),
          checkboxes:document.querySelectorAll('[role="checkbox"]').length};})()`);
      assert.equal(metrics.overflow,false);
      assert.equal(Boolean(metrics.confirmed),scene==='confirmed');
      assert.equal(metrics.members.length,scene==='failure'?0:4);
      assert.equal(metrics.checkboxes,scene==='editing'&&!suffix?50:0);
      assert.ok(!metrics.text.includes('2099'));
      for(const control of metrics.controls)assert.ok(control.width>=44&&control.height>=44,`Small target: ${control.label}`);
      for(const member of metrics.members)assert.equal(member.height,44);
      const name=scene+(suffix||'')+'-412x892.png';
      const result=await call('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width,height,scale:0.5}});
      fs.writeFileSync(path.join(output,name),Buffer.from(result.data,'base64'));
      evidence.push({scene,suffix:suffix||'',figma:'527:1613',width,height,screenshot:name,metrics});
    };
    await capture('');
    if(scene==='editing'){
      await evaluate(`[...document.querySelectorAll('[role="checkbox"]')].find(e=>e.getAttribute('aria-disabled')!=='true').click()`);
      await evaluate(`[...document.querySelectorAll('[role="button"]')].at(-1).click()`);
      await waitFor(`document.querySelectorAll('[role="checkbox"]').length===0`);
      await capture('-saved');
    }
    await evaluate(`document.querySelector('[data-testid="auth-sheet-surface"] [role="button"]').click()`);
    await waitFor(`document.body.innerText.includes('Preview returned to chat')`);
  }
  fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(evidence,null,2));
  const gallery=evidence.map(e=>`<article><h2>${e.scene}${e.suffix}</h2><img src="${e.screenshot}" width="412" height="892" alt="${e.scene}${e.suffix}"></article>`).join('');
  fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Chat schedule v3, 527:1613</title><style>body{font:16px system-ui;background:#eee;margin:24px}main{display:flex;flex-wrap:wrap;gap:24px}h2{font-size:16px}img{border:1px solid #bbb}</style><h1>Chat schedule v3, 412x892</h1><p>Offline fixtures; compared with supplied handoff, not an original Figma bitmap.</p><main>${gallery}</main></html>`);
  process.stdout.write(`Chat schedule v3 render checks passed: ${output}\n`);
}
main().catch(error=>{process.stderr.write(`${error.stack}\n`);process.exitCode=1;}).finally(()=>{socket?.close();browser?.kill();server.close();});
