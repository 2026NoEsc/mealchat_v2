/* Real local S4 app/RPC verification. Tokens/passwords exist only in disposable process/browser memory. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { Buffer } = require('node:buffer');
const { createClient } = require('@supabase/supabase-js');
const followup = process.argv.includes('--followup');
const review = process.argv.includes('--contract-review');
const output = path.resolve(review ? 'tmp/s4-e2e/contract-review' : followup ? 'tmp/s4-e2e/followup' : 'tmp/s4-e2e'); fs.mkdirSync(output, { recursive: true });
const raw = execFileSync('powershell.exe', ['-NoProfile', '-Command', 'npx --no-install supabase status -o json'], { encoding: 'utf8', windowsHide: true });
const local = JSON.parse(raw.slice(raw.indexOf('{'))), apiUrl = 'http://127.0.0.1:54321';
if (local.API_URL !== apiUrl || !local.ANON_KEY) throw Error('Local public configuration unavailable');
const identity = execFileSync('docker', ['inspect', '--format', '{{.Name}} {{json .NetworkSettings.Ports}}', 'supabase_db_mealchat_v2'], { encoding: 'utf8', windowsHide: true });
const dbPorts = JSON.parse(identity.slice(identity.indexOf(' ') + 1));
if (!identity.startsWith('/supabase_db_mealchat_v2 ') || dbPorts['5432/tcp']?.[0]?.HostPort !== '54322') throw Error('Project-local DB identity mismatch');
const actors = (followup ? ['owner', 'mate'] : ['owner', 'mate', 'third', 'pending']).map((alias, index) => ({ alias, name: ['S4 방장', 'S4 메이트', 'S4 세번째', 'S4 초대대기'][index],
  email: `s4-${alias}-${randomUUID()}@example.test`, password: 'Local!' + randomBytes(16).toString('hex'), id: null,
  client: createClient(apiUrl, local.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) }));
const [owner, mate, third, pendingActor] = actors;
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 86400000));
const time = (start, end) => ({ starts_at: new Date(`${day}T${String(start).padStart(2, '0')}:00:00+09:00`).toISOString(), ends_at: new Date(`${day}T${String(end).padStart(2, '0')}:00:00+09:00`).toISOString(), time_zone: 'Asia/Seoul' });
const slots = hours => hours.map(hour => `${day}-${hour}`);
const evidence = { environment: { api: apiUrl, db: 'supabase_db_mealchat_v2', port: 54322, testDateKst: day, providerKeys: false }, cases: [], screenshots: [], rpcResponses: [], errors: [], blockedOrigins: [], phase: 'boot' };
const save = () => fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2));
const check = (condition, message) => { if (!condition) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const phase = name => { evidence.phase = name; save(); console.log('RUN ' + name); };
const mark = (id, details = {}) => { evidence.cases.push({ id, outcome: 'PASS', ...details }); save(); console.log('PASS ' + id); };
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_mealchat_v2', 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: query, encoding: 'utf8', windowsHide: true }).trim();
const rpc = async (actor, name, args = {}) => { const result = await actor.client.rpc(name, args); check(!result.error, name + ': ' + (result.error?.code ?? 'unknown')); return result.data; };
const state = actor => rpc(actor, 'get_room_s4_state', { p_room_id: room.id });
const submit = async (actor, hours) => rpc(actor, 'submit_room_availability_v1', { p_room_id: room.id, p_slot_keys: slots(hours), p_expected_revision: (await state(actor)).revision, p_request_id: randomUUID() });
let browser, browserProfile, call, sessionId, room;
let blockedProviderAttempts = 0;
let roomPollFailureBudget = 0, roomPollFailures = 0, browserRoomReads = 0, browserInvitationReads = 0;
const networkPaths = new Map();
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style><div id="root"></div><script src="http://127.0.0.1:8146/scripts/ui-preview/s4E2e.preview.bundle?platform=web&dev=true&hot=false&minify=false"></script></html>');
  http.get('http://127.0.0.1:8146' + request.url, asset => { response.writeHead(asset.statusCode, asset.headers); asset.pipe(response); }).on('error', () => { response.writeHead(502); response.end(); });
});
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error('Browser evaluation failed at ' + evidence.phase);
  return result.result.value;
}
async function waitFor(expression, label, timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(expression)) return; await delay(150); }
  throw Error('Timed out: ' + label);
}
const has = text => `document.body.innerText.includes(${JSON.stringify(text)})`;
const control = label => `[...document.querySelectorAll('[role="button"],[role="checkbox"],[role="tab"]')].find(e=>e.getClientRects().length&&e.getAttribute('aria-label')===${JSON.stringify(label)})`;
async function click(label, prefix = false) {
  const done = await evaluate(`(()=>{const label=${JSON.stringify(label)},prefix=${prefix},nodes=[...document.querySelectorAll('[role="button"],[role="checkbox"],[role="tab"]')];const e=nodes.find(e=>e.getClientRects().length&&e.getAttribute('aria-label')===label)||nodes.find(e=>e.getClientRects().length&&(prefix?(e.getAttribute('aria-label')||e.innerText).startsWith(label):e.innerText.trim()===label));if(!e||e.getAttribute('aria-disabled')==='true'||e.disabled)return false;e.click();return true;})()`);
  check(done, 'Control unavailable: ' + label); await delay(160);
}
async function input(label, value) {
  check(await evaluate(`(()=>{const e=document.querySelector('input[aria-label='+JSON.stringify(${JSON.stringify(label)})+']');if(!e)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`), 'Input unavailable: ' + label); await delay(100);
}
async function cell(hour) { const [, month, date] = day.split('-').map(Number); await click(`${month}월 ${date}일 ${hour}시 ~ ${hour + 1}시`, true); }
async function capture(name) {
  const selector = name.includes('attendance') ? '[data-testid=s4-time-attendance]' : /conflict|s4002/.test(name) ? '[role=alert]' : null;
  if (selector) await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`);
  await evaluate('document.activeElement?.blur()'); await delay(160);
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(shot.data, 'base64')); evidence.screenshots.push(name + '.png'); save();
}
async function login(actor) {
  await evaluate('window.__s4E2E.signOut()');
  await waitFor(has('가입하기'), 'logged out');
  const result = await evaluate(`window.__s4E2E.signIn(${JSON.stringify(actor.email)},${JSON.stringify(actor.password)})`);
  check(!result.code && result.id === actor.id, 'Local browser login failed');
  await waitFor("window.__s4E2E.access().state==='accepted' && Boolean(document.querySelector('[role=tab]'))", 'accepted home');
}
async function openRoom() { await waitFor(has(room.title), 'room list'); await click(room.title, true); await waitFor(`Boolean(${control('메뉴 펼치기')})`, 'chat room'); }
async function openSheet(label) { if (await evaluate(`Boolean(${control('메뉴 펼치기')})`)) await click('메뉴 펼치기'); await click(label); await delay(250); }
async function closeSheet() {
  await waitFor(`Boolean(${control('식당 시트 닫기')}||${control('닫기')})`, 'sheet close control');
  await click(await evaluate(`Boolean(${control('식당 시트 닫기')})`) ? '식당 시트 닫기' : '닫기');
}
async function appCall(module, method, args) { return evaluate(`window.__s4E2E.${module}.${method}(...${JSON.stringify(args)})`); }
async function holdRoomLock() {
  const child = spawn('docker', ['exec', '-i', 'supabase_db_mealchat_v2', 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  let released = false;
  const exited = new Promise(resolve => child.once('exit', resolve));
  const ready = new Promise((resolve, reject) => { child.stdout.on('data', data => { if (data.toString().includes('S4_BARRIER_READY')) resolve(); }); child.once('exit', () => reject(Error('Local barrier exited before release'))); child.once('error', () => reject(Error('Local barrier failed'))); });
  child.stdin.write(`begin; select pg_advisory_xact_lock(hashtextextended('${room.id}',0)); select 'S4_BARRIER_READY';\n`);
  await ready;
  return async () => { if (!released) { released = true; child.stdin.end('commit;\n'); } await exited; };
}
const blockedWriters = () => Number(sql("select count(*) from pg_stat_activity where wait_event_type='Lock' and wait_event='advisory' and query like '%select_room_meeting_time_v1%';"));
async function connect() {
  browserProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-s4-real-e2e-'));
  browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--remote-debugging-pipe', '--user-data-dir=' + browserProfile, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let sequence = 0, buffer = ''; const commands = new Map();
  browser.stdio[4].on('data', chunk => {
    buffer += chunk.toString(); let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const raw = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (!raw) continue;
      const result = JSON.parse(raw);
      if (result.method === 'Runtime.exceptionThrown') evidence.errors.push({ phase: evidence.phase, text: result.params.exceptionDetails.text });
      if (result.method === 'Fetch.requestPaused') {
        const request = result.params, url = new URL(request.request.url), allowed = ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol);
        if (!allowed) evidence.blockedOrigins.push(url.origin);
        if (review && url.pathname.startsWith('/functions/')) {
          blockedProviderAttempts++; void call('Fetch.failRequest', { requestId: request.requestId, errorReason: 'BlockedByClient' }); continue;
        }
        if (roomPollFailureBudget > 0 && request.request.method === 'GET' && url.pathname === '/rest/v1/rooms' && url.searchParams.get('id') === 'eq.' + room?.id && url.searchParams.get('select')?.includes('owner_id')) {
          roomPollFailureBudget--; roomPollFailures++; evidence.injectedRoomFailures ??= []; evidence.injectedRoomFailures.push({method:request.request.method,status:500,sdkRetryCount:request.request.headers['X-Retry-Count']??null}); save();
          void call('Fetch.fulfillRequest', { requestId: request.requestId, responseCode: 500,
            responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
            body: Buffer.from(JSON.stringify({ code: 'E2E_TRANSIENT', message: 'One-shot local verification failure' })).toString('base64') });
          continue;
        }
        void call(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed ? { requestId: request.requestId } : { requestId: request.requestId, errorReason: 'BlockedByClient' });
      }
      if (result.method === 'Network.responseReceived') {
        const { requestId, response } = result.params, url = new URL(response.url);
        if (url.pathname === '/rest/v1/rooms') browserRoomReads++;
        if (url.pathname === '/rest/v1/room_invitations') browserInvitationReads++;
        if (url.pathname.includes('/rest/v1/rpc/') || url.pathname.endsWith('/functions/v1/schedule-recommend')) networkPaths.set(requestId, { path: url.pathname, status: response.status });
      }
      if (result.method === 'Network.loadingFinished' && networkPaths.has(result.params.requestId)) {
        const requestId = result.params.requestId, entry = networkPaths.get(requestId); networkPaths.delete(requestId);
        void call('Network.getResponseBody', { requestId }).then(body => {
          let data; try { data = JSON.parse(body.body); } catch { /* Void/empty success. */ }
          const code = typeof data?.code === 'string' && /^(S\d{4}|[A-Z0-9]{5})$/.test(data.code) ? data.code : undefined;
          const hint = ['operation=settlement', 'operation=vote_confirmation', 'operation=membership'].includes(data?.hint) ? data.hint : undefined;
          evidence.rpcResponses.push({ phase: evidence.phase, ...entry, ...(code ? { code } : {}), ...(hint ? { hint } : {}) }); save();
        }).catch(() => {});
      }
      if (!result.id) continue; const task = commands.get(result.id); commands.delete(result.id); if (!task) continue;
      if (result.error) task.reject(Error('CDP command failed')); else task.resolve(result.result);
    }
  });
  call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; commands.set(id, { resolve, reject }); browser.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0'); });
  const { targetInfos } = await call('Target.getTargets'); sessionId = (await call('Target.attachToTarget', { targetId: targetInfos.find(target => target.type === 'page').targetId, flatten: true })).sessionId;
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable'); await call('Fetch.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
  await call('Emulation.setFocusEmulationEnabled', { enabled: true });
  await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  await waitFor("Boolean(window.__s4E2E) && document.body.innerText.includes('가입하기')", 'actual app boot', 150000);
}
async function prepareActors() {
  phase('local-accounts');
  for (const actor of actors) {
    const created = await actor.client.auth.signUp({ email: actor.email, password: actor.password, options: { data: { name: actor.name } } });
    check(!created.error && created.data.session && created.data.user?.email_confirmed_at, 'Local auto-confirm/session unavailable'); actor.id = created.data.user.id;
    const manifest = await rpc(actor, 'get_consent_manifest');
    await rpc(actor, 'record_required_consents', { p_request_id: randomUUID(), p_bundle_version: manifest.bundle_version, p_documents: Object.fromEntries(['service', 'privacy'].map(key => [key, { version: manifest.documents[key].version, content_hash: manifest.documents[key].content_hash }])), p_choices: { service: true, privacy: true } });
  }
  if (!followup) for (const target of (review ? [mate, third, pendingActor] : [mate, pendingActor])) { const result = await owner.client.from('follows').insert({ follower_id: owner.id, following_id: target.id, role: 'mate' }); check(!result.error, 'Local mate relation insert failed'); }
  mark('local-accounts', { users: actors.length, requiredConsent: 'accepted', emailConfirmation: 'local auto-confirm' });
}
async function main() {
  await prepareActors();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); await connect(); await login(owner);
  phase('create-invite-submit');
  await click('새 밥약 만들기'); await input('약속 이름', 'S4 실제 저녁'); await click('다음'); await waitFor(has('언제 만날까요?'), 'new room STEP2');
  const found = await owner.client.from('rooms').select('id,code,title').eq('owner_id', owner.id).single(); check(!found.error && found.data, 'Created room not found'); room = found.data;
  const invitation = await rpc(owner, 'create_room_invitation', { target_room: room.id, invitee_id: mate.id }); await rpc(mate, 'accept_room_invitation', { target_invitation: invitation });
  await rpc(third, 'join_room_by_code', { room_code: room.code }); await rpc(owner, 'create_room_invitation', { target_room: room.id, invitee_id: pendingActor.id });
  await waitFor("document.querySelectorAll('[role=checkbox]').length===50", 'availability grid'); await cell(11); await cell(12); await click('선택 완료');
  await waitFor(`${has('3명 중 1명 제출')}||${has('고른 시간은 유지했어요')}`, 'initial submit or membership conflict');
  if (await evaluate(has('고른 시간은 유지했어요'))) { await capture('00-membership-revision-conflict'); await click('선택 완료'); }
  await waitFor(has('3명 중 1명 제출'), 'three eligible members excluding pending invite'); await submit(mate, [11]);
  await click('제출 상태 다시 확인'); await waitFor(has('3명 중 2명 제출'), 'incomplete submissions');
  check(await evaluate(`!${control('시간 선택하기')}`), 'Time progression visible before all submissions');
  const incomplete = await owner.client.rpc('select_room_meeting_time_v1', { p_room_id: room.id, p_time: null, p_expected_revision: (await state(owner)).revision, p_request_id: randomUUID() }); check(incomplete.error?.code === 'S4004', 'Incomplete submission not rejected');
  await capture('01-incomplete-submissions'); await submit(third, [12]); await click('제출 상태 다시 확인'); await waitFor(has('3명 중 3명 제출'), 'all submitted'); await capture('02-all-submitted');
  mark('create-invite-submit', { roomId: room.id, actualMembers: 3, pendingInvites: 1, incompleteCode: incomplete.error.code });
  await click('시간 선택하기'); await click('시간 없이 식당 정하기'); await waitFor(has('식당 정하기'), 'unset place');
  phase('unset-place-resubmit');
  check((await state(owner)).stage === 'place' && !(await state(owner)).meeting_time, 'Unset place not persisted');
  await closeSheet(); await openSheet('일정 조율'); await waitFor(has('일정 수정'), 'place schedule editor'); await click('일정 수정'); await cell(13); await click('선택 완료');
  await waitFor(has('일정 수정'), 'resubmission finished'); check((await state(owner)).availability.my_slots.includes(`${day}-13`), 'Unset-place revision not saved'); await capture('03-unset-place-resubmitted');
  mark('unset-place-resubmit', { stage: 'place', meetingTime: null, revisedSlotsPersisted: true });
  await click('시간 선택하기'); await waitFor(has('시간 직접 고르기'), 'direct time selection');
  phase('edge-no-provider-key'); await click('시간 추천받기'); await waitFor(has('시간 추천을 불러오지 못했어요'), 'safe local Edge failure'); await capture('04-edge-safe-fallback');
  const edgeResponse = evidence.rpcResponses.filter(entry => entry.path.endsWith('/functions/v1/schedule-recommend')).at(-1);
  const edgeProbe = await owner.client.functions.invoke('schedule-recommend', { body: { meetingName: room.title, roomId: room.id, placeCandidates: [] } });
  let edgeReason = 'unclassified';
  try { const body = await edgeProbe.error?.context?.clone().json(); const value = String(body?.error ?? body?.message ?? '');
    if (/issuer/i.test(value)) edgeReason = 'issuer-mismatch'; else if (/JWT/i.test(value)) edgeReason = 'jwt-rejected';
    else if (/unauthoriz|authenticat/i.test(value)) edgeReason = 'auth-rejected'; else if (/key.*configured/i.test(value)) edgeReason = 'provider-key-not-configured';
  } catch { /* No raw upstream body is persisted. */ }
  const session = await owner.client.auth.getSession(), verifiedUser = await owner.client.auth.getUser();
  const issuerIsPublicApi = JSON.parse(Buffer.from(session.data.session.access_token.split('.')[1], 'base64url').toString()).iss === apiUrl + '/auth/v1';
  check(!verifiedUser.error && verifiedUser.data.user?.id === owner.id, 'Local Auth identity verification failed');
  mark('edge-safe-manual-fallback', { httpStatus: edgeResponse?.status, nodeStatus: edgeProbe.error?.context?.status, reason: edgeReason, localAuthGetUser: true, issuerIsPublicApi, successRecommendation: false, fallback: 'manual selection', providerInvocations: 'not attempted: explicit empty keys' });
  evidence.cases.push({ id: 'time-recommendation-auth', outcome: edgeProbe.error?.context?.status === 401 ? 'BLOCKED' : 'NOT_TESTED', httpStatus: edgeProbe.error?.context?.status, reason: edgeReason, providerSuccess: 'not verified' }); save();
  phase('manual-time-attendance'); await cell(20); await waitFor(has('3명 중 0명 가능'), 'zero continuous attendees');
  check(await evaluate(`${control('선택한 시간 저장')}?.getAttribute('aria-disabled')==='true'`), 'Zero attendance still selectable'); await capture('05-zero-attendance');
  await cell(20); await cell(11); await cell(12); await waitFor(has('3명 중 1명 가능'), 'continuous same-member count'); await capture('06-continuous-attendance');
  await click('선택한 시간 저장'); await waitFor(`Boolean(${control('메뉴 펼치기')})`, 'saved time chat');
  const selected = await state(owner); check(selected.meeting_time?.ends_at && Date.parse(selected.meeting_time.ends_at) === Date.parse(time(11, 13).ends_at), 'Full interval not persisted');
  const rejected = await owner.client.rpc('submit_room_availability_v1', { p_room_id: room.id, p_slot_keys: slots([11]), p_expected_revision: selected.revision, p_request_id: randomUUID() }); check(rejected.error?.code === 'S4003', 'Schedule submission after time selection not denied');
  mark('manual-time-attendance', { zeroBlocked: true, eligible: 3, continuousAvailable: 1, resubmitAfterSelection: rejected.error.code });
  await closeSheet();
  phase('member-place-permissions'); await login(mate); await openRoom(); await openSheet('식당 정하기'); await waitFor(has('직접 추가'), 'member place sheet');
  check(await evaluate(`!${control('시간 수정하기')}&&!${control('시간 선택하기')}&&!document.querySelector('[data-testid=voting-confirm-cta]')`), 'Member owner-only action visible in place'); await capture('13a-member-place-no-owner-actions');
  const memberPlaceTime = await mate.client.rpc('select_room_meeting_time_v1', { p_room_id: room.id, p_time: time(11, 12), p_expected_revision: (await state(mate)).revision, p_request_id: randomUUID() });
  const memberPlaceConfirm = await mate.client.rpc('confirm_room_appointment_v1', { p_room_id: room.id, p_restaurant_item_id: randomUUID(), p_expected_revision: (await state(mate)).revision, p_request_id: randomUUID() });
  check(memberPlaceTime.error?.code === '42501' && memberPlaceConfirm.error?.code === '42501', 'Place member authorization differs');
  mark('member-place-permissions', { stage: 'place', ownerActionsAbsent: true, timeCode: memberPlaceTime.error.code, confirmCode: memberPlaceConfirm.error.code });
  await login(owner); await openRoom(); await openSheet('일정 조율'); check(await evaluate(`!${control('일정 수정')}`), 'Submission editor remains after time selection'); await click('시간 수정하기');
  phase('concurrent-choice-conflict'); await cell(11); await waitFor(has('3명 중 2명 가능'), 'new preview');
  const before = await state(owner), release = await holdRoomLock(); let parallel, observedWriters = 0;
  try {
    parallel = rpc(owner, 'select_room_meeting_time_v1', { p_room_id: room.id, p_time: time(12, 13), p_expected_revision: before.revision, p_request_id: randomUUID() });
    for (let turn = 0; turn < 30 && blockedWriters() < 1; turn++) await delay(100);
    check(blockedWriters() >= 1, 'Independent HTTP writer did not reach the real DB lock');
    await click('선택한 시간 저장');
    for (let turn = 0; turn < 30 && blockedWriters() < 2; turn++) await delay(100);
    observedWriters = blockedWriters(); check(observedWriters >= 2, 'Two writers did not overlap at the actual DB lock');
  } finally { await release(); }
  await parallel;
  await waitFor(has('다시 불러온 뒤 선택해 주세요'), 'real stale-revision error'); await capture('07-real-s4005-conflict');
  check(await evaluate(`${control('선택한 시간 저장')}?.getAttribute('aria-disabled')==='true'`), 'Stale preview is still submittable');
  await cell(11); await waitFor(has('3명 중 2명 가능'), 'fresh conflict recovery preview'); await click('선택한 시간 저장'); await waitFor(`Boolean(${control('메뉴 펼치기')})`, 'recovered chat');
  mark('concurrent-choice-conflict', { sessions: 2, simultaneousDbLockWaiters: observedWriters, errorCode: 'S4005', automaticResubmit: false, recoveredWithFreshChoice: true });
  phase('pre-confirm-settlement'); await closeSheet(); if (await evaluate(`Boolean(${control('메뉴 펼치기')})`)) await click('메뉴 펼치기');
  check(await evaluate(`${control('N빵 정산')}?.getAttribute('aria-disabled')==='true'`), 'Pre-confirmation settlement action not disabled'); await capture('08-pre-confirmation-settlement');
  const settlementArgs = { target_room: room.id, bill_title: '실제 로컬 정산', amount: 30000, bank_name: '로컬 테스트 은행', account_number: '000000000000', account_holder: '로컬 테스트' };
  const blocked = await owner.client.rpc('create_room_settlement_v2', settlementArgs); check(blocked.error?.code === 'S4008' && blocked.error.hint === 'operation=settlement', 'Settlement error contract differs');
  const safeSettlementMessage = await evaluate(`window.__s4E2E.settlementUiError(${JSON.stringify({ code: blocked.error.code, hint: blocked.error.hint })})`); check(safeSettlementMessage.includes('약속을 확정한 뒤 정산'), 'Settlement hint mapping differs'); mark('pre-confirm-settlement', { code: blocked.error.code, hint: blocked.error.hint, message: safeSettlementMessage });
  phase('candidate-validation-voting'); await click('식당 정하기'); await waitFor(has('직접 추가'), 'voting sheet'); await click('직접 추가');
  await input('식당 검색', '로컬\u200b식당'); await waitFor(has('이 이름으로 후보 추가'), 'provider-free direct candidate'); await click('이 이름으로 후보 추가'); await waitFor(has('보이지 않는 서식 문자나 제어문자를 빼고'), 'S4002 safe UI'); await capture('09-format-name-s4002');
  const blank = await owner.client.rpc('add_voting_item', { target_room: room.id, item_kind: 'menu', item_label: '   ' }); check(blank.error?.code === 'S4002', 'Blank candidate not rejected');
  await input('식당 검색', '로컬 식당'); await waitFor(has('이 이름으로 후보 추가'), 'valid direct candidate'); await click('이 이름으로 후보 추가'); await waitFor(has('후보에 추가했어요'), 'candidate saved'); await click('식당 직접 추가 닫기');
  await click('로컬 식당 투표'); await delay(400); await capture('10-insufficient-votes');
  const options = await owner.client.from('rooms').select('voting_items').eq('id', room.id).single(); const item = options.data?.voting_items?.find(value => value.label === '로컬 식당'); check(item, 'Candidate not persisted');
  const voteDenied = await owner.client.rpc('confirm_room_appointment_v1', { p_room_id: room.id, p_restaurant_item_id: item.id, p_expected_revision: (await state(owner)).revision, p_request_id: randomUUID() });
  check(voteDenied.error?.code === 'S4008' && voteDenied.error.hint === 'operation=vote_confirmation', 'Vote error contract differs');
  const safeVoteMessage = await appCall('decisions', 'roomDecisionErrorMessage', [{ code: voteDenied.error.code, hint: voteDenied.error.hint }]); check(safeVoteMessage.includes('최다 득표'), 'Vote hint mapping differs');
  check(await evaluate(`${control('로컬 식당으로 정하기')}?.getAttribute('aria-disabled')==='true'`), 'Minority candidate confirmation enabled');
  await rpc(mate, 'toggle_vote', { target_room: room.id, item_id: item.id }); await closeSheet(); await openSheet('식당 정하기');
  await waitFor(`${control('로컬 식당으로 정하기')}?.getAttribute('aria-disabled')!=='true'`, 'majority confirmation'); await click('로컬 식당으로 정하기'); await capture('11-confirmation-plan'); await click('확정하기');
  await waitFor(has('약속을 확정했어요'), 'actual confirmation system message'); await capture('12-confirmed');
  const confirmed = await state(owner); check(confirmed.stage === 'confirmed' && confirmed.confirmation_status === 'owner_confirmed', 'Atomic confirmation not persisted');
  const messages = Number(sql(`select count(*) from public.messages where room_id='${room.id}' and event_key='appointment-confirmed:${room.id}';`)); check(messages === 1, 'Confirmation message count differs');
  mark('candidate-validation-voting', { formatCode: 'S4002', blankCode: blank.error.code, voteCode: voteDenied.error.code, voteHint: voteDenied.error.hint, finalStage: confirmed.stage, eventCount: messages });
  phase('member-permissions'); await login(mate); await openRoom(); await click('메뉴 펼치기');
  check(await evaluate(`!${control('시간 수정하기')}&&!${control('시간 선택하기')}&&!${control('약속 확정')}`), 'Member owner-only action visible'); await capture('13-member-no-time-controls'); await click('메뉴 접기');
  const memberTime = await mate.client.rpc('select_room_meeting_time_v1', { p_room_id: room.id, p_time: time(11, 12), p_expected_revision: (await state(mate)).revision, p_request_id: randomUUID() });
  const memberConfirm = await mate.client.rpc('confirm_room_appointment_v1', { p_room_id: room.id, p_restaurant_item_id: item.id, p_expected_revision: (await state(mate)).revision, p_request_id: randomUUID() });
  check(memberTime.error?.code === '42501' && memberConfirm.error?.code === '42501', 'Member mutation authorization differs'); mark('member-permissions', { timeCode: memberTime.error.code, confirmCode: memberConfirm.error.code });
  phase('timezones');
  const labels = [];
  for (const zone of ['UTC', 'America/Los_Angeles']) {
    await call('Emulation.setTimezoneOverride', { timezoneId: zone }); await call('Emulation.setLocaleOverride', { locale: zone === 'UTC' ? 'ko-KR' : 'en-US' });
    await call('Page.reload'); await waitFor("Boolean(window.__s4E2E)&&window.__s4E2E.access().state==='accepted'&&Boolean(document.querySelector('[role=tab]'))", 'timezone cold page'); await openRoom();
    await waitFor(has('11:00–12:00 · 한국 시간'), 'structured time card');
    labels.push(await evaluate("document.body.innerText.match(/20\\d\\d년 \\d+월 \\d+일 \\([^)]+\\) 11:00–12:00 · 한국 시간/)?.[0]")); await capture('14-time-' + zone.replaceAll('/', '-'));
  }
  check(labels[0] === labels[1] && labels[0].includes('11:00–12:00'), 'Device TZ changed the appointment'); mark('timezones', { zones: ['UTC', 'America/Los_Angeles'], labels });
  phase('confirmed-settlement-and-repeat'); await login(owner); await openRoom();
  const account = await owner.client.from('profile_private').update({ bank_name: '로컬 테스트 은행', account_number: '000000000000' }).eq('id', owner.id); check(!account.error, 'Local payment fixture failed');
  await openSheet('N빵 정산'); await waitFor(has('정산 요청 보내기'), 'confirmed settlement form'); await input('총 결제금액', '30000'); await capture('15-confirmed-settlement-request'); await click('정산 요청 보내기');
  await waitFor(`Boolean(${control('메뉴 펼치기')})&&!${control('닫기')}`, 'request closed its sheet'); await openSheet('N빵 정산');
  await waitFor(has('정산 내용 수정'), 'actual created settlement'); const bills = await owner.client.from('dutch_pay_bills').select('id,dutch_pay_members(id,profile_id,is_completed)').eq('room_id', room.id); check(!bills.error && bills.data.length === 1, 'Bill not created');
  const bill = bills.data[0]; await capture('16-settling');
  for (const member of bill.dutch_pay_members) if (!member.is_completed) await rpc(owner, 'set_settlement_completed', { target_member: member.id, completed: true });
  await waitFor(has('새 정산 요청하기'), 'closed bill with repeat action'); const done = await state(owner); check(done.stage === 'done' && done.confirmation_status === 'owner_confirmed', 'Done confirmation evidence missing'); await capture('17-done');
  await click('새 정산 요청하기'); await input('총 결제금액', '45000'); await click('정산 요청 보내기');
  await waitFor(`Boolean(${control('메뉴 펼치기')})&&!${control('닫기')}`, 'repeat request closed its sheet'); await openSheet('N빵 정산'); await waitFor(has('정산 내용 수정'), 'repeat settlement');
  const repeat = await owner.client.from('dutch_pay_bills').select('id').eq('room_id', room.id); check(!repeat.error && repeat.data.length === 2, 'Fresh bill not created from confirmed done room');
  const repeatedState = await state(owner); await capture('18-repeat-settlement');
  mark('confirmed-settlement-and-repeat', { initialAmount: 30000, closedStage: done.stage, freshBills: 2, repeatAmount: 45000, finalStage: repeatedState.stage });
  evidence.database = JSON.parse(sql(`select json_build_object('stage',r.stage,'ownerConfirmed',r.appointment_confirmed_at is not null,'startsAt',r.meeting_starts_at,'endsAt',r.meeting_ends_at,'expiresAt',r.expires_at,'actualMembers',(select count(*) from public.participants p where p.room_id=r.id and p.profile_id is not null),'billCount',(select count(*) from public.dutch_pay_bills b where b.room_id=r.id),'openBillCount',(select count(*) from public.dutch_pay_bills b where b.room_id=r.id and exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id and not m.is_completed)),'confirmationEvents',(select count(*) from public.messages m where m.room_id=r.id and m.event_key='appointment-confirmed:'||r.id::text)) from public.rooms r where r.id='${room.id}';`));
  if (repeatedState.stage !== 'settling') evidence.cases.push({ id: 'repeat-room-stage', outcome: 'NEEDS_CONTRACT_CONFIRMATION', actualStage: repeatedState.stage, openBills: evidence.database.openBillCount, issue: 'Fresh bill is open while the room remains done and its completion expiry countdown remains visible.' });
  check(evidence.blockedOrigins.length === 0, 'Unexpected external browser origin'); check(evidence.errors.length === 0, 'Browser runtime error');
  evidence.phase = 'complete'; save(); console.log('Real local S4 RPC/UI paths passed; inspect the separately blocked recommendation-auth case');
}
async function coldHome() {
  await call('Page.reload');
  await waitFor("Boolean(window.__s4E2E)&&window.__s4E2E.access().state==='accepted'&&Boolean(document.querySelector('[role=tab]'))", 'accepted cold home');
}
async function readLifecycle() {
  const result = await owner.client.from('rooms').select('stage,expires_at,settled_at').eq('id', room.id).single();
  check(!result.error && result.data, 'Lifecycle HTTP read failed');
  return result.data;
}
async function completeBill(billId) {
  const result = await owner.client.from('dutch_pay_bills').select('id,dutch_pay_members(id,is_completed)').eq('id', billId).single();
  check(!result.error && result.data, 'Bill recipient read failed');
  for (const member of result.data.dutch_pay_members) if (!member.is_completed) await rpc(owner, 'set_settlement_completed', { target_member: member.id, completed: true });
}
async function captureLifecycleViews(expected, prefix) {
  await coldHome();
  const label = expected === 'settling' ? '정산 중' : '정산 완료';
  await waitFor(`Boolean(${control(room.title + ', ' + label)})`, 'home stage ' + expected);
  await capture(prefix + '-home'); await openRoom();
  await waitFor(has('11:00–12:00 · 한국 시간'), 'preserved canonical meeting time');
  const timerExpression = "document.querySelector('[data-testid=room-expiry-timer]')?.innerText";
  await waitFor(expected === 'settling' ? `${timerExpression}==='정산 후 24시간 뒤 사라져요'` : `/\\d{2}:\\d{2}:\\d{2} 후 방이 사라져요/.test(${timerExpression}||'')`, 'stage-specific expiry display');
  const timer = await evaluate(timerExpression);
  check(await evaluate("!document.body.innerText.includes('Infinity')&&!document.body.innerText.includes('infinity')&&!document.body.innerText.includes('Invalid Date')&&!document.body.innerText.includes('NaN')"), 'Invalid infinite-date rendering');
  await capture(prefix + '-card'); await click('방 상세정보');
  await waitFor(`Boolean(${control('방 없애기')})`, 'owner detail loaded');
  const deletionDisabled = await evaluate(`${control('방 없애기')}?.getAttribute('aria-disabled')==='true'`);
  check(deletionDisabled === (expected === 'settling'), 'Detail permission does not reflect server stage');
  check(await evaluate(has('11:00–12:00 · 한국 시간')), 'Detail lost canonical meeting time');
  if (expected === 'settling') check(await evaluate(has('정산이 끝나면 없앨 수 있어요')), 'Settling detail guidance missing');
  await capture(prefix + '-detail'); await click('뒤로');
  evidence.views ??= []; evidence.views.push({ stage: expected, prefix, homeLabel: label, timer, deletionDisabled, canonicalTimePreserved: true }); save();
}
async function followupMain() {
  await prepareActors();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); await connect(); await login(owner);
  phase('followup-real-fixture');
  const created = await appCall('rooms', 'createRoom', [{ ownerId: owner.id, title: 'S4 재연결 검증', meetingDate: day, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }]);
  check(!created.error && created.roomId && created.code, 'Real fixture room creation failed'); room = { id: created.roomId, title: 'S4 재연결 검증', code: created.code };
  await rpc(mate, 'join_room_by_code', { room_code: room.code }); await submit(owner, [11, 12]); await submit(mate, [11, 12]);
  await coldHome(); await openRoom(); await openSheet('일정 조율'); await waitFor(has('시간 선택하기'), 'real scheduling entry'); await click('시간 선택하기');
  phase('followup-edge-local-issuer'); await click('시간 추천받기'); await waitFor(has('시간 추천을 불러오지 못했어요'), 'safe no-provider response');
  const probe = await owner.client.functions.invoke('schedule-recommend', { body: { meetingName: room.title, roomId: room.id, placeCandidates: [] } });
  const status = probe.error?.context?.status; let missingProvider = false;
  try { const body = await probe.error?.context?.clone().json(); missingProvider = body?.error === 'Gemini API key is not configured'; } catch { /* No raw body persisted. */ }
  const browserStatus = evidence.rpcResponses.filter(entry => entry.path.endsWith('/functions/v1/schedule-recommend')).at(-1)?.status;
  check(status === 500 && browserStatus === 500 && missingProvider, 'Local issuer did not reach the expected key-missing response');
  await capture('issuer-fixed-no-provider');
  mark('followup-edge-local-issuer', { browserStatus, sdkStatus: status, unauthorized: false, reachedProviderKeyCheck: true, providerCalls: 0, successfulRecommendation: false });
  // The remaining setup uses real RPCs; it is not another replay of the original seven paths.
  await rpc(owner, 'select_room_meeting_time_v1', { p_room_id: room.id, p_time: time(11, 12), p_expected_revision: (await state(owner)).revision, p_request_id: randomUUID() });
  const itemId = await rpc(owner, 'add_voting_item', { target_room: room.id, item_kind: 'menu', item_label: '재검증 식당' });
  await rpc(owner, 'toggle_vote', { target_room: room.id, item_id: itemId }); await rpc(mate, 'toggle_vote', { target_room: room.id, item_id: itemId });
  await rpc(owner, 'confirm_room_appointment_v1', { p_room_id: room.id, p_restaurant_item_id: itemId, p_expected_revision: (await state(owner)).revision, p_request_id: randomUUID() });
  const account = await owner.client.from('profile_private').update({ bank_name: '로컬 테스트 은행', account_number: '000000000000' }).eq('id', owner.id); check(!account.error, 'Local account fixture failed');
  phase('followup-first-completion'); await coldHome(); await openRoom(); await openSheet('N빵 정산'); await waitFor(has('정산 요청 보내기'), 'initial bill form');
  await input('총 결제금액', '30000'); await click('정산 요청 보내기'); await waitFor(`Boolean(${control('메뉴 펼치기')})&&!${control('닫기')}`, 'initial bill saved');
  const first = await owner.client.from('dutch_pay_bills').select('id').eq('room_id', room.id).single(); check(!first.error && first.data, 'First bill absent');
  await completeBill(first.data.id);
  await waitFor("/\\d{2}:\\d{2}:\\d{2} 후 방이 사라져요/.test(document.querySelector('[data-testid=room-expiry-timer]')?.innerText||'')", 'first completion observed on the open chat');
  const firstDone = await readLifecycle();
  check(firstDone.stage === 'done' && Date.parse(firstDone.expires_at) - Date.parse(firstDone.settled_at) === 86400000, 'First done deadline differs');
  await captureLifecycleViews('done', 'first-done'); mark('followup-first-completion', { lifecycle: firstDone });
  phase('followup-restart'); await openSheet('N빵 정산'); await waitFor(has('새 정산 요청하기'), 'repeat bill action'); await click('새 정산 요청하기');
  await input('총 결제금액', '45000'); await click('정산 요청 보내기'); await waitFor(`Boolean(${control('메뉴 펼치기')})&&!${control('닫기')}`, 'repeat bill saved');
  await waitFor("document.querySelector('[data-testid=room-expiry-timer]')?.innerText==='정산 후 24시간 뒤 사라져요'", 'countdown cleared without a page refresh');
  const active = await readLifecycle();
  check(active.stage === 'settling' && active.expires_at === 'infinity' && active.settled_at === null, 'Repeat lifecycle did not clear completion/deadline');
  await capture('restart-live-card'); await captureLifecycleViews('settling', 'restart');
  const bills = await owner.client.from('dutch_pay_bills').select('id').eq('room_id', room.id); check(!bills.error && bills.data.length === 2, 'Repeat bill count differs');
  const second = bills.data.find(bill => bill.id !== first.data.id); check(second, 'Second bill absent');
  const oldPayment = await rpc(owner, 'get_settlement_payment_details', { p_bill_id: first.data.id }); check(oldPayment.status === 'completed' && oldPayment.payment_details === null, 'Old payment was reopened');
  mark('followup-restart', { lifecycle: active, liveCountdownCleared: true, oldPaymentStillClosed: true });
  phase('followup-second-completion'); await completeBill(second.id);
  await waitFor("/\\d{2}:\\d{2}:\\d{2} 후 방이 사라져요/.test(document.querySelector('[data-testid=room-expiry-timer]')?.innerText||'')", 'new countdown observed without a page refresh');
  const secondDone = await readLifecycle();
  check(secondDone.stage === 'done' && Date.parse(secondDone.settled_at) > Date.parse(firstDone.settled_at)
    && Date.parse(secondDone.expires_at) > Date.parse(firstDone.expires_at) && Date.parse(secondDone.expires_at) - Date.parse(secondDone.settled_at) === 86400000, 'New completion did not create a fresh 24-hour deadline');
  await capture('second-done-live-card'); await captureLifecycleViews('done', 'second-done');
  mark('followup-second-completion', { lifecycle: secondDone, newDeadline: true, exactDeadlineSeconds: 86400 });
  evidence.database = JSON.parse(sql(`select json_build_object('roomId',id,'stage',stage,'settledAt',settled_at,'expiresAt',expires_at,'completionExpirySeconds',extract(epoch from expires_at-settled_at),'restartMigrationApplied',exists(select 1 from supabase_migrations.schema_migrations where version='20261020020000')) from public.rooms where id='${room.id}';`));
  check(evidence.blockedOrigins.length === 0 && evidence.errors.length === 0, 'Unexpected browser network/runtime failure');
  evidence.phase = 'complete'; save(); console.log('S4 local issuer and settlement lifecycle follow-up passed');
}

