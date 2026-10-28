/** Offline Chrome/CDP capture. Start Expo with s1.metro.cjs, port 8112, EXPO_NO_DOTENV=1. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const output = path.resolve('tmp/s1-app-render');
fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style><div id="root"></div><script src="http://localhost:8112/scripts/ui-preview/s1.preview.bundle?platform=web&dev=false&minify=false"></script></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get('http://localhost:8112' + request.url, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); })
    .on('error', () => { response.writeHead(502); response.end(); });
});
let browser, call;
const errors = [], blocked = [], evidence = [];
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 400; attempt++) { if (await evaluate(expression)) return; await delay(150); }
  throw new Error('Timed out: ' + expression);
}
const selector = label => JSON.stringify('[aria-label=' + JSON.stringify(label) + ']');
async function click(label) { await evaluate(`document.querySelector(${selector(label)}).click()`); await delay(80); }
async function capture(name, node) {
  await evaluate('document.activeElement?.blur()');
  await delay(120);
  const metrics = await evaluate(`(() => {
    const rect = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return {label:e.getAttribute('aria-label'), x:r.x,y:r.y,width:r.width,height:r.height,fontSize:s.fontSize,color:s.color,background:s.backgroundColor,radius:s.borderTopLeftRadius}; };
    const visible = e => e.getClientRects().length > 0 && !e.closest('[aria-hidden="true"]');
    return {overflow:document.documentElement.scrollWidth > innerWidth,text:document.body.innerText,
      controls:[...document.querySelectorAll('[role="button"],[role="tab"],[role="radio"],[role="checkbox"],[role="switch"]')].filter(visible).map(rect),
      inputs:[...document.querySelectorAll('input')].filter(visible).map(e => ({...rect(e),type:e.type})),
      labels:[...document.querySelectorAll('[dir="auto"]')].filter(e => !e.children.length && e.innerText).map(e => ({...rect(e),text:e.innerText})),
      fixtureCalls:window.__s1FixtureCalls || []}; })()`);
  assert.equal(metrics.overflow, false);
  for (const target of metrics.controls) assert.ok(target.width >= 44 && target.height >= 44, `Small target ${target.label}`);
  const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(screenshot.data, 'base64'));
  evidence.push({name,node,...metrics});
  fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify({ evidence, errors, blocked }, null, 2));
}
async function connect() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-s1-app-'));
  browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new','--disable-gpu','--in-process-gpu','--disable-gpu-shader-disk-cache','--disable-background-networking','--no-first-run','--remote-debugging-pipe','--user-data-dir='+profile,'about:blank'],
    {windowsHide:true,stdio:['ignore','ignore','pipe','pipe','pipe']});
  let sequence = 0, buffer = '', sessionId;
  const pending = new Map();
  browser.stdio[4].on('data', chunk => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const raw = buffer.slice(0,end); buffer = buffer.slice(end+1); if (!raw) continue;
      const result = JSON.parse(raw);
      if (result.method === 'Runtime.exceptionThrown') errors.push(result.params.exceptionDetails);
      if (result.method === 'Fetch.requestPaused') {
        const url = new URL(result.params.request.url);
        const allowed = ['127.0.0.1','localhost'].includes(url.hostname) || url.protocol === 'data:';
        if (!allowed) blocked.push(url.origin);
        void call(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed ? {requestId:result.params.requestId} : {requestId:result.params.requestId,errorReason:'BlockedByClient'});
      }
      if (!result.id) continue;
      const task = pending.get(result.id); pending.delete(result.id);
      if (result.error) task.reject(new Error(result.error.message)); else task.resolve(result.result);
    }
  });
  call = (method, params = {}) => new Promise((resolve,reject) => {
    const id = ++sequence; pending.set(id,{resolve,reject});
    browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})})+'\0');
  });
  const { targetInfos } = await call('Target.getTargets');
  const target = targetInfos.find(target => target.type === 'page');
  sessionId = (await call('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
  await call('Page.enable'); await call('Runtime.enable'); await call('Fetch.enable');
}
async function main() {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  await connect();
  await call('Emulation.setDeviceMetricsOverride', { width:412,height:892,deviceScaleFactor:1,mobile:true });
  const scenes = ['payment-open','payment-completed','payment-closed-debt','payment-unavailable','payment-error','payment-chat','payment-request','notice','notice-changes','legacy-privacy','signup','reconsent','gate-error','settings','optional','privacy','service-document','privacy-document','health-document','marketing-document'];
  const nodes = { signup:'520:1285',reconsent:'558:1712',settings:'564:1791',privacy:'530:1656','service-document':'564:1961','privacy-document':'567:1909' };
  const scrollEnd = () => evaluate(`(() => { const e = [...document.querySelectorAll('div')].find(e => e.scrollHeight > e.clientHeight && getComputedStyle(e).overflowY === 'auto'); if(e) e.scrollTop=e.scrollHeight; })()`);
  for (const scene of scenes) {
    await call('Page.navigate', {url:`http://127.0.0.1:${server.address().port}/?scene=${scene}`});
    await waitFor("document.body.innerText.length > 30 && !document.body.innerText.includes('폰트 불러오는 중')");
    await evaluate('document.fonts.ready.then(() => true)');
    await waitFor('[...document.images].every(image => image.complete && image.naturalWidth > 0)');
    await delay(250);
    await capture(scene+'-412x892',nodes[scene] || 'S1 신규 · 노드 확인 필요');
    if (scene === 'notice-changes') {
      await click('개정안 원문 보기'); await capture('notice-draft-412x892','567:1909 · 승인 문구 개정안');
      await click('변경 요약으로'); await click('이전 판 보기 · 1판'); await capture('notice-previous-412x892','567:1909 · 1판 보존');
    }
    if (['signup','reconsent','gate-error','optional','privacy','service-document','privacy-document','health-document','marketing-document'].includes(scene)) {
      await scrollEnd(); await capture(scene+'-end-412x892',nodes[scene] || 'S1 신규 · 노드 확인 필요');
    }
    if (scene === 'signup') {
      await click('[필수] 서비스 이용약관');
      await click('[필수] 개인정보 처리방침');
      await waitFor(`document.querySelector('[aria-label="회원가입 끝내기"]').getAttribute('aria-disabled') !== 'true'`);
      await capture('signup-required-only-412x892','520:1285');
    }
    if (scene === 'optional') {
      await click('건강정보 동의 철회');
      await waitFor(`document.body.innerText.includes('동의를 철회하고 건강정보를 삭제했어요')`);
      await capture('health-withdrawn-412x892','S1 신규 · 노드 확인 필요');
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
  const images = evidence.map(entry => `<article><h2>${entry.name} · ${entry.node}</h2><img src="${entry.name}.png" width="412" height="892"></article>`).join('');
  fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>S1 앱 렌더</title><style>body{font:16px system-ui;background:#eee}main{display:flex;gap:20px;flex-wrap:wrap}h2{font-size:16px}</style><p>실제 화면 컴포넌트 + 격리된 계약 mock · 412×892 · 서버 통합 증거 아님. Figma 원본 이미지는 없음.</p><main>${images}</main></html>`);
  process.stdout.write(`S1 offline captures passed: ${output}\n`);
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode=1; }).finally(() => { browser?.kill(); server.close(); });
