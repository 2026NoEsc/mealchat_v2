const React = require('react');
const { act, create } = require('react-test-renderer');
const { AppState, Clipboard, Linking } = require('react-native');
jest.mock('../src/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: () => ({ current: { name: 'ChatRoom', params: {} }, goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() }) }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: () => ({ status: 'ready', bundle: { profile: { name: '나' }, privateProfile: { bankName: '카카오뱅크', accountNumber: '11112222', privacySettings: { bank_account: 'private' } } }, reload: jest.fn() }) }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
const { supabase } = require('../src/lib/supabase');
const { useAuth } = require('../src/auth/AuthProvider');
const consents = require('../src/lib/consents');
const { setConsentAccess } = require('../src/consents/access');
const api = require('../src/lib/settlements');
const { createS1Fixture } = require('./fixtures/s1');
const Account = require('../src/screens/settlement/SettlementPaymentAccount').default;
const SettlementsScreen = require('../src/screens/settlement/SettlementsScreen').default;
const { SettlementSheet } = require('../src/screens/chat/ChatRoomSheets');
const { settlementUiError } = require('../src/components/ui/TransferConfirmationSheet');
let renderer, user, fixture, raw, calls, events, query, rows;
const details = { bank_name: '카카오뱅크', account_number: '3333-01-2345678', account_holder: '모아' };
const openResponse = () => ({ bill_id: 'bill', status: 'open', payment_details: { ...details }, hidden_reason: null, server_time: '2026-10-17T00:00:00Z' });
const closedResponse = status => ({ bill_id: 'bill', status, payment_details: null, hidden_reason: status, server_time: '2026-10-17T00:00:00Z' });
const bill = () => ({ id: 'bill', room_id: 'room', creator_id: 'mate', title: '식사 정산', total_amount: 52000, split_count: 4, created_at: '2026-10-17T00:00:00Z', rooms: { title: '저녁 약속' }, dutch_pay_members: [{ id: 'mine', profile_id: 'self', name: '나', is_completed: false }, { id: 'mate-member', profile_id: 'mate', name: '모아', is_completed: true }], ...details });
const output = () => JSON.stringify(renderer.toJSON());
const button = label => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
async function mount(Component = Account, props = { billId: 'bill', amount: 13000, canSend: true }) { await act(async () => { renderer = create(React.createElement(Component, props)); }); }
async function press(label) { await act(async () => button(label).props.onPress()); }
function transport(name, args) { calls.push({ name, args }); return name === 'get_settlement_payment_details' ? Promise.resolve({ data: raw, error: null }) : fixture.rpc(name, args); }
beforeEach(async () => {
  jest.clearAllMocks(); user = { id: 'self' }; useAuth.mockImplementation(() => ({ user })); fixture = createS1Fixture(true); raw = openResponse(); calls = []; events = [];
  consents.configureS1RpcTransport(transport, require('./fixtures/s1').isolatedCapabilityStorage()); setConsentAccess('self', 'accepted'); await consents.fetchConsentManifest(); calls = [];
  rows = [bill()]; query = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn(), returns: jest.fn(), maybeSingle: jest.fn() };
  for (const key of ['select', 'eq', 'order', 'limit']) query[key].mockReturnValue(query);
  query.returns.mockImplementation(async () => ({ data: rows, error: null })); query.maybeSingle.mockImplementation(async () => ({ data: rows[0], error: null })); supabase.from.mockReturnValue(query);
  supabase.rpc.mockResolvedValue({ data: null, error: null });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => { events.push(callback); return { remove: jest.fn() }; });
  jest.spyOn(Clipboard, 'setString').mockImplementation(() => {}); jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; setConsentAccess(null, 'loading'); consents.configureS1RpcTransport(); jest.restoreAllMocks(); jest.useRealTimers(); });
