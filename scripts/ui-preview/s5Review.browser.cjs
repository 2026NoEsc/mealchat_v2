/** Offline S5 review capture: synthetic contract fixtures, all external network blocked. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const output = path.resolve('tmp/s5-app-render');
fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style><div id="root"></div><script src="http://localhost:8116/scripts/ui-preview/s5Review.preview.bundle?platform=web&dev=false&minify=false"></script></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get('http://localhost:8116' + request.url, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); })
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
  for (let attempt = 0; attempt < 400; attempt++) {
    if (errors.length) throw new Error('Preview runtime error: ' + errors[0].text);
    if (await evaluate(expression)) return; await delay(150);
  }
  throw new Error('Timed out: ' + expression);
}
const selector = label => JSON.stringify('[aria-label=' + JSON.stringify(label) + ']');
async function click(label) { await evaluate(`document.querySelector(${selector(label)}).click()`); await delay(80); }
async function capture(name, node) {
  await evaluate('document.activeElement?.blur(); window.scrollTo(0,0); document.body.scrollTop=0; document.documentElement.scrollTop=0;');
  await delay(120);
  const metrics = await evaluate(`(() => {
    const rect = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return {label:e.getAttribute('aria-label'), x:r.x,y:r.y,width:r.width,height:r.height,fontSize:s.fontSize,color:s.color,background:s.backgroundColor,radius:s.borderTopLeftRadius}; };
    const visible = e => e.getClientRects().length > 0 && !e.closest('[aria-hidden="true"]');
    return {overflow:document.documentElement.scrollWidth > innerWidth,text:document.body.innerText,
      controls:[...document.querySelectorAll('[role="button"],[role="tab"],[role="radio"],[role="checkbox"]')].filter(visible).map(rect),
      inputs:[...document.querySelectorAll('input')].filter(visible).map(e => ({...rect(e),type:e.type})),
      labels:[...document.querySelectorAll('[dir="auto"]')].filter(e => !e.children.length && e.innerText).map(e => ({...rect(e),text:e.innerText})),
      fixtureCalls:window.__s5ReviewCalls || []}; })()`);
  assert.equal(metrics.overflow, false);
  for (const target of metrics.controls) assert.ok(target.width >= 43.9 && target.height >= 43.9, `Small target ${target.label}`);
  const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(screenshot.data, 'base64'));
  evidence.push({name,node,...metrics});
  fs.writeFileSync(path.join(output, 'review-metrics.json'), JSON.stringify({ evidence, errors, blocked }, null, 2));
}
async function connect() {
  console.log('S5 review: starting offline Chrome');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-s5-review-'));
  browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new','--disable-gpu','--in-process-gpu','--disable-gpu-shader-disk-cache','--disable-background-networking','--no-first-run','--remote-debugging-pipe','--user-data-dir='+profile,'about:blank'],
    {windowsHide:true,stdio:['ignore','ignore','pipe','pipe','pipe']});
  let sequence = 0, buffer = '', sessionId;
  const pending = new Map();
  browser.on('exit', code => { for (const task of pending.values()) task.reject(new Error('Preview Chrome exited: ' + code)); pending.clear(); });
  browser.stderr.on('data', () => { /* No browser diagnostics containing environment or profile data. */ });
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
    setTimeout(() => { if (pending.delete(id)) reject(new Error('CDP timeout: ' + method)); }, 20000).unref();
    browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})})+'\0');
  });
  const { targetInfos } = await call('Target.getTargets');
  console.log('S5 review: Chrome connected');
  const target = targetInfos.find(target => target.type === 'page');
  sessionId = (await call('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
  await call('Page.enable'); await call('Runtime.enable'); await call('Fetch.enable');
}
async function main() {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  await connect();
  await call('Emulation.setDeviceMetricsOverride', { width:412,height:892,deviceScaleFactor:1,mobile:true });
  const scenes = [
    ['health-unanswered','피해야 할 음식이 있나요?','495:1163'],
    ['health-saved','피해야 할 음식이 있나요?','495:1163'],
    ['health-empty-complete','피해야 할 음식이 있나요?','495:1163'],
    ['health-v1','이전 건강정보는 자동으로 옮기지 않아요','S1008 recovery'],
    ['food-edit','음식 취향 수정','495:1026 (editing)'],
    ['time-legacy','시간 추천은 곧 다시 이용할 수 있어요','legacy compatibility'],
    ['time-s1-only','시간 추천은 곧 다시 이용할 수 있어요','S1-only compatibility'],
    ['time-400','현재 서버와 앱의 시간 추천 방식이 달라요','Edge contract mismatch'],
    ['restaurant','공용 만남 지역','540:1524 (controls)'],
    ['restaurant-save-failure','공용 만남 지역','540:1524 (save failure)'],
    ['rules','기본 추천','540:1524'],
    ['rules-loading','식당을 찾고 있어요','540:1524 (loading)'],
    ['app-info','데이터 출처','601:3156'],
  ];
  for (const [scene,expected,node] of scenes) {
    console.log('S5 review scene: ' + scene);
    await call('Page.navigate', {url:`http://127.0.0.1:${server.address().port}/?scene=${scene}`});
    await waitFor(`document.body.innerText.includes(${JSON.stringify(expected)})`);
    await evaluate('document.fonts.ready.then(() => true)'); await delay(300);
    if (scene.startsWith('restaurant')) {
      await waitFor(`Boolean(document.querySelector('[aria-label="다시 추천받기"]'))`);
      await click('이번 밥약 음식 종류 (선택)'); await click('한식');
      await waitFor(`document.body.innerText.includes(${JSON.stringify(scene==='restaurant'?'음식 종류를 바꿨어요':'처리하지 못했어요')})`);
      assert.equal(await evaluate('window.__s5ReviewCalls.filter(x=>x==="invoke").length'),1);
    }
    if(scene==='health-v1')await evaluate(`(() => { const scroll=[...document.querySelectorAll('div')].find(e=>e.scrollHeight>e.clientHeight&&getComputedStyle(e).overflowY==='auto');if(scroll)scroll.scrollTop=scroll.scrollHeight;})()`);
    await capture('review-'+scene+'-412x892',node);
    if(scene==='health-unanswered') {
      assert.equal(await evaluate('document.querySelector("[aria-label=완료]").getAttribute("aria-disabled")'), 'true');
      await click('알레르기 없음'); await click('못 먹는 음식, 아직 고르지 않았어요');await click('없음');await click('식단 제한, 아직 고르지 않았어요');
      await click('식단 제한 없음'); await click('상관없음');
      assert.notEqual(await evaluate('document.querySelector("[aria-label=완료]").getAttribute("aria-disabled")'),'true');
      await evaluate(`(() => { const scroll=[...document.querySelectorAll('div')].find(e=>e.scrollHeight>e.clientHeight&&getComputedStyle(e).overflowY==='auto');if(scroll)scroll.scrollTop=scroll.scrollHeight;})()`);
      await capture('review-health-explicit-none-412x892','495:1325 + explicit-answer decision');
    }
    if(scene==='time-legacy'||scene==='time-s1-only')assert.equal(await evaluate('window.__s5ReviewCalls.includes("invoke")'),false);
  }
  assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
  const images = evidence.map(entry => `<article><h2>${entry.name} · ${entry.node}</h2><img src="${entry.name}.png" width="412" height="892"></article>`).join('');
  fs.writeFileSync(path.join(output,'review-index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>S5 검토 반영 렌더</title><style>body{font:16px system-ui;background:#eee}main{display:flex;gap:20px;flex-wrap:wrap}h2{font-size:16px}</style><p>실제 컴포넌트 + 합성 계약 fixture · 412×892 · 서버/공급원 연결 검증 아님</p><main>${images}</main></html>`);
  process.stdout.write(`S5 review captures passed: ${evidence.length}\n`);
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode=1; }).finally(() => { browser?.kill(); server.close(); });
