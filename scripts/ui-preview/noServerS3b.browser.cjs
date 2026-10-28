/** Offline evidence: start schedule.preview Metro on 8113, then run this file. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const output = path.resolve('tmp/no-server-s3b-render');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-chatE-chrome-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style></head><body><div id="root"></div><script src="http://localhost:8113/scripts/ui-preview/noServerS3b.preview.bundle?platform=web&dev=false&minify=false"></script></body></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get('http://localhost:8113' + request.url, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); }).on('error', () => { response.writeHead(502); response.end(); });
});
let browser; let call;
const evidence = []; const errors = []; const blocked = []; let width=412,height=892;
async function viewport(w,h){width=w;height=h;await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 300; attempt++) { if (errors.length) throw new Error(JSON.stringify(errors[0])); if (await evaluate(expression)) return; await delay(150); }
  throw new Error('Timed out: ' + expression + ' / ' + await evaluate('document.body.innerText'));
}
const element = label => {
  const ordinary = '([...document.querySelectorAll(' + JSON.stringify('[aria-label=' + JSON.stringify(label) + ']') + ')].filter(e=>e.getBoundingClientRect().width>0).at(-1))';
  return label==='약속 확정' ? '(document.querySelector(' + JSON.stringify('[data-testid=voting-confirm-cta]') + ')||'+ordinary+')' : ordinary;
};
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
  console.log('capture',name);await delay(250);if(name!=='voting-direct-add')await evaluate('document.activeElement?.blur?.()');
  const metrics = await evaluate('(() => {' +
    'const rect=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:e.getAttribute("aria-label"),role:e.getAttribute("role"),x:r.x,y:r.y,width:r.width,height:r.height,background:s.backgroundColor,color:s.color,border:s.borderTopWidth,radius:s.borderTopLeftRadius,checked:e.getAttribute("aria-checked"),selected:e.getAttribute("aria-selected"),disabled:e.getAttribute("aria-disabled")};};' +
    'const messages=[...document.querySelectorAll("[aria-label]")].filter(e=>e.getAttribute("aria-label")?.includes(", "));const messageGeometry=messages.map(e=>{const label=e.getAttribute("aria-label"),text=label.slice(label.indexOf(", ")+2),leaf=[...e.querySelectorAll("[dir=auto]")].find(n=>n.innerText===text);return {label,touch:rect(e),parent:rect(e.parentElement),bubble:leaf?rect(leaf.parentElement):null};});const list=document.querySelector("[data-testid=chat-message-list]");const compact=document.querySelector("[data-testid=meeting-card-compact]");return {messageGeometry,sheets:[...document.querySelectorAll(\'[data-testid=auth-sheet-surface]\')].map(rect),messageList:list?rect(list):null,compact:compact?rect(compact):null,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,text:document.body.innerText,textNodes:[...document.querySelectorAll("[dir=auto]")].filter(e=>e.children.length===0&&e.innerText).map(e=>({...rect(e),text:e.innerText,fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,fontFamily:getComputedStyle(e).fontFamily})),controls:[...document.querySelectorAll("[role=button],[role=radio],[role=checkbox],[role=tab],[role=switch]")].map(rect),messageTouches:[...document.querySelectorAll("[aria-label]")].filter(e=>e.getAttribute("aria-label")?.includes(", ")).map(rect),inputs:[...document.querySelectorAll("input,textarea")].map(rect),fixtureCalls:window.__s3bCalls||[]};})()');
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
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); await connectPipe();
  await call('Page.enable'); await call('Runtime.enable'); await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  await call('Browser.grantPermissions',{origin:'http://127.0.0.1:'+server.address().port,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
  await viewport(412,892);
  if (process.argv.includes('--touch-baseline')) {
    for(const scene of ['message-grouped','message-normal']) {await visit(scene,'네 번째'); await capture(scene+'-before','496:1126');}
    fs.copyFileSync(path.join(output,'metrics.json'),path.join(output,'touch-spacing-before.json'));return;
  }
  if (process.argv.includes('--spacing-baseline')) { await visit('message-grouped', '네 번째'); await capture('spacing-before', '496:1126'); fs.copyFileSync(path.join(output, 'metrics.json'), path.join(output, 'spacing-before.json')); return; }
  const before = JSON.parse(fs.readFileSync(path.join(output, 'touch-spacing-before.json'), 'utf8')).evidence;
  const spacing = [];
  for (const [scene, name, expectedGap] of [['message-grouped', 'spacing-after', 8], ['message-normal', 'message-normal-after', 14]]) {
    await visit(scene,'네 번째'); await capture(name,'496:1126'); const after = evidence.at(-1);
    const previous = before.find(item => item.name === scene + '-before');
    const geometry = after.messageGeometry.filter(message => message.bubble);
    assert.equal(geometry.length,4);
    for (const message of geometry) {
      const original = previous.messageGeometry.find(item => item.label === message.label);
      for (const key of ['x','y','width','height']) assert.equal(message.bubble[key],original.bubble[key],scene+' / '+message.label+' / '+key);
      assert.ok(message.touch.height>=44 && message.touch.width>=44);
      assert.ok(message.touch.y>=message.parent.y && message.touch.y+message.touch.height<=message.parent.y+message.parent.height);
    }
    const first = geometry.find(item => item.label === '나, 첫 번째'), next = geometry.find(item => item.label === '나, 두 번째');
    const gap = next.bubble.y-first.bubble.y-first.bubble.height;assert.equal(gap,expectedGap);
    spacing.push({scene,gap,before:previous.messageGeometry,after:geometry});
  }
  fs.writeFileSync(path.join(output,'touch-spacing-comparison.json'),JSON.stringify({spacing},null,2));
  await visit('invite-missing-code','코드를 불러오지 못했어요'); await capture('invite-missing-code','528:1525'); assert.equal(await evaluate('Boolean('+element('메이트 초대')+')'), false);
  await visit('invite','방 상세정보'); await click('메이트 초대'); await waitFor('document.body.innerText.includes("공유하기")'); await capture('invite','561:1945');
  await click('초대 코드 복사'); await waitFor('document.body.innerText.includes("초대 코드를 복사했어요")'); await capture('invite-copied','628:1934'); assert.equal(await evaluate('navigator.clipboard.readText()'),'VF4HLD');
  await visit('members','멤버 4명'); await click('＋ 메이트 초대'); await waitFor('document.body.innerText.includes("공유하기")'); await capture('invite-from-members','561:1945'); await click('닫기'); await waitFor('document.body.innerText.includes("멤버 4명")');
  await visit('message','저는 국물 있는 거면 다 좋아요');
  const message = await evaluate('(()=>{const r=document.querySelector(\'[aria-label="모아, 저는 국물 있는 거면 다 좋아요"]\').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...message}); await delay(700); await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...message});
  await waitFor('document.body.innerText.includes("복사")'); await capture('message-menu','562:2031'); await click('메시지 복사'); await waitFor('document.body.innerText.includes("메시지를 복사했어요")'); await capture('message-copied','628:2371'); assert.equal(await evaluate('navigator.clipboard.readText()'),'저는 국물 있는 거면 다 좋아요');
  await visit('settlement-new','총 결제금액'); await capture('settlement-request','527:1747'); assert.equal(await evaluate('document.body.innerText.includes("3333-01-2345678")'), false); assert.equal(await evaluate('document.body.innerText.includes("•••• 5678")'), true); assert.equal(await evaluate('Boolean('+element('계좌 끝자리 5678')+')'),true);
  await visit('settlement-no-account','받을 계좌가 아직 없어요'); await capture('settlement-no-account','562:1879');
  await click('계좌 등록하기'); await waitFor('document.body.innerText.includes("프로필 계좌 등록 fixture")'); await click('fixture 계좌 저장 후 뒤로'); await waitFor('document.body.innerText.includes("계좌를 등록했어요")'); await capture('settlement-returned-account','590:1896');
  assert.ok((await evaluate('window.__s3bCalls')).some(call=>call.name==='reloadProfile'));
  await visit('settlement-registered','계좌를 등록했어요'); await capture('settlement-registered','590:1896');
  await visit('settlement-existing','13,000원'); await capture('settlement-existing','527:1747');
  await visit('settlement-sender','13,000원'); await click('나야나 (나), 대기'); await waitFor('document.body.innerText.includes("13,000원 보냈나요?")'); await capture('settlement-sender-confirmation','563:1936');
  assert.equal(evidence.at(-1).sheets.length,1); assert.equal(await evaluate('window.__s3bCalls.some(call=>call.name==="setSettlementCompleted")'),false);
  await click('아직이요'); assert.equal(await evaluate('window.__s3bCalls.some(call=>call.name==="setSettlementCompleted")'),false); await click('나야나 (나), 대기'); await click('보냈어요'); await waitFor('window.__s3bCalls.some(call=>call.name==="setSettlementCompleted")');
  await visit('settlement-returned-existing','13,000원');
  assert.equal(await evaluate(element('총 결제금액')+'.value'),'52,000');
  await click('나야나 (나), 대기'); await waitFor('document.body.innerText.includes("13,000원 보냈나요?")'); await capture('settlement-server-amount-confirmation','563:1936');
  assert.equal(await evaluate('document.body.innerText.includes("17,500원")'),false);
  await visit('settlement-short-account','계좌 등록됨'); await capture('settlement-short-account','527:1747');
  assert.equal(await evaluate('document.body.innerText.includes("••••")'),false);
  assert.equal(await evaluate('Boolean('+element('계좌 등록됨')+')'),true);
  await visit('transfer','식사 정산'); await click('나야나 (나), 대기'); await waitFor('document.body.innerText.includes("13,000원 보냈나요?")'); await capture('transfer-confirmation','563:1936'); assert.equal(await evaluate('window.__s3bCalls.some(call=>call.name==="setSettlementCompleted")'),false);
  await click('아직이요'); assert.equal(await evaluate('window.__s3bCalls.some(call=>call.name==="setSettlementCompleted")'),false);
  await click('나야나 (나), 대기'); await click('보냈어요'); await waitFor('window.__s3bCalls.some(call=>call.name==="setSettlementCompleted")');
  await visit('more-requester','식사 정산'); await click('식사 정산 정산 더보기'); await waitFor('document.body.innerText.includes("정산 내용 복사")'); await capture('more-requester','629:1858'); await click('정산 내용 복사'); await waitFor('document.body.innerText.includes("정산 내용을 복사했어요")'); assert.ok((await evaluate('navigator.clipboard.readText()')).includes('13,000원'));
  await visit('more-sender','식사 정산'); await click('식사 정산 정산 더보기'); await waitFor('document.body.innerText.includes("채팅방에 묻기")'); await capture('more-sender','629:1993'); await click('채팅방으로 가기'); await waitFor('document.body.innerText.includes("저는 국물 있는 거면 다 좋아요")');
  assert.deepEqual(blocked,[]); assert.deepEqual(errors,[]);
  for (const stale of ['failure.txt', 'browser-errors.json']) fs.rmSync(path.join(output,stale),{force:true});
  fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify({evidence,errors,blocked},null,2));console.log(JSON.stringify({output,captures:evidence.length,errors:errors.length,blocked:blocked.length}));
}

main().catch(error=>{fs.writeFileSync(path.join(output,'browser-errors.json'),JSON.stringify({errors,blocked},null,2));fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack));console.error(error);process.exitCode=1;}).finally(()=>{browser?.kill();server.close();});