it.each(['completed', 'unavailable'])('removes %s accounts after a server-only change without a local mutation', async state => {
  jest.useFakeTimers(); await mount(); expect(output()).toContain(details.account_number);
  raw = closedResponse(state);
  await act(async () => jest.advanceTimersByTimeAsync(require('../src/screens/settlement/useSettlementPayment').SETTLEMENT_PAYMENT_RECHECK_MS));
  expect(output()).not.toContain(details.account_number); expect(button('계좌 복사')).toBeUndefined(); expect(button('토스로 보내기')).toBeUndefined();
  expect(supabase.rpc).not.toHaveBeenCalled();
  const stoppedAt = calls.length;
  await act(async () => jest.advanceTimersByTimeAsync(30000)); expect(calls).toHaveLength(stoppedAt);
  await act(async () => events.forEach(callback => callback('background')));
  const count = calls.length;
  await act(async () => jest.advanceTimersByTimeAsync(15000)); expect(calls).toHaveLength(count);
});
it('loads only one expanded account even when the list contains several open bills', async () => {
  rows = [bill(), { ...bill(), id: 'second', title: '두 번째' }, { ...bill(), id: 'third', title: '세 번째' }];
  await mount(SettlementsScreen);
  expect(calls.filter(call => call.name === 'get_settlement_payment_details').map(call => call.args.p_bill_id)).toEqual(['bill']);
  raw = { ...openResponse(), bill_id: 'second' }; await press('두 번째 정산 계좌 보기');
  expect(calls.filter(call => call.name === 'get_settlement_payment_details').map(call => call.args.p_bill_id)).toEqual(['bill', 'second']);
  expect(button('두 번째 정산 계좌 접기')).toBeDefined(); expect(button('식사 정산 정산 계좌 보기')).toBeDefined();
});
it('opens the detail transfer question after launching the bank app without marking a share complete', async () => {
  const opened = jest.fn();
  await mount(Account, { billId: 'bill', amount: 13000, canSend: true, presentation: 'detail', onTransferOpened: opened });
  await press('토스로 13,000원 보내기');
  expect(Linking.openURL).toHaveBeenCalledTimes(1); expect(opened).toHaveBeenCalledTimes(1);
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect(calls.filter(call => call.name === 'get_settlement_payment_details').length).toBeGreaterThanOrEqual(2);
});
it('does not open a transfer question if disclosure closes while the external app is opening', async () => {
  let finish; const opened = jest.fn(); Linking.openURL.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const props = { billId: 'bill', amount: 13000, canSend: true, presentation: 'detail', onTransferOpened: opened };
  await mount(Account, props); await press('토스로 13,000원 보내기');
  await act(async () => renderer.update(React.createElement(Account, { ...props, completed: true })));
  await act(async () => finish(true));
  expect(opened).not.toHaveBeenCalled(); expect(supabase.rpc).not.toHaveBeenCalled();
});
it('uses only the bill-scoped RPC for S1 account data and omits account columns from bill lists and notifications', async () => {
  expect((await api.fetchSettlementPaymentDetails('bill')).data.details.accountNumber).toBe(details.account_number);
  expect(calls).toEqual([{ name: 'get_settlement_payment_details', args: { p_bill_id: 'bill' } }]); expect(supabase.from).not.toHaveBeenCalled();
  const list = await api.fetchMySettlementsDetailed(); await api.fetchRoomSettlements('room');
  expect(list.data[0]).not.toHaveProperty('accountNumber'); expect(list.data[0]).not.toHaveProperty('bankName');
  rows = [{ id: 'notice', room_id: null, settlement_id: 'bill', title: '정산 요청', message: '확인해 주세요', amount: 13000, created_at: '2026-10-17T00:00:00Z', ...details }];
  const notifications = await api.fetchMyNotifications(); expect(notifications.data[0].settlementId).toBe('bill'); expect(notifications.data[0]).not.toHaveProperty('accountNumber');
  expect(query.select.mock.calls.every(([columns]) => !/bank_name|account_number|account_holder/.test(columns))).toBe(true);
});
it.each(['completed', 'unavailable'])('renders a normal hidden-account %s state with no send/copy controls, preserving amounts', async status => {
  raw = closedResponse(status); await mount(SettlementsScreen);
  expect(output()).toContain('13,000'); expect(output()).not.toContain(details.account_number);
  expect(button('계좌 복사')).toBeUndefined(); expect(button('토스로 보내기')).toBeUndefined(); expect(button('정산 계좌 다시 확인')).toBeUndefined();
  expect(output()).toContain(status === 'completed' ? '계좌 공개가 끝났어요' : '공개된 정산 계좌가 없어요');
  expect(output()).toContain('진행 중'); // Disclosure closure is NOT the debt completion status.
});
it.each([
  { ...openResponse(), bill_id: 'another-bill' }, { ...closedResponse('completed'), payment_details: details },
  { ...openResponse(), payment_details: null }, { ...closedResponse('unavailable'), hidden_reason: null },
])('rejects malformed or cross-bill responses without returning raw details', async response => {
  raw = response; const result = await api.fetchSettlementPaymentDetails('bill'); expect(result.data).toBeNull(); expect(result.error).toBeTruthy();
});
it('never downgrades a known S1 server for missing detail RPCs or network errors', async () => {
  consents.configureS1RpcTransport(async (name, args) => name === 'get_consent_manifest' ? fixture.rpc(name, args) : { data: null, error: { code: 'PGRST202' } });
  await consents.fetchConsentManifest(); expect((await api.fetchSettlementPaymentDetails('bill')).data).toBeNull(); expect(supabase.from).not.toHaveBeenCalled();
  await mount(); expect(output()).toContain('계좌를 확인하지 못했어요'); expect(output()).not.toContain('3333'); expect(button('정산 계좌 다시 확인')).toBeDefined();
});
it('keeps the old SELECT account contract only after a confirmed legacy manifest probe', async () => {
  consents.configureS1RpcTransport(async () => ({ data: null, error: { code: 'PGRST202', status: 404 } }), require('./fixtures/s1').isolatedCapabilityStorage()); await consents.fetchConsentManifest();
  expect((await api.fetchSettlementPaymentDetails('bill')).data.details.accountNumber).toBe(details.account_number);
  expect(query.select).toHaveBeenCalledWith('id, bank_name, account_number, account_holder, dutch_pay_members(is_completed)');
  rows[0].dutch_pay_members.forEach(member => { member.is_completed = true; });
  expect((await api.fetchSettlementPaymentDetails('bill')).data).toEqual({ billId: 'bill', status: 'completed', details: null });
});
it('shows an open snapshot to a mate even when the profile account switch is private', async () => {
  await mount(SettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn() });
  expect(output()).toContain(details.account_number); expect(button('계좌 복사')).toBeDefined(); expect(button('토스로 보내기')).toBeDefined();
  expect(button('정산 내용 수정')).toBeUndefined();
});
it('rechecks immediately before copy and Toss and refuses an account that closed since rendering', async () => {
  await mount(); raw = closedResponse('completed'); await press('계좌 복사');
  expect(Clipboard.setString).not.toHaveBeenCalled(); expect(output()).not.toContain(details.account_number); expect(button('토스로 보내기')).toBeUndefined();
  expect(calls.filter(call => call.name === 'get_settlement_payment_details')).toHaveLength(2);
});
it('copies and opens Toss only with freshly returned account details', async () => {
  await mount(); await press('계좌 복사'); expect(Clipboard.setString).toHaveBeenCalledWith('카카오뱅크 ' + details.account_number);
  await press('토스로 보내기'); expect(Linking.openURL).toHaveBeenCalledWith('supertoss://send?bankCode=090&accountNo=3333012345678&amount=13000');
  expect(calls.filter(call => call.name === 'get_settlement_payment_details')).toHaveLength(3);
});
it('does not launch Toss when the view becomes disabled during its fresh account check', async () => {
  await mount(); let finish;
  consents.configureS1RpcTransport((name, args) => name === 'get_consent_manifest' ? fixture.rpc(name, args) : new Promise(resolve => { finish = resolve; }));
  await act(async () => button('토스로 보내기').props.onPress());
  await act(async () => renderer.update(React.createElement(Account, { billId: 'bill', amount: 13000, canSend: true, disabled: true })));
  await act(async () => finish({ data: openResponse(), error: null }));
  expect(Linking.openURL).not.toHaveBeenCalled();
});
it('clears account data on background, refetches on foreground, and ignores late responses across account switches', async () => {
  await mount(); await act(async () => events.forEach(callback => callback('background'))); expect(output()).not.toContain(details.account_number);
  raw = closedResponse('unavailable'); await act(async () => events.forEach(callback => callback('active'))); expect(output()).toContain('공개된 정산 계좌가 없어요');
  await act(async () => renderer.unmount()); renderer = undefined;
  raw = openResponse(); await mount(); // A terminal disclosure never reopens within the old hook.
  let finish; consents.configureS1RpcTransport(async (name, args) => name === 'get_consent_manifest' ? fixture.rpc(name, args) : new Promise(resolve => { finish = resolve; }));
  await act(async () => events.forEach(callback => callback('active'))); const oldFinish = finish;
  user = { id: 'other' }; setConsentAccess('other', 'accepted'); await act(async () => renderer.update(React.createElement(Account, { billId: 'bill', amount: 13000, canSend: true })));
  await act(async () => oldFinish({ data: openResponse(), error: null })); expect(output()).not.toContain(details.account_number);
  await act(async () => finish({ data: closedResponse('unavailable'), error: null })); expect(output()).not.toContain(details.account_number);
});
it('clears and refetches payment details after completion even if the mutation response is an error', async () => {
  await mount(); supabase.rpc.mockImplementation(async () => { raw = closedResponse('completed'); return { error: { code: 'S1005' } }; });
  await act(async () => api.setSettlementCompleted('mine', false)); expect(output()).not.toContain(details.account_number); expect(button('계좌 복사')).toBeUndefined();
});
it.each(['S1005', 'SETTLEMENT_DISCLOSURE_CLOSED'])('maps %s through the actual settlement error mapper without raw server text', code => {
  expect(settlementUiError({ code, message: 'private-server-text' })).toContain('끝난 정산은 되돌릴 수 없어요');
  expect(settlementUiError({ code, message: 'private-server-text' })).not.toContain('private-server-text');
});
it('closes the app gate and clears payment data when a settlement mutation requires renewed consent', async () => {
  await mount(); supabase.rpc.mockResolvedValue({ error: { code: 'S1001' } });
  await act(async () => api.createRoomSettlement({ roomId: 'room', title: '정산', amount: 10000 }));
  expect(require('../src/consents/access').getConsentAccess().state).toBe('required'); expect(output()).not.toContain(details.account_number);
});

