/** Offline S5 review capture: synthetic contract fixtures, all external network blocked. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const output = path.resolve('tmp/local-app-render');
fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style><div id="root"></div><script src="http://localhost:8133/scripts/ui-preview/figmaRemaining.preview.bundle?platform=web&dev=false&minify=false"></script></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get('http://localhost:8133' + request.url, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); })
    .on('error', () => { response.writeHead(502); response.end(); });
});
let browser, call;
const errors = [], blocked = [], evidence = [], backendRequests = [];
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
  const state = await evaluate('({text:document.body.innerText,images:document.images.length})');
  throw new Error('Timed out: ' + expression + ' state=' + JSON.stringify(state));
}
const selector = label => JSON.stringify('[aria-label=' + JSON.stringify(label) + ']');
async function click(label) { await evaluate(`document.querySelector(${selector(label)}).click()`); await delay(80); }
async function capture(name, node) {
  await evaluate('document.activeElement?.blur(); window.scrollTo(0,0); document.body.scrollTop=0; document.documentElement.scrollTop=0;');
  await delay(120);
  const metrics = await evaluate(`(() => {
    const rect = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return {label:e.getAttribute('aria-label'), x:r.x,y:r.y,width:r.width,height:r.height,fontSize:s.fontSize,color:s.color,background:s.backgroundColor,radius:s.borderTopLeftRadius}; };
    const visible = e => e.getClientRects().length > 0 && !e.closest('[aria-hidden="true"]');
    return {viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth > innerWidth,text:document.body.innerText,
      assets:[...document.images].map(e=>({...rect(e),loaded:e.complete&&e.naturalWidth>0,source:e.currentSrc})),
      controls:[...document.querySelectorAll('[role="button"],[role="tab"],[role="radio"],[role="checkbox"]')].filter(visible).map(rect),
      inputs:[...document.querySelectorAll('input')].filter(visible).map(e => ({...rect(e),type:e.type})),
      labels:[...document.querySelectorAll('[dir="auto"]')].filter(e => !e.children.length && e.innerText).map(e => ({...rect(e),text:e.innerText})),
      fixtureCalls:window.__s5ReviewCalls || []}; })()`);
  assert.equal(metrics.overflow, false);
  
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
        if (/\/(auth|rest|functions)\/v1\//.test(url.pathname)) backendRequests.push(url.pathname);
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
 await new Promise(resolve => server.listen(8134, '127.0.0.1', resolve)); await connect();
 for (const width of [412, 375]) {
  await call('Emulation.setDeviceMetricsOverride', {width, height:892, deviceScaleFactor:1, mobile:true});
  await call('Page.navigate', {url:'http://127.0.0.1:8135/?route=MealHistory'});
  await waitFor('document.body.innerText.includes("로컬 예시 기록 보기")');
  await click('로컬 예시 기록 보기'); await click('로컬 예시 · 팀 점심 영수증 보기'); await waitFor('document.body.innerText.includes("이미지로 저장")');
  await click('이미지로 저장'); await capture('app-receipt-'+width, '601:3701');
  await evaluate(`[...document.querySelectorAll('[role="button"]')].find(e => e.innerText === '확인').click()`);
  await click('영수증 닫기'); await click('로컬 예시 기록 보기'); await click('로컬 예시 · 저녁팟 · 샤브샤브 영수증 보기');
  await capture('app-receipt-shabu-'+width, '631:6196');
  await click('영수증 닫기'); await click('로컬 예시 기록 보기'); await click('로컬 예시 · 저녁팟 영수증 보기');
  await capture('app-receipt-dinner-'+width, '589:2147');
  await call('Page.navigate', {url:'http://127.0.0.1:8135/?route=LocalMenu'});
  await waitFor('document.body.innerText.includes("오늘은 어떤 음식")'); await capture('app-menu-craving-'+width, '498:1191');
  await click('메뉴 후보 보기'); await waitFor('document.body.innerText.includes("불러오지 못했어요")'); await capture('app-menu-error-'+width, '683:12855');
  await click('로컬 예시 후보로 계속하기'); await capture('app-menu-evaluate-'+width, '497:1127');
  await click('평가 완료'); await click('삼겹살로 정하기'); await capture('app-menu-confirm-'+width, '498:1312');
  await click('다른 메뉴 보기'); await click('다시 평가하기'); await click('삼겹살 별로예요'); await click('평가 완료');
  await capture('app-menu-split-'+width, '497:1369');
  await click('새 후보로 다시 평가하기'); await waitFor('document.body.innerText.includes("새 후보 4개")');
  await capture('app-menu-new-candidates-'+width, '591:2159');
  await click('평가 완료'); await capture('app-menu-shabu-result-'+width, '591:2319');
  await click('샤브샤브로 정하기'); await capture('app-menu-shabu-confirm-'+width, '591:2401');
  await call('Page.navigate', {url:'http://127.0.0.1:8135/?route=ScheduleDetail'});
  await waitFor('document.body.innerText.includes("현재 위치로")'); await click('현재 위치로'); await capture('app-location-'+width, '683:18201');
  await call('Page.navigate', {url:'http://127.0.0.1:8135/?route=NotificationPreferences'});
  await waitFor('document.body.innerText.includes("알림 받기")'); await click('알림 받기'); await capture('app-notifications-'+width,'564:1875');
  await call('Page.navigate', {url:'http://127.0.0.1:8135/?route=AccountDeletion'});
  await waitFor('document.body.innerText.includes("계정 삭제")'); await capture('app-deletion-'+width, '601:3371');
  await evaluate(`document.querySelector('[role="checkbox"]').click()`); await click('계정 삭제');
  await capture('app-deletion-identity-'+width, '601:3416'); await click('삭제 요청 준비');
  await capture('app-deletion-pending-'+width, '601:3473');
  await call('Page.navigate', {url:'http://127.0.0.1:8135/?route=Contact'});
  await waitFor('document.body.innerText.includes("문의하기")'); await capture('app-contact-'+width,'601:3208');
 }
 assert.deepEqual(backendRequests, []); assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
 console.log('Application navigator: '+evidence.length+' captures, no backend calls');
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(()=>{browser?.kill();server.close();});
