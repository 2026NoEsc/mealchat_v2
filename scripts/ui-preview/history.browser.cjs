/** Offline evidence: start profileD.preview Metro on 8104, then run this file. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const output = path.resolve('tmp/history-render');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-profile-d-chrome-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style></head><body><div id="root"></div><script src="http://127.0.0.1:8104/scripts/ui-preview/history.preview.bundle?platform=web&dev=false&minify=false"></script></body></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get('http://127.0.0.1:8104' + request.url, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); }).on('error', () => { response.writeHead(502); response.end(); });
});
let browser; let call;
const evidence = []; const errors = []; const blocked = [];
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 400; attempt++) { if (await evaluate(expression)) return; await delay(150); }
  throw new Error('Timed out: ' + expression + ' / ' + await evaluate('document.body.innerText'));
}
const element = label => 'document.querySelector(' + JSON.stringify('[aria-label=' + JSON.stringify(label) + ']') + ')';
async function click(label) {
  await waitFor('Boolean(' + element(label) + ')');
  await evaluate(element(label) + '.click()');
  await delay(100);
}
async function fill(label, value) {
  await evaluate('(() => { const e=document.querySelector(' + JSON.stringify('input[aria-label=' + JSON.stringify(label) + '],textarea[aria-label=' + JSON.stringify(label) + ']') + '); const setter=Object.getOwnPropertyDescriptor(e.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value").set; setter.call(e,' + JSON.stringify(value) + ');e.dispatchEvent(new Event("input",{bubbles:true})); })()');
}
async function visit(scene, expected) {
  await call('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/?scene=' + scene });
  await waitFor('document.body.innerText.includes(' + JSON.stringify(expected) + ')');
  await evaluate('document.fonts.ready.then(() => true)');
  await waitFor('[...document.images].every(image => image.complete && image.naturalWidth > 0)');
}
async function capture(name, figma) {
  console.log('capture',name);await delay(120);
  const metrics = await evaluate('(() => {' +
    'const rect=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:e.getAttribute("aria-label"),role:e.getAttribute("role"),x:r.x,y:r.y,width:r.width,height:r.height,background:s.backgroundColor,color:s.color,border:s.borderTopWidth,radius:s.borderTopLeftRadius,checked:e.getAttribute("aria-checked"),selected:e.getAttribute("aria-selected"),disabled:e.getAttribute("aria-disabled")};};' +
    'return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,text:document.body.innerText,textNodes:[...document.querySelectorAll("[dir=auto]")].filter(e=>e.children.length===0&&e.innerText).map(e=>({...rect(e),text:e.innerText,fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,fontFamily:getComputedStyle(e).fontFamily})),controls:[...document.querySelectorAll("[role=button],[role=radio],[role=checkbox],[role=tab],[role=switch]")].map(rect),inputs:[...document.querySelectorAll("input,textarea")].map(rect),regions:[...document.querySelectorAll("[data-testid]")].map(e=>({...rect(e),id:e.getAttribute("data-testid")})),horizontalOverflow:[...document.querySelectorAll("[role=button],[role=radio],[role=switch],input,textarea,[data-testid]")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left < -0.5||r.right>innerWidth+0.5)}).map(rect),fixtureCalls:window.__profileFixtureCalls||[]};})()');
  assert.ok([412,375].includes(metrics.width)); assert.equal(metrics.height,metrics.width===412?892:812); assert.equal(metrics.overflow,false); assert.deepEqual(metrics.horizontalOverflow,[]);
  const visible=metrics.controls.filter(c=>c.width>0&&c.height>0);
  assert.ok(visible.every(c=>c.height>=43.9&&c.width>=43.9),JSON.stringify(visible.filter(c=>c.height<43.9||c.width<43.9)));
  assert.ok(metrics.inputs.filter(c=>c.width>0&&c.height>0).every(c=>c.height>=43.9&&c.width>=43.9));
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(shot.data,'base64'));
  evidence.push({name,figma,...metrics});fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify({evidence,errors,blocked},null,2));
}
// Chrome DevTools pipe transport avoids a local WebSocket debugging port.
async function connectPipe() {
  browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new','--disable-gpu','--in-process-gpu','--disable-gpu-shader-disk-cache','--disable-background-networking','--no-first-run','--remote-debugging-pipe','--user-data-dir='+profile,'about:blank'],
    {windowsHide:true,stdio:['ignore','ignore','pipe','pipe','pipe']});
  browser.stderr.on('data',chunk=>{ if(String(chunk).includes('FATAL'))process.stderr.write(chunk); });
  let sequence=0,buffer='',sessionId;
  const pending=new Map();
  browser.stdio[4].on('data',chunk=>{
    buffer+=chunk.toString();
    let end;
    while((end=buffer.indexOf('\0'))>=0){
      const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;
      const r=JSON.parse(raw);
      if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails);
      if(r.method==='Fetch.requestPaused'){
        const url=r.params.request.url;
        const allowed=['127.0.0.1','localhost'].includes(new URL(url).hostname)||url.startsWith('data:');
        if(!allowed)blocked.push(url);
        void call(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:r.params.requestId}:{requestId:r.params.requestId,errorReason:'BlockedByClient'});
      }
      if(!r.id)continue;
      const task=pending.get(r.id);if(!task)continue;pending.delete(r.id);
      if(r.error)task.reject(new Error(r.error.message));else task.resolve(r.result);
    }
  });
  call=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence;pending.set(id,{resolve,reject});
    setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(new Error('CDP timed out: '+method));}},20000).unref();
    const browserMethod=method.startsWith('Target.')||method.startsWith('Browser.');
    browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId&&!browserMethod?{sessionId}: {})})+'\0');
  });
  const version=await call('Browser.getVersion');console.log('CDP pipe connected',version.product);
  const target=await call('Target.createTarget',{url:'about:blank'});
  const session=await call('Target.attachToTarget',{targetId:target.targetId,flatten:true});sessionId=session.sessionId;
}
async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  await connectPipe();
  await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for (const width of [412,375]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:width===412?892:812,deviceScaleFactor:1,mobile:true});
    const shot = (name, figma) => capture(width+'-'+name,figma);
    await visit('history','회사 팀 점심');await shot('history','542:1534');
    await click('회사 팀 점심 영수증 보기');await waitFor('document.body.innerText.includes("MEALCHAT RECEIPT")');await shot('receipt','542:1633');
    await click('영수증 닫기');await waitFor('document.body.innerText.includes("밥약 기록")');
    await fill('밥약 기록 검색','모닝글로우');await waitFor('!document.body.innerText.includes("회사 팀 점심")');await shot('search','542:1534');
    await visit('empty','기록과 영수증 보관 기능을 준비');await shot('empty','542:1534');
    await visit('contact','문의하기');await fill('문의 내용','로컬 문의 예시');await shot('contact','601:3208');
    await click('보내기 · 준비 중');await waitFor('document.body.innerText.includes("전송되지 않았어요")');await shot('contact-pending','601:3208');
  }
  assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify({evidence,errors,blocked},null,2));
  console.log(JSON.stringify({output,captures:evidence.length,errors:errors.length,blocked:blocked.length}));
}
main().catch(async error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack));fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify({evidence,errors,blocked},null,2));try { console.error(await evaluate('JSON.stringify({html:document.documentElement.outerHTML.slice(0,1500),resources:performance.getEntriesByType("resource").map(r=>({name:r.name,duration:r.duration,size:r.transferSize})),state:document.readyState})')); } catch {} console.error(error);process.exitCode=1;}).finally(()=>{browser?.kill();server.close();});