it.each(['open', 'completed', 'unavailable', 'error'])('quietly preserves an open account during a delayed recheck then applies %s without retaining raw data', async outcome => {
  jest.useFakeTimers(); await mount(); const copyBefore = button('계좌 복사'); expect(output()).toContain(details.account_number);
  let finish;
  consents.configureS1RpcTransport((name, args) => name === 'get_settlement_payment_details' ? new Promise(resolve => { calls.push({ name, args }); finish = resolve; }) : fixture.rpc(name, args));
  await act(async () => jest.advanceTimersByTimeAsync(5000));
  expect(output()).toContain(details.account_number); expect(button('계좌 복사')).toBe(copyBefore); expect(button('토스로 보내기')).toBeDefined();
  const inFlight = calls.length; await act(async () => jest.advanceTimersByTimeAsync(5000)); expect(calls).toHaveLength(inFlight);
  await act(async () => finish(outcome === 'error' ? { data: null, error: { code: 'XX000' } } : { data: outcome === 'open' ? openResponse() : closedResponse(outcome), error: null }));
  if (outcome === 'open') expect(output()).toContain(details.account_number);
  else { expect(output()).not.toContain(details.account_number); expect(button('계좌 복사')).toBeUndefined(); expect(button('토스로 보내기')).toBeUndefined(); }
  if (outcome === 'completed' || outcome === 'unavailable') {
    const end = calls.length; await act(async () => jest.advanceTimersByTimeAsync(30000));
    await act(async () => events.forEach(callback => callback('background')));
    await act(async () => events.forEach(callback => callback('active')));
    await act(async () => api.setSettlementCompleted('mine', true));
    await act(async () => jest.advanceTimersByTimeAsync(30000)); expect(calls).toHaveLength(end);
  }
});
