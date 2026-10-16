/** Offline evidence: start schedule.preview Metro on 8097, then run this file. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const output = path.resolve('tmp/schedule-review');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-schedule-chrome-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style></head><body><div id="root"></div><script src="http://localhost:8097/scripts/ui-preview/schedule.preview.bundle?platform=web&dev=false&minify=false"></script></body></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get('http://localhost:8097' + request.url, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); }).on('error', () => { response.writeHead(502); response.end(); });
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
async function capture(name, figma, legacyScope = false) {
  console.log('capture',name);await delay(120);
  const metrics = await evaluate('(() => {' +
    'const rect=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:e.getAttribute("aria-label"),role:e.getAttribute("role"),x:r.x,y:r.y,width:r.width,height:r.height,background:s.backgroundColor,color:s.color,border:s.borderTopWidth,radius:s.borderTopLeftRadius,checked:e.getAttribute("aria-checked"),selected:e.getAttribute("aria-selected"),disabled:e.getAttribute("aria-disabled")};};' +
    'return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,text:document.body.innerText,textNodes:[...document.querySelectorAll("[dir=auto]")].filter(e=>e.children.length===0&&e.innerText).map(e=>({...rect(e),text:e.innerText,fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,fontFamily:getComputedStyle(e).fontFamily})),controls:[...document.querySelectorAll("[role=button],[role=radio],[role=checkbox],[role=tab],[role=switch]")].map(rect),inputs:[...document.querySelectorAll("input,textarea")].map(rect),fixtureCalls:window.__scheduleFixtureCalls||[]};})()');
  assert.equal(metrics.width,412); assert.equal(metrics.height,892); assert.equal(metrics.overflow,false);
  const visible=metrics.controls.filter(c=>c.width>0&&c.height>0);
  metrics.legacyScope = legacyScope;
  metrics.smallTargets = visible.filter(c=>c.height<43.9||c.width<43.9);
  if (!legacyScope) assert.deepEqual(metrics.smallTargets,[]);
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
      if(r.method==='Page.javascriptDialogOpening')void call('Page.handleJavaScriptDialog',{accept:true});
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
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'{const NativeDate=Date;const realStart=NativeDate.now();class FixtureDate extends NativeDate{constructor(...args){super(...(args.length?args:["2026-09-25T01:00:00Z"]));}static now(){return new NativeDate("2026-09-25T01:00:00Z").getTime()+NativeDate.now()-realStart;}}window.Date=FixtureDate;}'});
  console.log('visit calendar');await visit('calendar','내 캘린더');await capture('calendar-september','524:1318');
  await click('이전 달');await waitFor('document.body.innerText.includes("2026년 8월")');assert.equal(await evaluate(element('이전 달')+'.getAttribute("aria-disabled")'),'true');await capture('calendar-august','599:3036');
  await click('다음 달');await click('다음 달');await waitFor('document.body.innerText.includes("2026년 10월")');assert.equal(await evaluate(element('다음 달')+'.getAttribute("aria-disabled")'),null);await capture('calendar-october','599:2781');
  await click('이전 달');await click('9월 27일, 일정 1개');await waitFor('document.body.innerText.includes("회사 팀 점심")');await capture('calendar-day27','599:3326');
  await click('일정 추가');await fill('일정 이름','알바');await fill('시작 시간','1000');await fill('끝 시간','1500');await capture('event-add','559:1916');
  await click('약속 메모');await fill('약속 메모','저녁 약속 잡기 좋은 날');await capture('event-memo','559:1916');await click('일정');assert.equal(await evaluate(element('일정 이름')+'.value'),'알바');await click('닫기');
  await click('회사 팀 점심 일정 수정');await capture('event-edit','599:3641');await click('일정 삭제');await waitFor('!document.body.innerText.includes("회사 팀 점심")');
  await visit('detail','어떻게 만날까요?');await capture('detail','524:1572');
  await click('직접 검색');await fill('출발지 검색','서면역');await click('검색');await waitFor('document.body.innerText.includes("서면역 1호선")');await click('서면역 1호선, 부산 부산진구 중앙대로 지하 730');await capture('origin-search','599:3969');await click('이 위치로 정하기');await waitFor('document.body.innerText.includes("어떻게 만날까요?")');assert.equal(await evaluate(element('약속 이름')+'.value'),'오늘 저녁팟');assert.ok((await evaluate('document.body.innerText')).includes('서면역 1호선'));
  await click('다음');await waitFor('document.body.innerText.includes("언제 만날까요?")');await capture('time','524:1675');await click('선택 완료');await waitFor('document.body.innerText.includes("1순위")');await capture('recommend-first','524:1830');
  const second=await evaluate('document.querySelectorAll("[role=radio]")[1].getAttribute("aria-label")');await click(second);await capture('recommend-second','599:4067');assert.equal(await evaluate('[...document.querySelectorAll("[role=radio]")].map(e=>e.getAttribute("aria-checked")).join(",")'),'false,true,false');
  await visit('detail-denied','어떻게 만날까요?');await click('현재 위치로');await waitFor('document.body.innerText.includes("위치 권한이 꺼져 있어요")');await capture('location-denied','683:18201');await click('직접 검색');await waitFor('document.body.innerText.includes("내가 출발하는 곳")');
  await visit('failure','모두 되는 시간을 계산하지 못했어요');assert.equal(await evaluate(element('식당 정하러 가기')+'.getAttribute("aria-disabled")'),'true');await capture('recommend-failure','683:13139');await click('다시 시도');await waitFor('document.body.innerText.includes("1순위")');
  await visit('components','일정 공용 컴포넌트');await capture('components','597:2236,598:2362,598:2376');
  await visit('detail-requestable','어떻게 만날까요?');await click('현재 위치로');await waitFor('document.body.innerText.includes("권한 다시 요청")');await capture('location-requestable','683:18201');
  await visit('calendar','내 캘린더');await click('Medive 스터디 일정 수정');await capture('event-edit-legacy','599:3641');assert.equal(await evaluate(element('기존 색상')+'.getAttribute("aria-checked")'),'true');
  await visit('detail-profile','어떻게 만날까요?');await waitFor('document.body.innerText.includes("프로필 출발지")');await capture('origin-profile','524:1572');
  for(const [scene,expected] of [['prereq-midpoint','등록된 출발지가 없어요'],['prereq-candidates','근처에서 식당 후보를 찾지 못했어요'],['prereq-room-error','밥약 정보를 불러오지 못했어요'],['prereq-room-missing','밥약을 찾을 수 없어요']]){await visit(scene,expected);await capture(scene,'683:13139');assert.equal((await evaluate('window.__scheduleFixtureCalls')).includes('schedule-recommend'),false);}
  await visit('chat-pending','시간 확정 전');await capture('chat-time-pending','검토 1',true);
  await visit('owner-delete','방 없애기');await click('방 없애기');await waitFor('document.body.innerText.includes("오늘 저녁팟을 없앴어요")');await capture('owner-deleted-toast','590:2077');assert.ok((await evaluate('document.body.innerText')).includes('2개'));await delay(3100);assert.equal((await evaluate('document.body.innerText')).includes('없앴어요'),false);
  await call('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await visit('time','언제 만날까요?');
  const narrow=await evaluate('(() => {const c=[...document.querySelectorAll("[role=checkbox]")].filter(e=>e.getAttribute("aria-label")?.includes("시 ~"));return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,cells:c.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};}),scroll:[...document.querySelectorAll("div")].filter(e=>getComputedStyle(e).overflowX==="auto"||getComputedStyle(e).overflowX==="scroll").map(e=>({client:e.clientWidth,scroll:e.scrollWidth}))};})()');
  assert.equal(narrow.overflow,false);assert.ok(narrow.cells.every(c=>c.width>=43.9&&c.height>=43.9&&c.left>=0&&c.right<=360));assert.ok(narrow.scroll.every(s=>s.scroll<=s.client+1));
  const narrowShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,'time-360.png'),Buffer.from(narrowShot.data,'base64'));fs.writeFileSync(path.join(output,'narrow-metrics.json'),JSON.stringify(narrow,null,2));
  assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify({evidence,errors,blocked},null,2));console.log(JSON.stringify({output,captures:evidence.length,errors:errors.length,blocked:blocked.length}));
}
main().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack));console.error(error);process.exitCode=1;}).finally(()=>{browser?.kill();server.close();});
