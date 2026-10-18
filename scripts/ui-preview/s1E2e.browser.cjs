/* Real local-stack/application E2E. No dotenv, service credentials or persisted sessions in logs. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');
const { Buffer } = require('node:buffer');
const output = path.resolve('tmp/s1-e2e'); fs.mkdirSync(output, { recursive: true });
const apiUrl = 'http://127.0.0.1:54321';
const statusText = execFileSync('powershell.exe', ['-NoProfile', '-Command', 'npx supabase status -o json'], { encoding: 'utf8', windowsHide: true });
const local = JSON.parse(statusText.slice(statusText.indexOf('{')));
if (local.API_URL !== apiUrl || !local.ANON_KEY) throw new Error('Project-local API/public key unavailable.');
const identity = execFileSync('docker', ['inspect', '--format', '{{.Name}} {{json .NetworkSettings.Ports}}', 'supabase_db_mealchat_v2'], { encoding: 'utf8' });
if (!identity.startsWith('/supabase_db_mealchat_v2 ') || !identity.includes('54322')) throw new Error('Local DB identity mismatch.');
const clients = [], actors = ['owner', 'mate', 'friend', 'unrelated'].map((alias, index) => ({
  alias, name: ['S1 소유자', 'S1 메이트', 'S1 친구', 'S1 무관'][index],
  email: `s1-${alias}-${randomUUID()}@example.test`, password: 'S1!' + randomBytes(16).toString('hex'), id: null,
}));
for (const actor of actors) { actor.client = createClient(apiUrl, local.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); clients.push(actor.client); }
const evidence = { environment: { api: apiUrl, dbContainer: 'supabase_db_mealchat_v2', dbPort: 54322, remoteAccess: false }, cases: [], screenshots: [], runtimeErrors: [], blockedOrigins: [], phase: 'initializing' };
const save = () => fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2));
const check = (condition, message) => { if (!condition) throw new Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const mark = (id, data = {}) => { evidence.cases.push({ id, outcome: 'PASS', ...data }); save(); process.stdout.write('PASS ' + id + '\n'); };
const phase = name => { evidence.phase = name; save(); process.stdout.write('RUN ' + name + '\n'); };
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_mealchat_v2', 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: query, encoding: 'utf8', windowsHide: true }).trim();
const rpc = async (actor, name, args = {}) => {
  const result = await actor.client.rpc(name, args);
  check(!result.error, name + ' failed: ' + (result.error?.code ?? result.error?.status ?? 'unknown'));
  return result.data;
};
let browser, browserProfile, call, sessionId, missingManifest = false;
const routedRequests = { missingManifest: 0, legacyConsent: 0, accountSelect: 0 };
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style><div id="root"></div><script src="http://localhost:8113/scripts/ui-preview/s1E2e.preview.bundle?platform=web&dev=true&hot=false&minify=false"></script></html>');
  http.get('http://localhost:8113' + request.url, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); }).on('error', () => { response.writeHead(502); response.end(); });
});
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error('Browser expression failed at phase ' + evidence.phase);
  return result.result.value;
}
async function waitFor(expression, label, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(expression)) return; await delay(150); }
  throw new Error('Timed out: ' + label);
}
const has = value => `document.body.innerText.includes(${JSON.stringify(value)})`;
const requiredGate = () => `${has('약관이 새로 정리됐어요')} || ${has('가입 동의를 다시 확인해 주세요')}`;
async function click(label, prefix = false) {
  const done = await evaluate(`(() => {const label=${JSON.stringify(label)},prefix=${prefix};const nodes=[...document.querySelectorAll('[role="button"],[role="checkbox"],[role="switch"],[role="tab"]')];const e=nodes.find(e=>e.getClientRects().length&&e.getAttribute('aria-label')===label)||nodes.find(e=>e.getClientRects().length&&(prefix?(e.getAttribute('aria-label')||e.innerText).startsWith(label):e.innerText.trim()===label));if(!e||e.getAttribute('aria-disabled')==='true'||e.disabled)return false;e.click();return true;})()`);
  check(done, 'Control unavailable: ' + label); await delay(120);
}
async function input(label, value) {
  const done = await evaluate(`(() => {const e=document.querySelector('input[aria-label='+JSON.stringify(${JSON.stringify(label)})+']');if(!e)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
  check(done, 'Input unavailable: ' + label); await delay(80);
}
async function capture(name) {
  await evaluate('document.activeElement?.blur()'); await delay(160);
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(shot.data, 'base64')); evidence.screenshots.push(name + '.png'); save();
}
async function signInBrowser(actor) {
  const result = await evaluate(`window.__s1E2E.signIn(${JSON.stringify(actor.email)},${JSON.stringify(actor.password)})`);
  check(!result.code && result.id === actor.id, 'Browser sign-in failed');
}
async function nodeLogin(actor) {
  const result = await actor.client.auth.signInWithPassword({ email: actor.email, password: actor.password });
  check(!result.error && result.data.user, 'Fixture login failed'); actor.id = result.data.user.id;
}
async function signupUi(actor, optional) {
  phase('signup-' + actor.alias);
  await waitFor(has('가입하기'), 'start screen'); await click('가입하기');
  await input('닉네임', actor.name); await input('이메일', actor.email); await input('비밀번호', actor.password); await input('비밀번호 재확인', actor.password);
  await click('중복 확인'); await waitFor(has('사용할 수 있는 이메일'), 'email check'); await click('다음');
  await click('구글 캘린더 연동하러가기'); await click('음식 취향 입력하러가기');
  for (const label of ['고기', '해산물', '양식', '중식', '일식', '한식']) { await click(label + ' 좋아요'); await delay(180); }
  await waitFor(has('거의 다 왔어요'), 'signup terms');
  await click('[필수] 서비스 이용약관'); await click('[필수] 개인정보 처리방침');
  if (optional) { await click('[선택] 건강 관련 정보(알레르기·식단 제한) 수집·이용'); await click('[선택] 마케팅 정보 수신'); }
  await capture('signup-' + actor.alias + '-choices'); await click('회원가입 끝내기');
  await waitFor("window.__s1E2E.access().state==='accepted' && Boolean(document.querySelector('[role=tab][aria-label=홈]'))", 'accepted signup/home');
  await nodeLogin(actor);
  const status = await rpc(actor, 'get_my_consent_status');
  check(status.required.status === 'accepted', 'Signup required consent not accepted');
  check(status.health.status === (optional ? 'granted' : 'declined') && status.marketing.status === (optional ? 'granted' : 'declined'), 'Signup choices differ');
  const who = await evaluate('window.__s1E2E.who()'); check(who.confirmed, 'Local signup did not auto-confirm');
  mark('signup-' + actor.alias, { required: status.required.status, health: status.health.status, marketing: status.marketing.status, emailConfirmation: 'local auto-confirm enabled' });
  await capture('signup-' + actor.alias + '-home');
}
async function connect() {
  browserProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-s1-real-e2e-'));
  browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--remote-debugging-pipe','--user-data-dir='+browserProfile,'about:blank'], { windowsHide: true, stdio: ['ignore','ignore','pipe','pipe','pipe'] });
  let sequence = 0, buffer = ''; const pending = new Map();
  browser.stdio[4].on('data', chunk => {
    buffer += chunk.toString(); let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const raw = buffer.slice(0,end); buffer = buffer.slice(end+1); if (!raw) continue;
      const result = JSON.parse(raw);
      if (result.method === 'Runtime.exceptionThrown') evidence.runtimeErrors.push({ phase: evidence.phase, text: result.params.exceptionDetails.text });
      if (result.method === 'Fetch.requestPaused') {
        const url = new URL(result.params.request.url), allowed = ['127.0.0.1','localhost'].includes(url.hostname) || url.protocol === 'data:';
        if (/current_terms_consent_status|record_terms_consent/.test(url.pathname)) routedRequests.legacyConsent++;
        if (url.pathname.endsWith('/dutch_pay_bills') && /bank_name|account_number|account_holder/.test(url.searchParams.get('select') ?? '')) routedRequests.accountSelect++;
        let redirected;
        if (missingManifest && url.pathname.endsWith('/rpc/get_consent_manifest')) {
          // Real PostgREST missing-function response; never ALTER A's local schema or fabricate a response.
          url.pathname = url.pathname.replace(/get_consent_manifest$/, 'get_consent_manifest_missing_e2e');
          redirected = url.href; routedRequests.missingManifest++;
        }
        if (!allowed) evidence.blockedOrigins.push(url.origin);
        void call(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed ? { requestId: result.params.requestId, ...(redirected ? { url: redirected } : {}) } : { requestId: result.params.requestId, errorReason: 'BlockedByClient' });
      }
      if (!result.id) continue; const task = pending.get(result.id); pending.delete(result.id); if (!task) continue;
      if (result.error) task.reject(new Error('CDP command failed')); else task.resolve(result.result);
    }
  });
  call = (method, params = {}) => new Promise((resolve,reject) => { const id=++sequence; pending.set(id,{resolve,reject}); browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0'); });
  const { targetInfos } = await call('Target.getTargets'); sessionId = (await call('Target.attachToTarget',{targetId:targetInfos.find(t=>t.type==='page').targetId,flatten:true})).sessionId;
  await call('Page.enable'); await call('Runtime.enable'); await call('Fetch.enable'); await call('Emulation.setDeviceMetricsOverride',{width:412,height:892,deviceScaleFactor:1,mobile:true});
  await call('Emulation.setFocusEmulationEnabled', { enabled: true });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await call('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await call('Page.navigate',{url:origin+'/'});
  await waitFor("Boolean(window.__s1E2E) && document.body.innerText.includes('가입하기')", 'real application boot', 120000);
}
async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); await connect();
  await signupUi(actors[0], false); await evaluate('window.__s1E2E.signOut()');
  await signupUi(actors[1], true); await evaluate('window.__s1E2E.signOut()');
  phase('required-gate-reconsent');
  const friend = actors[2]; const created = await friend.client.auth.signUp({email:friend.email,password:friend.password,options:{data:{name:friend.name}}}); check(!created.error && created.data.user, 'Pending account signup failed'); friend.id=created.data.user.id;
  await signInBrowser(friend); await waitFor(requiredGate(), 'required gate');
  check(await evaluate("!document.querySelector('[role=tab]')"), 'Authenticated navigator leaked before consent');
  await capture('required-gate');
  await click('[필수] 서비스 이용약관 동의 보기'); await waitFor("Boolean(document.querySelector('[data-testid=legal-terms]'))", 'gate document'); await capture('required-gate-document'); await click('닫기');
  await click('건강정보 동의 철회'); await delay(250); check((await rpc(friend,'get_my_consent_status')).health.status==='withdrawn','Gate withdrawal failed');
  await click('나중에 하기 (로그아웃)'); await waitFor(has('가입하기'),'gate logout'); await signInBrowser(friend); await waitFor(requiredGate(),'gate again');
  const denied = await friend.client.rpc('get_my_profile_visibility'); check(denied.error?.code==='S1001','Pending profile API was not denied');
  await click('[필수] 서비스 이용약관 동의'); await click('[필수] 개인정보 수집 · 이용 동의'); await click('동의하고 계속하기');
  await waitFor("window.__s1E2E.access().state==='accepted' && Boolean(document.querySelector('[role=tab]'))",'reconsent accepted');
  check((await rpc(friend,'get_my_consent_status')).health.status==='withdrawn','Required-only reconsent changed health'); mark('required-gate-reconsent',{pendingProfileCode:denied.error.code,document:true,logout:true,withdrawal:true,optionalPreserved:true});
  const unrelated=actors[3]; const u=await unrelated.client.auth.signUp({email:unrelated.email,password:unrelated.password,options:{data:{name:unrelated.name}}}); check(!u.error&&u.data.user,'Unrelated signup failed'); unrelated.id=u.data.user.id;
  const manifest=await rpc(unrelated,'get_consent_manifest');
  await rpc(unrelated,'record_required_consents',{p_request_id:randomUUID(),p_bundle_version:manifest.bundle_version,p_documents:Object.fromEntries(['service','privacy'].map(k=>[k,{version:manifest.documents[k].version,content_hash:manifest.documents[k].content_hash}])),p_choices:{service:true,privacy:true}});
  const owner=actors[0], mate=actors[1];
  await evaluate('window.__s1E2E.signOut()'); await signInBrowser(owner); await waitFor("window.__s1E2E.access().state==='accepted' && Boolean(document.querySelector('[role=tab]'))",'owner restored');
  phase('visibility');
  const privateWrite=await owner.client.from('profile_private').update({bank_name:'카카오뱅크',account_number:'3333012345678',birth_date:'1995-02-03',personal_data:{gender:'female',bio:'로컬 S1 공개 범위 검증'},start_location_name:'로컬 테스트 출발지',start_latitude:37.5,start_longitude:127.0}).eq('id',owner.id); check(!privateWrite.error,'Local profile fixture update failed');
  const room=await evaluate(`window.__s1E2E.rooms.createRoom({ownerId:${JSON.stringify(owner.id)},title:'S1 로컬 식사',meetingDate:'2099-01-01',expiresAt:'2099-01-02T00:00:00Z'})`); check(!room.error&&room.roomId&&room.code,'Room creation failed');
  await rpc(mate,'join_room_by_code',{room_code:room.code}); await rpc(owner,'advance_room_stage',{target_room:room.roomId,next_stage:'confirmed'});
  const follow=await friend.client.from('follows').insert({follower_id:friend.id,following_id:owner.id,role:'mate'}); check(!follow.error,'Friend fixture failed');
  await click('프로필'); await click('정보 공개 범위'); await waitFor("document.querySelector('[role=switch][aria-label=생년월일]')?.getAttribute('aria-disabled')!=='true'",'visibility load');
  const switches=['생년월일','성별','한마디 멘트','프로필 계좌번호','출발지 계산 사용'];
  for(const label of switches){await click(label);await waitFor(`document.querySelector('[role=switch][aria-label='+JSON.stringify(${JSON.stringify(label)})+']')?.getAttribute('aria-checked')==='true'`,'switch ON '+label);}
  const projection=await rpc(mate,'get_visible_profile',{p_profile_id:owner.id,p_room_id:room.roomId}); check(projection.relationship==='room_mate'&&['birthdate','gender','bio','bank_account'].every(k=>k in projection.fields),'Mate ON projection mismatch'); check(!('origin' in projection.fields)&&!('health' in projection.fields),'Sensitive projection leak');
  for(const actor of [friend,unrelated]){const identity=await rpc(actor,'get_visible_profile',{p_profile_id:owner.id,p_room_id:null});check(identity.relationship==='identity_only'&&Object.keys(identity.fields).length===0,'Non-mate projection leak');const denied=await actor.client.rpc('get_visible_profile',{p_profile_id:owner.id,p_room_id:room.roomId});check(denied.error?.code==='P0002','Room parameter bypass');}
  await capture('privacy-on');
  for(const label of switches){await click(label);await waitFor(`document.querySelector('[role=switch][aria-label='+JSON.stringify(${JSON.stringify(label)})+']')?.getAttribute('aria-checked')==='false'`,'switch OFF '+label);}
  const off=await rpc(mate,'get_visible_profile',{p_profile_id:owner.id,p_room_id:room.roomId}); check(Object.keys(off.fields).length===0,'Mate OFF projection mismatch'); await capture('privacy-off'); mark('visibility',{actors:4,mateOnFields:Object.keys(projection.fields),mateOffFields:Object.keys(off.fields),friendOnly:'identity_only',unrelated:'identity_only'});
  phase('settlement'); await click('홈'); await delay(400); await click('S1 로컬 식사',true); await click('메뉴 펼치기'); await click('N빵 정산'); await waitFor(has('정산 요청 보내기'),'new settlement'); await input('총 결제금액','52000'); await capture('settlement-request-disclosure'); await click('정산 요청 보내기'); await delay(600);
  const bills=await owner.client.from('dutch_pay_bills').select('id, dutch_pay_members(id,profile_id,is_completed)').eq('room_id',room.roomId); check(!bills.error&&bills.data.length===1,'Settlement creation failed'); const bill=bills.data[0];
  const payment=await rpc(mate,'get_settlement_payment_details',{p_bill_id:bill.id}); check(payment.status==='open'&&payment.payment_details?.account_number==='3333012345678','Open bill payment mismatch');
  for(const actor of [friend,unrelated]){const denied=await actor.client.rpc('get_settlement_payment_details',{p_bill_id:bill.id});check(denied.error?.code==='P0002','Non-recipient bill account access');}
  const ownMember=bill.dutch_pay_members.find(m=>m.profile_id===owner.id),mateMember=bill.dutch_pay_members.find(m=>m.profile_id===mate.id);check(ownMember&&mateMember,'Bill fixed recipients missing');
  if(!ownMember.is_completed)await rpc(owner,'set_settlement_completed',{target_member:ownMember.id,completed:true});
  await evaluate('window.__s1E2E.signOut()');await signInBrowser(owner);await waitFor("window.__s1E2E.access().state==='accepted' && Boolean(document.querySelector('[role=tab]'))",'settlement owner restored');
  await click('미완료 정산 1건 보기');await waitFor(has('3333012345678'),'open payment screen');await capture('settlement-open');
  await click('계좌 복사');await waitFor(has('계좌를 복사했어요'),'actual account copy');
  check(await evaluate("navigator.clipboard.readText().then(value=>value==='카카오뱅크 3333012345678')"),'Clipboard did not receive the current RPC account');
  await evaluate('window.__s1E2E.signOut()');await signInBrowser(mate);
  await waitFor("window.__s1E2E.access().state==='accepted' && document.body.innerText.includes('미완료 정산 1건')",'recipient home');
  await click('미완료 정산 1건 보기');await waitFor(has('3333012345678'),'recipient payment screen');
  check(await evaluate("[...document.querySelectorAll('[role=button]')].some(node=>node.getAttribute('aria-label')==='토스로 보내기')"),'Recipient transfer action missing');
  await capture('settlement-recipient-open');
  // The creator completes the recipient share from a separate authenticated client/device.
  await rpc(owner,'set_settlement_completed',{target_member:mateMember.id,completed:true});
  const closedAt = Date.now();
  // No browser mutation/copy/refresh/focus after the other client's completion.
  await waitFor(has('정산 계좌 공개가 끝났어요'),'server-only closure polling',10000);
  const closureObservedMs = Date.now() - closedAt;
  const completed=await rpc(owner,'get_settlement_payment_details',{p_bill_id:bill.id});check(completed.status==='completed'&&completed.payment_details===null,'Completed account not hidden');
  const undo=await owner.client.rpc('set_settlement_completed',{target_member:ownMember.id,completed:false});check(undo.error?.code==='S1005','Closed undo error differs');
  await waitFor(has('정산 계좌 공개가 끝났어요'),'closed account UI');
  check(await evaluate("!document.body.innerText.includes('3333012345678') && ![...document.querySelectorAll('[role=button]')].some(node=>['계좌 복사','토스로 보내기'].includes(node.getAttribute('aria-label')))"),'Closed account/action remains in the screen');
  await capture('settlement-completed');
  await click('뒤로');await click('S1 로컬 식사',true);await click('메뉴 펼치기');await click('N빵 정산');
  await waitFor(has('정산이 끝났어요. 되돌릴 수 없어요.'),'completed chat settlement');
  check(await evaluate("!document.body.innerText.includes('받을 계좌:') && !document.body.innerText.includes('정산 내용 수정')"),'Completed chat still has account/edit content');
  await capture('settlement-chat-completed');
  await evaluate('window.__s1E2E.signOut()');await signInBrowser(mate);await waitFor("window.__s1E2E.access().state==='accepted' && Boolean(document.querySelector('[role=tab]'))",'mate restored');
  const list=await evaluate('window.__s1E2E.settlements.fetchMySettlementsDetailed()');check(!list.error&&list.data.length===1,'Completed list failed');check(!('accountNumber' in list.data[0]),'List contains an account snapshot');
  mark('settlement',{profileAccountPrivate:true,recipientOpen:true,nonRecipientCode:'P0002',completedPayment:completed.status,completedDetailsNull:true,undoCode:undo.error.code,serverOnlyClosure:true,closureObservedMs,clipboard:true,completedListAndChat:true});
  phase('optional-consents');
  const health=await rpc(mate,'get_my_health_preferences');await rpc(mate,'save_my_health_preferences',{p_allergies:[],p_dietary_restrictions:[],p_expected_revision:health.revision,p_consent_revision:health.consent_revision});
  check(sql(`select count(*) from public.profile_health_preferences where profile_id='${mate.id}';`)==='1','Health row not stored');
  await click('프로필');await click('설정',true);await click('선택 동의',true);await waitFor(has('건강정보 동의 철회'),'optional controls');await capture('optional-before-withdraw');await click('건강정보 동의 철회');await waitFor(has('동의를 철회하고 건강정보를 삭제했어요'),'withdraw success');
  check(sql(`select count(*) from public.profile_health_preferences where profile_id='${mate.id}';`)==='0','Health row survived withdrawal');const deniedHealth=await mate.client.rpc('get_my_health_preferences');check(deniedHealth.error?.code==='S1003','Withdrawn health read allowed');
  await click('마케팅 정보 수신 동의 철회');await delay(300);check((await rpc(mate,'get_my_consent_status')).marketing.status==='withdrawn','Marketing withdrawal failed');await click('마케팅 정보 수신 동의하기');await delay(300);const changed=await rpc(mate,'get_my_consent_status');check(changed.marketing.status==='granted'&&changed.marketing.sending_enabled===false,'Marketing regrant failed');await capture('optional-after-withdraw');
  mark('optional-consents',{healthRowsBefore:1,healthRowsAfter:0,healthReadCode:deniedHealth.error.code,healthPayload:'empty arrays; local catalog not populated',marketing:changed.marketing.status,advertisingEnabled:changed.marketing.sending_enabled});
  phase('sql-history');
  const aliases=actors.map(a=>`when '${a.id}' then '${a.alias}'`).join(' '),ids=actors.map(a=>`'${a.id}'`).join(',');
  const history=JSON.parse(sql(`select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select case profile_id::text ${aliases} end actor,kind,action,agreed,source,version from public.profile_consents where profile_id in (${ids}) order by profile_id,agreed_at,id) x;`));
  const ownerOptional=history.filter(e=>e.actor==='owner'&&['health','marketing'].includes(e.kind)),mateSignup=history.filter(e=>e.actor==='mate'&&e.source==='signup'&&['health','marketing'].includes(e.kind));
  check(ownerOptional.length===2&&ownerOptional.every(e=>!e.agreed&&e.action==='decline'),'Required-only signup granted optional consent');check(mateSignup.length===2&&mateSignup.every(e=>e.agreed),'Optional signup choices not stored');
  fs.writeFileSync(path.join(output,'consent-history.json'),JSON.stringify(history,null,2));mark('sql-history',{events:history.length,onlyExplicitChoices:true,bundleVersion:manifest.bundle_version});
  phase('persistent-s1-no-downgrade');
  await evaluate('window.__s1E2E.signOut()');await signInBrowser(friend);
  await waitFor("window.__s1E2E.access().state==='accepted'",'other account accepted on same device');
  const absent = await friend.client.rpc('get_consent_manifest_missing_e2e');
  check(absent.error?.code==='PGRST202' && absent.status===404,'Local missing-function response differs');
  const legacyBefore = routedRequests.legacyConsent, selectBefore = routedRequests.accountSelect;
  missingManifest = true;await call('Page.reload');
  await waitFor("Boolean(window.__s1E2E) && window.__s1E2E.access().state==='error'",'persistent S1 closed gate after cold page reload');
  check(await evaluate("window.__s1E2E.consents.getConsentServerMode()==='s1' && !document.querySelector('[role=tab]')"),'Known S1 device downgraded/opened');
  check(routedRequests.missingManifest>0&&routedRequests.legacyConsent===legacyBefore&&routedRequests.accountSelect===selectBefore,'Legacy fallback request leaked');
  await capture('s1-missing-manifest-gate');
  missingManifest=false;await click('동의 상태 다시 확인');
  await waitFor("window.__s1E2E.access().state==='accepted' && Boolean(document.querySelector('[role=tab]'))",'manifest recovered');
  mark('persistent-s1-no-downgrade',{accountChanged:true,coldReload:true,actualMissingCode:absent.error.code,actualMissingStatus:absent.status,legacyRpcCalls:0,directAccountSelects:0,recovered:true});
  evidence.phase='complete';save();process.stdout.write('Real local S1 E2E passed.\n');
}
main().catch(async error=>{evidence.cases.push({id:evidence.phase,outcome:'FAIL',reason:error.message});save();process.stderr.write('FAIL '+evidence.phase+': '+error.message+'\n');try{await capture('failure');}catch{}process.exitCode=1;}).finally(async()=>{
  for(const client of clients){try{await client.auth.dispose();}catch{}}
  if(browser){const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill();await Promise.race([exited,delay(1500)]);}
  server.close();
  // The disposable Chrome profile can contain local sessions; remove only this verified temp directory.
  if(browserProfile&&path.dirname(path.resolve(browserProfile))===path.resolve(os.tmpdir())&&path.basename(browserProfile).startsWith('mealchat-s1-real-e2e-')){
    for(let attempt=0;attempt<10;attempt++){try{fs.rmSync(browserProfile,{recursive:true,force:true});break;}catch{await delay(200);}}
    evidence.browserProfileRemoved=!fs.existsSync(browserProfile);save();
  }
});
