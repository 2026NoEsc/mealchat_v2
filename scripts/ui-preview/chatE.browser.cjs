/** Offline evidence: start schedule.preview Metro on 8102, then run this file. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const output = path.resolve('tmp/chat-e-render');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-chatE-chrome-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style></head><body><div id="root"></div><script src="http://localhost:8102/scripts/ui-preview/chatE.preview.bundle?platform=web&dev=false&minify=false"></script></body></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get('http://localhost:8102' + request.url, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); }).on('error', () => { response.writeHead(502); response.end(); });
});
let browser; let call;
const evidence = []; const errors = []; const blocked = []; let width=412,height=892;
async function viewport(w,h){width=w;height=h;await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});}
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
async function visit(scene, expected) {
  await call('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/?scene=' + scene });
  await waitFor('document.body.innerText.includes(' + JSON.stringify(expected) + ')');
  await evaluate('document.fonts.ready.then(() => true)');
  await waitFor('[...document.images].every(image => image.complete && image.naturalWidth > 0)');
}
async function capture(name, figma) {
  console.log('capture',name);await evaluate('document.activeElement?.blur?.()');await delay(120);
  const metrics = await evaluate('(() => {' +
    'const rect=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:e.getAttribute("aria-label"),role:e.getAttribute("role"),x:r.x,y:r.y,width:r.width,height:r.height,background:s.backgroundColor,color:s.color,border:s.borderTopWidth,radius:s.borderTopLeftRadius,checked:e.getAttribute("aria-checked"),selected:e.getAttribute("aria-selected"),disabled:e.getAttribute("aria-disabled")};};' +
    'const list=document.querySelector("[data-testid=chat-message-list]");const compact=document.querySelector("[data-testid=meeting-card-compact]");return {messageList:list?rect(list):null,compact:compact?rect(compact):null,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,text:document.body.innerText,textNodes:[...document.querySelectorAll("[dir=auto]")].filter(e=>e.children.length===0&&e.innerText).map(e=>({...rect(e),text:e.innerText,fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,fontFamily:getComputedStyle(e).fontFamily})),controls:[...document.querySelectorAll("[role=button],[role=radio],[role=checkbox],[role=tab],[role=switch]")].map(rect),inputs:[...document.querySelectorAll("input,textarea")].map(rect),fixtureCalls:window.__chatEFixtureCalls||[]};})()');
  assert.equal(metrics.width,width); assert.equal(metrics.height,height); assert.equal(metrics.overflow,false);
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
  await viewport(412,892);
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'{const NativeDate=Date;const realStart=NativeDate.now();class FixtureDate extends NativeDate{constructor(...args){super(...(args.length?args:["2026-09-27T01:30:00Z"]));}static now(){return new NativeDate("2026-09-27T01:30:00Z").getTime()+NativeDate.now()-realStart;}}window.Date=FixtureDate;}'});
  await visit('chat','식당을 함께 골라 보세요'); await capture('chat-unselected','496:1126');
  await click('메뉴 펼치기'); await waitFor('document.body.innerText.includes("N빵 정산")'); await capture('action-tray','527:1393');
  await click('이모티콘'); await capture('emoticon-panel','527:1507');
  await click('두두 하트 이모티콘 보내기'); await waitFor('window.__chatEFixtureCalls.some(c=>c.name==="sendSticker")'); await capture('sent-emoticon','628:1829');
  assert.ok((await evaluate('window.__chatEFixtureCalls')).some(c=>c.name==='sendSticker'&&c.args.id==='dudu-love'));
  await visit('members','멤버 4명'); await capture('members-sheet','528:1399');
  await call('Browser.grantPermissions',{origin:'http://127.0.0.1:'+server.address().port,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
  await click('초대 코드 복사'); await waitFor('Boolean('+element('복사됨')+')'); assert.equal(await evaluate('navigator.clipboard.readText()'),'VF4HLD');
  await click('＋ 메이트 초대'); await waitFor('window.__chatEFixtureCalls.some(c=>c.name==="sendMessage")');
  await visit('detail-owner','방 없애기'); await capture('detail-owner','528:1525');
  await click('장소 정하기'); await waitFor('document.body.innerText.includes("가고 싶은 식당에 투표해 주세요")'); assert.ok((await evaluate('window.__chatEFixtureCalls')).some(c=>c.name==='fetchVoting'));
  await visit('detail-owner','방 없애기'); await click('방 없애기'); await waitFor('document.body.innerText.includes("방을 없앨까요?")'); await capture('delete-dialog','528:1604');
  await click('그대로 둘게요'); assert.equal(await evaluate('window.__chatEFixtureCalls.some(c=>c.name==="leaveRoom")'),false);
  await click('방 없애기'); await click('없애기'); await waitFor('document.body.innerText.includes("이동 결과: Home")'); assert.ok((await evaluate('window.__chatEFixtureCalls')).some(c=>c.name==='leaveRoom'&&c.args==='room'));
  await visit('detail-mate','방 상세정보'); await capture('detail-mate','561:1734'); assert.equal(await evaluate('Boolean('+element('방 없애기')+')'),false); assert.equal(await evaluate('Boolean('+element('방 나가기')+')'),false);
  await visit('place-confirmed','조선칼국수 하단점'); await capture('chat-place-confirmed','496:1202');
  await visit('time-unset','일정이 정해지면 시작할 수 있어요'); await capture('chat-time-unset','496:1126'); assert.equal(await evaluate(element('식당 정하기')+'.getAttribute("aria-disabled")'),'true'); assert.equal(await evaluate('document.body.innerText.includes("2099")'),false);
  await visit('message-failure','메시지를 불러오지 못했어요'); await capture('message-failure','496:1126'); await click('다시 시도'); await waitFor('!document.body.innerText.includes("메시지를 불러오지 못했어요")');
  await visit('chat','식당을 함께 골라 보세요');await click('약속 확정');await waitFor('document.body.innerText.includes(' + JSON.stringify('가고 싶은 식당에 투표해 주세요') + ')');
  await evaluate("[...document.querySelectorAll('[aria-label=\"약속 확정\"]')].at(-1).click()");await waitFor('document.body.innerText.includes("약속을 확정할까요?")');await capture('plan-confirmation','540:1812');
  await click('다시 볼게요');assert.equal(await evaluate('window.__chatEFixtureCalls.some(c=>c.name==="confirmRoomVote")'),false);
  await evaluate("[...document.querySelectorAll('[aria-label=\"약속 확정\"]')].at(-1).click()");await click('확정하기');await waitFor('window.__chatEFixtureCalls.some(c=>c.name==="advanceRoomStage")');await click('메뉴 펼치기');assert.notEqual(await evaluate(element('N빵 정산')+'.getAttribute("aria-disabled")'),'true');
  let calls=await evaluate('window.__chatEFixtureCalls');assert.ok(calls.findIndex(c=>c.name==='confirmRoomVote')<calls.findIndex(c=>c.name==='advanceRoomStage'));
  await visit('confirm-retry','식당을 함께 골라 보세요');await click('약속 확정');await waitFor('document.body.innerText.includes("가고 싶은 식당에 투표해 주세요")');await evaluate("[...document.querySelectorAll('[aria-label=\"약속 확정\"]')].at(-1).click()");await click('확정하기');await waitFor('document.body.innerText.includes("식당은 저장됐지만")');await capture('plan-confirmation-retry','540:1812');await click('다시 확정하기');await waitFor('window.__chatEFixtureCalls.filter(c=>c.name==="advanceRoomStage").length===2');calls=await evaluate('window.__chatEFixtureCalls');assert.equal(calls.filter(c=>c.name==='confirmRoomVote').length,1);
  await visit('detail-loading','방 상세정보');await capture('detail-loading','528:1525');assert.ok(await evaluate('document.body.innerText.includes("••••••")'));
  await visit('detail-failure','방 정보를 불러오지 못했어요');await capture('detail-failure','528:1525');await click('다시 시도');await waitFor('document.body.innerText.includes("VF4HLD")');
  await visit('settled','방이 사라져요');await capture('chat-timer','496:1202');
  await visit('notice','위치 보기');await capture('chat-notice','496:1126');await click('위치 보기');await waitFor('document.body.innerText.includes("가고 싶은 식당에 투표해 주세요")');
  await viewport(360,640);await visit('place-unset','시간 미정');await capture('narrow-chat','496:1126');await click('메뉴 펼치기');await capture('narrow-action-tray','527:1393');await click('이모티콘');await capture('narrow-emoticon-panel','527:1507');
  await evaluate("document.querySelector('[aria-label=\"메시지\"]').focus()");await waitFor('!document.body.innerText.includes("이모티콘")');
  await visit('keyboard','오늘 저녁팟');await capture('narrow-keyboard-simulated','496:1126');
  for(const item of evidence.filter(item=>item.name.startsWith('narrow-'))){assert.ok(item.messageList.height>100,JSON.stringify(item.messageList));if(item.name!=='narrow-chat')assert.ok(item.compact);}
  assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify({evidence,errors,blocked},null,2));console.log(JSON.stringify({output,captures:evidence.length,errors:errors.length,blocked:blocked.length}));
}
main().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack));console.error(error);process.exitCode=1;}).finally(()=>{browser?.kill();server.close();});
