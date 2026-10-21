/** Offline evidence: start schedule.preview Metro on 8101, then run this file. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const output = path.resolve('tmp/home-c-render');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-homeC-chrome-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style></head><body><div id="root"></div><script src="http://localhost:8101/scripts/ui-preview/homeC.preview.bundle?platform=web&dev=false&minify=false"></script></body></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get('http://localhost:8101' + request.url, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); }).on('error', () => { response.writeHead(502); response.end(); });
});
let browser; let call;
const evidence = []; const errors = []; const blocked = [];
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 200; attempt++) { if (await evaluate(expression)) return; await delay(150); }
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
    'return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,text:document.body.innerText,textNodes:[...document.querySelectorAll("[dir=auto]")].filter(e=>e.children.length===0&&e.innerText).map(e=>({...rect(e),text:e.innerText,fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,fontFamily:getComputedStyle(e).fontFamily})),controls:[...document.querySelectorAll("[role=button],[role=radio],[role=checkbox],[role=tab],[role=switch]")].map(rect),inputs:[...document.querySelectorAll("input,textarea")].map(rect),fixtureCalls:window.__homeCFixtureCalls||[]};})()');
  assert.equal(metrics.width,412); assert.equal(metrics.height,892); assert.equal(metrics.overflow,false);
  const visible=metrics.controls.filter(c=>c.width>0&&c.height>0);
  assert.ok(visible.every(c=>c.height>=43.9&&c.width>=43.9),JSON.stringify(visible.filter(c=>c.height<43.9||c.width<43.9)));
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
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); console.log('server ready');
  await connectPipe();
  await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await call('Emulation.setDeviceMetricsOverride',{width:412,height:892,deviceScaleFactor:1,mobile:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'{const NativeDate=Date;const realStart=NativeDate.now();class FixtureDate extends NativeDate{constructor(...args){super(...(args.length?args:["2026-09-27T01:30:00Z"]));}static now(){return new NativeDate("2026-09-27T01:30:00Z").getTime()+NativeDate.now()-realStart;}}window.Date=FixtureDate;}'});
  await visit('main','내 밥약');await capture('home-main','521:1248');
  await click('새 밥약 또는 초대 코드');await waitFor('getComputedStyle('+element('초대 코드 입력')+'.parentElement).opacity > 0.99');await capture('home-menu','521:1331');
  await click('초대 코드 입력');await waitFor('document.querySelector("input") !== null');await capture('join-code','543:1665');await fill('초대 코드','ABC123');await click('입장');await waitFor('document.body.innerText.includes("joined-room")');
  assert.ok((await evaluate('window.__homeCFixtureCalls')).some(c=>c.name==='joinRoom'&&c.args==='ABC123'));
  await visit('empty','아직 잡힌 밥약이 없어요.');assert.equal(await evaluate('Boolean('+element('새 밥약 또는 초대 코드')+')'),false);await capture('home-empty','559:1805');await click('새 밥약 만들기');await waitFor('document.body.innerText.includes("ScheduleDetail")');
  await visit('failure','밥약을 불러오지 못했어요');await capture('home-failure','563:2123');await click('다시 시도');await waitFor('document.body.innerText.includes("내 밥약")');assert.ok((await evaluate('window.__homeCFixtureCalls')).some(c=>c.name==='reloadRooms'));
  await visit('refreshing','내 밥약'); assert.equal(await evaluate('Boolean('+element('새 밥약 또는 초대 코드')+')'),true); await capture('home-refreshing','521:1248');
  await visit('stale','이전에 불러온 밥약이에요.');await capture('home-stale','563:2123');
  await visit('deleted','내 밥약');await capture('home-deleted','590:2077');await visit('left','내 밥약');await capture('home-left','590:2164');
  await visit('main','내 밥약');await click('알림, 읽지 않은 알림 있음');await delay(200);await capture('notifications','521:1429');
  await click('정산 알림');await capture('notifications-settlement','599:2587');assert.ok((await evaluate('document.body.innerText')).includes('N빵 정산 요청이 도착했어요'));assert.equal(await evaluate('Boolean('+element('안 읽음, 일정이 확정됐어요!, 오늘 저녁팟 · 9월 25일 (금) 19:00')+')'),false);
  await click('메이트 알림'); await waitFor('document.body.innerText.includes("아직 메이트 알림이 없어요")'); await capture('notifications-mates-empty','599:2587');
  await click('전체 알림');await click('모두 읽음');await capture('notifications-read','599:2425');assert.equal(await evaluate(element('모두 읽음')+'.getAttribute("aria-disabled")'),'true');assert.equal(await evaluate('Boolean('+element('알림')+')'),true);assert.ok((await evaluate('window.__homeCFixtureCalls')).some(c=>c.name==='markRead'));
  await evaluate('[...document.querySelectorAll("[role=button]")].find(e=>e.getAttribute("aria-label")?.startsWith("읽음, 일정이 확정됐어요!")).click()');await waitFor('document.body.innerText.includes("ChatRoom")');
  await visit('settlements','토스로 보내기');await capture('settlements','521:1575');
  await call('Browser.grantPermissions',{origin:'http://127.0.0.1:'+server.address().port,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
  await click('계좌 복사');await waitFor('Boolean('+element('복사됨')+')');assert.equal(await evaluate('navigator.clipboard.readText()'),'카카오뱅크 3333-01-2345678');
  await click('나야나 (나), 대기');assert.ok((await evaluate('window.__homeCFixtureCalls')).some(c=>c.name==='setCompleted'&&c.args.id==='member-0'&&c.args.completed));
  await visit('settlement-stale','토스로 보내기'); await click('나야나 (나), 대기'); await waitFor('document.body.innerText.includes("이전에 불러온 정산이에요")'); assert.equal(await evaluate("document.querySelector('[aria-label=\"토스로 보내기\"]').getAttribute('aria-disabled')==='true'"),true);
  await capture('settlement-stale','521:1575'); await click('다시 시도'); await waitFor("document.querySelector('[aria-label=\"토스로 보내기\"]').getAttribute('aria-disabled')!=='true'");
  await visit('settlement-failure','정산을 불러오지 못했어요');await capture('settlement-failure','563:2123');await click('다시 시도');await waitFor('document.body.innerText.includes("토스로 보내기")');
  await visit('components','홈 공용 컴포넌트');await capture('components','597:2254,598:2385,598:2394');await click('복사');await waitFor('Boolean('+element('복사됨')+')');assert.equal(await evaluate('navigator.clipboard.readText()'),'복사 검증 문자열');
  assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify({evidence,errors,blocked},null,2));console.log(JSON.stringify({output,captures:evidence.length,errors:errors.length,blocked:blocked.length}));
}
main().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack));console.error(error);process.exitCode=1;}).finally(()=>{browser?.kill();server.close();});
