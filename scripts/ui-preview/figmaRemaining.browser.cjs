/** Offline S5 review capture: synthetic contract fixtures, all external network blocked. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const output = path.resolve('tmp/figma-remaining-render');
fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style><div id="root"></div><script src="http://localhost:8123/scripts/ui-preview/figmaRemaining.preview.bundle?platform=web&dev=false&minify=false"></script></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get('http://localhost:8123' + request.url, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); })
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
 await new Promise(resolve=>server.listen(8124,'127.0.0.1',resolve)); await connect();
 await call('Emulation.setDeviceMetricsOverride',{width:412,height:892,deviceScaleFactor:1,mobile:true});
 const source=fs.readFileSync('src/screens/preview/FigmaRemainingGallery.tsx','utf8');
 const scenes=[...source.matchAll(/\{ id: '([^']+)', node: '([^']+)', label:/g)].map(match=>[match[1],match[2]]);
 assert.equal(scenes.length,30);
 for(const width of [412,375]){
 await call('Emulation.setDeviceMetricsOverride',{width,height:892,deviceScaleFactor:1,mobile:true});
 for(const [scene,node] of scenes){
 if(process.env.PREVIEW_SCENE && scene!==process.env.PREVIEW_SCENE)continue;
 console.log('Remaining: '+scene); await call('Page.navigate',{url:'http://127.0.0.1:8125/?scene='+scene});
 await waitFor('document.body.innerText.includes("디자인 미리보기 · 실제 처리되지 않아요")');
 await evaluate('document.fonts.ready.then(()=>true)'); await delay(400);
 await capture(scene+'-'+width+'x892',node);
 assert.ok(evidence.at(-1).assets.every(asset=>asset.loaded),'Unloaded image: '+scene);
 if(scene==='notifications'){ await click('알림 받기'); assert.equal(await evaluate(`document.querySelector('[aria-label="알림 받기"]').getAttribute('aria-checked')`),'false'); }
 if(scene==='password'){assert.equal(await evaluate('document.querySelectorAll("input").length'),0);await evaluate(`document.querySelectorAll('[aria-label="계정 삭제"]')[1].click()`);await waitFor('document.body.innerText.includes("완료 시안 예시")');}
 if(scene==='receipt-result'){await click('된장찌개 금액 예시 바꾸기');await waitFor('document.body.innerText.includes("52,500원")');}
 if(scene==='reply'){await click('로컬 답장 표시');await waitFor('document.body.innerText.includes("전송되지 않아요")');}
 if(scene==='report'){await click('욕설 · 비하');await click('신고 보내기');await waitFor('document.body.innerText.includes("실제 접수되지 않았어요")');}
 if(scene==='block'){await click('차단하기');await waitFor('document.body.innerText.includes("실제 차단되지 않았어요")');}
 if(scene==='settlement-cancel'){await click('정산 취소');await waitFor('document.body.innerText.includes("실제 정산은 취소되지 않았어요")');}
 if(scene==='menu-craving'){await click('아무거나');assert.equal(await evaluate(`document.querySelector('[aria-label="고기"]').getAttribute('aria-checked')`),'false');await click('메뉴 후보 보기');await waitFor('document.body.innerText.includes("우리에게 잘 맞는 메뉴 8개")');}
 if(scene==='menu-evaluate'){await click('삼겹살 별로예요');assert.equal(await evaluate(`document.querySelector('[aria-label="삼겹살 별로예요"]').getAttribute('aria-checked')`),'true');}
 if(scene==='invite'){await click('복사');await waitFor('document.body.innerText.includes("클립보드에는 쓰지 않아요")');}
 if(scene==='location-denied'){await click('직접 검색');assert.equal(await evaluate(`!!document.querySelector('[aria-label="출발지 검색 예시"]')`),true);}
 if(scene==='message-failure'){await click('다시 보내기 예시');await waitFor('document.body.innerText.includes("실제 전송되지 않아요")');}
 }
 }
 assert.deepEqual(backendRequests,[]);
 await call('Page.navigate',{url:'http://127.0.0.1:8125/'});
 await waitFor('document.body.innerText.includes("화면 미리보기")');
 assert.equal(await evaluate(`document.querySelectorAll('[aria-label^="과거 메뉴 투표 시안"]').length`),8);
 if(!process.env.PREVIEW_SCENE) fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({scenes,captures:evidence.length,viewports:[412,375].map(width=>({width,height:892,captures:evidence.filter(item=>item.viewport.width===width).length})),externalRequests:blocked.length,runtimeErrors:errors.length,backendRequests:backendRequests.length,scope:'Local synthetic fixtures only; no backend/provider integration'},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);console.log('Passed '+evidence.length+' captures; external calls: 0');
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(()=>{browser?.kill();server.close();});