// Contract review: real local RPCs and unmodified product components. No recommendation/provider call.
function assess(id, passed, details = {}) {
  evidence.cases.push({ id, outcome: passed ? 'PASS' : 'FAIL', ...details }); save(); console.log((passed ? 'PASS ' : 'FAIL ') + id);
}
const membershipMessage = '정산 중이거나 완료된 밥약에는 참여하거나 메이트를 초대할 수 없어요.';
async function rootPage() {
  await call('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/' });
  await waitFor("Boolean(window.__s4E2E)&&window.__s4E2E.access().state==='accepted'&&Boolean(document.querySelector('[role=tab]'))", 'root page');
}
async function clickLegacyText(label) {
  check(await evaluate("(()=>{const e=[...document.querySelectorAll('[tabindex]')].find(e=>e.getClientRects().length&&e.innerText.trim()===" + JSON.stringify(label) + ");if(!e)return false;e.click();return true;})()"), 'Legacy control unavailable: ' + label);
  await delay(300);
}
async function invitationPage() {
  await call('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/?entry=invitations' });
  await waitFor(has('MEALCHATING'), 'actual invitation component');
}
async function billSnapshot(billId) {
  const query = "select json_build_object('stage',r.stage,'expiresAt',r.expires_at,'settledAt',r.settled_at,'firstConfirmedAt',r.appointment_confirmed_at,'absoluteCap',r.appointment_confirmed_at+interval '30 days','billCreatedAt',b.created_at,'restartExpected',least(b.created_at+interval '7 days',r.appointment_confirmed_at+interval '30 days'),'finite',isfinite(r.expires_at),'restartExact',r.expires_at=least(b.created_at+interval '7 days',r.appointment_confirmed_at+interval '30 days'),'completionExact',r.settled_at is not null and r.expires_at=least(r.settled_at+interval '24 hours',r.appointment_confirmed_at+interval '30 days'),'withinAbsoluteCap',r.expires_at<=r.appointment_confirmed_at+interval '30 days','completionSeconds',extract(epoch from r.expires_at-r.settled_at)) from public.rooms r join public.dutch_pay_bills b on b.room_id=r.id where r.id='" + room.id + "' and b.id='" + billId + "';";
  fs.appendFileSync(path.join(output, 'evidence.sql'), query + '\n');
  return JSON.parse(sql(query));
}
async function createReviewBill(amount) {
  return rpc(owner, 'create_room_settlement_v2', { target_room: room.id, bill_title: 'S4 로컬 검증 정산', amount, bank_name: '로컬 테스트 은행', account_number: '000000000000', account_holder: '로컬 테스트' });
}
async function reviewViews(stage, prefix) {
  await coldHome(); const label = stage === 'settling' ? '정산 중' : '정산 완료';
  await waitFor('Boolean(' + control(room.title + ', ' + label) + ')', 'home lifecycle label');
  await evaluate(control(room.title + ', ' + label) + '?.scrollIntoView({block:"center"})');
  const row = await evaluate(control(room.title + ', ' + label) + '?.innerText');
  const homeTimer = /\d+(?:일|시간|분)\s*남음|\d{2}:\d{2}:\d{2}\s*후 방|\d+(?:일|시간|분)\s*뒤 방/.test((row || '').split('\n').slice(1).join('\n'));
  await capture(prefix + '-home'); assess(prefix + '-home-deadline', homeTimer, { stage, row, issue: homeTimer ? undefined : 'Home room row shows stage/time/restaurant but no retention countdown/deadline.' });
  await openRoom(); const timerExpression = "document.querySelector('[data-testid=room-expiry-timer]')?.innerText";
  await waitFor('/방이 사라져요/.test(' + timerExpression + '||\'\')', 'finite chat countdown');
  const timer = await evaluate(timerExpression), expires = await readLifecycle();
  const remaining = (Date.parse(expires.expires_at) - await evaluate('Date.now()')) / 1000;
  const parts = timer.match(/(\d+):(\d{2}):(\d{2})/), seconds = parts ? Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3]) : null;
  const timerValid = (stage === 'settling' ? timer.startsWith('정산 중 · ') : !timer.startsWith('정산 중 · ')) && (seconds === null || Math.abs(seconds - remaining) < 8) && !/infinity|NaN|Invalid/i.test(timer);
  await capture(prefix + '-card'); assess(prefix + '-card-deadline', timerValid, { stage, timer, expiresAt: expires.expires_at, remainingSeconds: Math.floor(remaining), clockSeconds: seconds });
  await openSheet('멤버'); await waitFor(has('멤버 2명'), 'members sheet');
  const memberInviteHidden = await evaluate('!Boolean(' + control('＋ 메이트 초대') + ')&&!document.body.innerText.includes(' + JSON.stringify(room.code) + ')');
  await capture(prefix + '-members'); await closeSheet();
  await click('방 상세정보'); await waitFor('Boolean(' + control('방 없애기') + ')', 'owner detail');
  const detailTimer = await evaluate(timerExpression), disabled = await evaluate(control('방 없애기') + '?.getAttribute("aria-disabled")==="true"');
  const detailInviteHidden = await evaluate('!Boolean(' + control('메이트 초대') + ')&&!document.body.innerText.includes(' + JSON.stringify(room.code) + ')');
  await capture(prefix + '-detail'); assess(prefix + '-detail-deadline-and-invites', /방이 사라져요/.test(detailTimer || '') && disabled === (stage === 'settling') && detailInviteHidden && memberInviteHidden,
    { stage, detailTimer, deletionDisabled: disabled, detailInviteHidden, memberInviteHidden }); await click('뒤로');
}
async function membershipContract(stage, pendingInvitation, acceptedInvitation) {
  const probes = [
    ['join-code', await pendingActor.client.rpc('join_room_by_code', { room_code: room.code })],
    ['create-invitation', await owner.client.rpc('create_room_invitation', { target_room: room.id, invitee_id: pendingActor.id })],
    ['accept-pending', await third.client.rpc('accept_room_invitation', { target_invitation: pendingInvitation })],
    ['reaccept-existing', await mate.client.rpc('accept_room_invitation', { target_invitation: acceptedInvitation })],
  ];
  for (const [operation, result] of probes) assess(stage + '-membership-' + operation, result.error?.code === 'S4003' && result.error?.hint === 'operation=membership', { stage, operation, code: result.error?.code, hint: result.error?.hint, returnedSuccess: !result.error });
}
async function joinCodeUi(stage) {
  await login(pendingActor); await waitFor(has('초대 코드 입력'), 'empty home code action'); await click('초대 코드 입력'); await input('초대 코드', room.code);
  const readsBefore = browserRoomReads; await click('입장'); await waitFor(has(membershipMessage), 'safe closed-room join notice'); await delay(600);
  const closed = await evaluate("![...document.querySelectorAll('input[aria-label=\"초대 코드\"]')].some(e=>e.getClientRects().length)");
  await capture(stage + '-code-membership-notice'); assess(stage + '-code-ui-refresh', closed && browserRoomReads > readsBefore, { safeKoreanMessage: true, sheetClosed: closed, roomReadsBefore: readsBefore, roomReadsAfter: browserRoomReads, navigatedToRoom: await evaluate('Boolean(' + control('메뉴 펼치기') + ')') });
  if (await evaluate('Boolean(' + control('확인') + ')')) await click('확인');
}
async function invitationUi(stage) {
  await login(third); await invitationPage();
  await waitFor(has(room.title), 'pending invitation remains visible');
  const reads = { rooms: browserRoomReads, invitations: browserInvitationReads };
  await clickLegacyText('수락'); await waitFor('!document.body.innerText.includes(' + JSON.stringify(room.title) + ')', 'failed invitation removed'); await delay(600);
  const safeNotice = await evaluate(has(membershipMessage));
  await capture(stage + '-invitation-accept'); assess(stage + '-accept-ui-refresh', browserRoomReads > reads.rooms && browserInvitationReads > reads.invitations,
    { itemRemoved: true, roomReadsBefore: reads.rooms, roomReadsAfter: browserRoomReads, invitationReadsBefore: reads.invitations, invitationReadsAfter: browserInvitationReads });
  assess(stage + '-accept-ui-notice', safeNotice, { safeKoreanNoticeVisible: safeNotice, entry: 'unlinked production ChatHomeScreen mounted through verification-only real providers', limitation: 'Native Android/iOS Alert was not exercised.' });
  if (safeNotice && await evaluate('Boolean(' + control('확인') + ')')) await click('확인');
  await rootPage();
}
async function contractReviewMain() {
  fs.writeFileSync(path.join(output, 'evidence.sql'), '-- Project-local S4 contract verification only.\n');
  await prepareActors(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); await connect(); await login(owner);
  phase('contract-real-setup');
  const created = await appCall('rooms', 'createRoom', [{ ownerId: owner.id, title: 'S4 유한 기한 검증', meetingDate: day, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }]);
  check(!created.error && created.roomId && created.code, 'Room creation failed'); room = { id: created.roomId, title: 'S4 유한 기한 검증', code: created.code };
  const acceptedInvitation = await rpc(owner, 'create_room_invitation', { target_room: room.id, invitee_id: mate.id }); await rpc(mate, 'accept_room_invitation', { target_invitation: acceptedInvitation });
  const pendingInvitation = await rpc(owner, 'create_room_invitation', { target_room: room.id, invitee_id: third.id });
  await submit(owner, [11, 12]); await submit(mate, [11, 12]);
  await rpc(owner, 'select_room_meeting_time_v1', { p_room_id: room.id, p_time: time(11, 12), p_expected_revision: (await state(owner)).revision, p_request_id: randomUUID() });
  const item = await rpc(owner, 'add_voting_item', { target_room: room.id, item_kind: 'menu', item_label: '로컬 검증 식당' });
  await rpc(owner, 'toggle_vote', { target_room: room.id, item_id: item }); await rpc(mate, 'toggle_vote', { target_room: room.id, item_id: item });
  await coldHome(); await openRoom(); await openSheet('식당 정하기'); await waitFor(control('로컬 검증 식당으로 정하기') + '?.getAttribute("aria-disabled")!=="true"', 'owner confirmation action'); await click('로컬 검증 식당으로 정하기'); await waitFor('Boolean(' + control('확정하기') + ')', 'actual confirmation dialog');
  phase('contract-confirmation-poll-failure'); await delay(2500); roomPollFailureBudget = 1;
  for (let turn = 0; turn < 40 && roomPollFailures === 0; turn++) await delay(500);
  check(roomPollFailures === 1, 'One-shot room polling failure was not reached'); await delay(500);
  await waitFor("document.body.textContent.includes('방 정보를 새로 불러오지 못했어요')", 'room lookup failure reaches the product hook');
  const kept = await evaluate('Boolean(' + control('확정하기') + ')'), retainedNotice = await evaluate("document.body.textContent.includes('방 정보를 새로 불러오지 못했어요')");
  await capture('confirmation-after-one-poll-failure'); assess('confirmation-dialog-survives-one-poll-failure', kept && retainedNotice, { injectedTransportFailures: roomPollFailures, retainedRoomNotice: retainedNotice, injection: 'CDP returns one local rooms GET 500 E2E_TRANSIENT; no SDK network retry or fake success response' });
  check(kept, 'Confirmation dialog disappeared'); await click('확정하기'); await waitFor(has('약속을 확정했어요'), 'real owner confirmation');
  assess('confirmation-after-poll-failure-persists', (await state(owner)).confirmation_status === 'owner_confirmed', { stage: (await state(owner)).stage });
  phase('contract-first-completion'); const first = await createReviewBill(30000); await completeBill(first); const firstDone = await billSnapshot(first); check(firstDone.stage === 'done' && firstDone.completionExact, 'First completion boundary mismatch');
  phase('contract-seven-day-restart'); const second = await createReviewBill(45000), restart = await billSnapshot(second);
  assess('restart-seven-day-minimum', restart.stage === 'settling' && restart.settledAt === null && restart.finite && restart.restartExact && restart.withinAbsoluteCap, restart);
  await reviewViews('settling', 'seven-day-restart'); await membershipContract('settling', pendingInvitation, acceptedInvitation);
  await joinCodeUi('settling'); await invitationUi('settling'); await login(owner);
  await completeBill(second); const done = await billSnapshot(second); assess('restart-completion-24h-under-cap', done.stage === 'done' && done.completionExact && done.withinAbsoluteCap, done);
  await reviewViews('done', 'second-completion'); await membershipContract('done', pendingInvitation, acceptedInvitation);
  await joinCodeUi('done'); await invitationUi('done'); await login(owner);
  phase('contract-absolute-cap');
  const shift = "update public.rooms set appointment_confirmed_at=clock_timestamp()-interval '29 days 12 hours' where id='" + room.id + "' and owner_id='" + owner.id + "' returning id;";
  fs.appendFileSync(path.join(output, 'evidence.sql'), '-- Local test fixture only: advance the absolute retention clock.\n' + shift + '\n'); check(sql(shift).includes(room.id), 'Fixture-only confirmation time adjustment failed');
  const cappedBill = await createReviewBill(60000), capped = await billSnapshot(cappedBill);
  assess('restart-thirty-day-absolute-cap', capped.stage === 'settling' && capped.restartExact && capped.expiresAt === capped.absoluteCap && capped.withinAbsoluteCap, capped);
  await reviewViews('settling', 'absolute-cap-restart'); await completeBill(cappedBill); const capDone = await billSnapshot(cappedBill);
  assess('completion-24h-does-not-cross-thirty-day-cap', capDone.stage === 'done' && capDone.completionExact && capDone.expiresAt === capDone.absoluteCap && capDone.completionSeconds > 0 && capDone.completionSeconds < 86400, capDone);
  await reviewViews('done', 'absolute-cap-completion');
  evidence.database = { roomId: room.id, restart, done, capped, capDone, migrationApplied: sql("select exists(select 1 from supabase_migrations.schema_migrations where version='20261020020000');") === 't' };
  assess('review-network-and-runtime', evidence.errors.length === 0 && evidence.blockedOrigins.length === 0 && blockedProviderAttempts === 0, { runtimeExceptions: evidence.errors.length, externalRequests: evidence.blockedOrigins.length, blockedRecommendationAttempts: blockedProviderAttempts, actualTmapGeminiCalls: 0 });
  evidence.phase = 'complete'; evidence.summary = { passed: evidence.cases.filter(c => c.outcome === 'PASS').length, failed: evidence.cases.filter(c => c.outcome === 'FAIL').length }; save(); console.log('Contract review complete: ' + JSON.stringify(evidence.summary)); if (evidence.summary.failed) process.exitCode = 1;
}
(review ? contractReviewMain() : followup ? followupMain() : main()).catch(async error => {
  evidence.cases.push({ id: evidence.phase, outcome: 'FAIL', reason: error.message }); save(); console.error('FAIL ' + evidence.phase + ': ' + error.message);
  try { await capture('failure'); fs.writeFileSync(path.join(output, 'failure-ui.json'), JSON.stringify(await evaluate('({text:document.body.innerText,controls:[...document.querySelectorAll("[role=button],[role=checkbox]")].filter(e=>e.getClientRects().length).map(e=>({label:e.getAttribute("aria-label"),disabled:e.getAttribute("aria-disabled")}))})'), null, 2)); } catch { /* Original failure retained. */ }
  process.exitCode = 1;
}).finally(async () => {
  for (const actor of actors) { try { await actor.client.auth.dispose(); } catch { /* Local-only cleanup. */ } }
  if (browser) { const exited = new Promise(resolve => browser.once('exit', resolve)); browser.kill(); await Promise.race([exited, delay(1500)]); }
  server.close();
  if (browserProfile && path.dirname(path.resolve(browserProfile)) === path.resolve(os.tmpdir()) && path.basename(browserProfile).startsWith('mealchat-s4-real-e2e-')) {
    for (let attempt = 0; attempt < 10; attempt++) { try { fs.rmSync(browserProfile, { recursive: true, force: true }); break; } catch { await delay(200); } }
    evidence.browserProfileRemoved = !fs.existsSync(browserProfile); save();
  }
});
