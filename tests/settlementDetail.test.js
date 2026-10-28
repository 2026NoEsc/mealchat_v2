const React = require('react');
const { act, create } = require('react-test-renderer');
const { AppState, BackHandler, Platform, TextInput } = require('react-native');
jest.mock('../src/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: () => ({ status: 'ready', bundle: { profile: { name: '요청자' }, privateProfile: { bankName: '테스트은행', accountNumber: '00000000' } } }) }));
jest.mock('../src/screens/settlement/useSettlementPayment', () => ({ useSettlementPayment: () => ({ status: 'ready', data: { status: 'open' }, refresh: jest.fn() }) }));
jest.mock('../src/screens/settlement/SettlementPaymentAccount', () => {
  const React = require('react'); const { Text } = require('react-native');
  const Account = props => React.createElement(Text, { testID: 'payment-boundary', ...props }, props.completed ? '공개 종료' : '계좌');
  return { __esModule: true, default: Account, SettlementPaymentAccountView: Account };
});
const { supabase } = require('../src/lib/supabase');
const { useAuth } = require('../src/auth/AuthProvider');
const { useNavigation } = require('../src/navigation/NavigationContext');
const Detail = require('../src/screens/settlement/SettlementDetailScreen').default;
const List = require('../src/screens/settlement/SettlementsScreen').default;
const { SettlementSheet } = require('../src/screens/chat/ChatRoomSheets');
const { settlementDetailRoute, settlementDetailBackRoute, ROUTE_TO_TAB } = require('../src/navigation/routes');
const { setConsentAccess } = require('../src/consents/access');
const phoneSettlementCases = [
  ['541:1617', 'sender'], ['541:1714', 'expenses'], ['563:1936', 'confirmation'], ['588:1860', 'sent'],
  ['588:2024', 'empty'], ['588:2166', 'expenses'], ['588:2320', 'complete'],
  ['629:1858', 'more'], ['629:1993', 'sender-more'], ['629:2128', 'cancel'], ['629:2256', 'cancel-pending'],
  ['629:2362', 'reminder-all'], ['629:2461', 'reminder-one'],
  ['631:5227', 'empty'], ['631:5296', 'reminder-all'], ['631:5534', 'expenses'], ['631:5634', 'reminder-one'],
  ['631:5738', 'complete'], ['631:5851', 'more'], ['631:5940', 'cancel'], ['631:6021', 'cancel-pending'],
];
let renderer, row, query, navigation, user, appEvents;
function setUser(id) { user = { id }; setConsentAccess(id, 'accepted'); }
const text = () => JSON.stringify(renderer.toJSON());
const control = (label, role = 'button') => renderer.root.findAll(node => node.props.accessibilityRole === role && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
async function press(label, role) { await act(async () => control(label, role).props.onPress()); }
async function mount(Component = Detail, props) { await act(async () => { renderer = create(React.createElement(Component, props)); }); }
beforeEach(() => {
  jest.clearAllMocks(); setUser('owner'); appEvents = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => { appEvents.push(callback); return { remove: jest.fn() }; });
  useAuth.mockImplementation(() => ({ user }));
  navigation = { current: { name: 'SettlementDetail', params: { billId: 'bill' } }, navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), resetTo: jest.fn() };
  useNavigation.mockImplementation(() => navigation);
  row = { id: 'bill', room_id: 'room', creator_id: 'owner', title: '정산', total_amount: 52000, split_count: 4, created_at: '2026-09-25T00:00:00Z', rooms: { title: '오늘 저녁팟', meeting_date: '2026-09-25', location_name: '돼지집 서면점' }, dutch_pay_members: [
    { id: 'owner-member', profile_id: 'owner', name: '모아', is_completed: true },
    { id: 'mine', profile_id: 'sender', name: '나야나', is_completed: false },
    { id: 'other', profile_id: 'other-user', name: '또리', is_completed: true },
    { id: 'last', profile_id: 'last-user', name: '웰링', is_completed: false },
  ] };
  query = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), maybeSingle: jest.fn(), returns: jest.fn() };
  for (const method of ['select', 'eq', 'order']) query[method].mockReturnValue(query);
  query.maybeSingle.mockImplementation(async () => ({ data: row, error: null }));
  query.returns.mockImplementation(async () => ({ data: row ? [row] : [], error: null }));
  supabase.from.mockReturnValue(query); supabase.rpc.mockResolvedValue({ data: null, error: null });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; setConsentAccess(null, 'loading'); jest.restoreAllMocks(); });
it.each(phoneSettlementCases)('[phone %s] settlement state %s', async (id, state) => {
  const shabu = id.startsWith('631:');
  row.rooms.location_name = shabu ? '채선당 서면점' : '돼지집 서면점';
  row.rooms.confirmed_menu = row.rooms.location_name;
  row.rooms.title = shabu ? '오늘 저녁팟 · 샤브샤브' : '오늘 저녁팟';
  if (['sender', 'confirmation', 'sent', 'sender-more'].includes(state)) setUser('sender');
  if (state === 'complete') row.dutch_pay_members.forEach(member => { member.is_completed = true; });
  if (state === 'sent') row.dutch_pay_members[1].is_completed = true;
  await mount(); expect(text()).toContain(row.rooms.title); expect(text()).toContain(row.rooms.location_name);
  expect(text()).toContain('52,000원');
  if (state === 'empty') expect(text()).toContain('지출 내역이 아직 없어요');
  if (state === 'sender') expect(renderer.root.findByProps({ testID: 'payment-boundary' }).props.canSend).toBe(true);
  if (state === 'confirmation') { await press('나야나 (나), 대기'); expect(text()).toContain('보냈어요'); expect(supabase.rpc).not.toHaveBeenCalled(); }
  if (state === 'sent') expect(text()).toContain('모아에게 보냈다고 알렸어요');
  if (state === 'complete') { expect(text()).toContain('4명 모두 완료'); expect(renderer.root.findAllByProps({ testID: 'payment-boundary' })).toHaveLength(0); }
  if (state === 'expenses') {
    await press('영수증 찍어서 올리기'); await press('촬영'); await press('직접 입력');
    const fields = renderer.root.findAllByType(TextInput);
    await act(async () => { fields[0].props.onChangeText(row.rooms.location_name); fields[1].props.onChangeText('52000'); });
    await press('로컬 초안으로 넣기'); await press('지출 내역 펼치기'); expect(text()).toContain('실제 정산에 반영되지 않았어요');
    expect(text()).toContain(row.rooms.location_name); await press('지출 내역 접기'); expect(control('지출 내역 펼치기')).toBeDefined();
  }
  if (state === 'reminder-all') { await press('미완료 메이트 모두에게 알리기'); expect(text()).toContain('전체 재알림 요청 준비'); }
  if (state === 'reminder-one') { await press('웰링에게 알리기'); expect(text()).toContain('웰링 재알림 요청 준비'); }
  if (['more', 'sender-more', 'cancel', 'cancel-pending'].includes(state)) {
    await press('정산 더보기'); expect(control('채팅방으로 가기')).toBeDefined();
    if (state === 'sender-more') expect(control('정산 취소')).toBeUndefined();
    if (state.startsWith('cancel')) { await press('정산 취소'); expect(text()).toContain('이미 보낸 돈은 직접 돌려줘야 해요'); }
    if (state === 'cancel-pending') { await press('취소 요청 준비'); expect(navigation.replace).toHaveBeenCalledWith('ChatRoom', { roomId: 'room', localSettlementAction: 'cancel-prepared' }); }
  }
  expect(supabase.rpc).not.toHaveBeenCalled();
});
it('expands a local receipt draft without altering the settlement or writing payment data', async () => {
  await mount(); await press('영수증 찍어서 올리기'); await press('촬영'); await press('직접 입력');
  const fields = renderer.root.findAllByType(TextInput);
  await act(async () => { fields[0].props.onChangeText('새 식당'); fields[1].props.onChangeText('12000'); });
  await press('로컬 초안으로 넣기'); expect(text()).toContain('지출 내역 · 로컬 초안');
  expect(text()).not.toContain('새 식당'); await press('지출 내역 펼치기');
  expect(text()).toContain('새 식당'); expect(text()).toContain('실제 정산에 반영되지 않았어요'); expect(text()).toContain('52,000원');
  await press('지출 내역 접기'); expect(text()).not.toContain('새 식당'); expect(supabase.rpc).not.toHaveBeenCalled();
});
it('renders requester summary, recipient and progress, and hides unavailable actions', async () => {
  await mount(); expect(text()).toContain('오늘 저녁팟'); expect(text()).toContain('52,000원'); expect(text()).toContain('4명 중 2명 완료');
  expect(text()).toContain('받는 사람'); expect(text()).toContain('지출 내역이 아직 없어요');
  expect(text()).not.toContain('영수증을 찍으면'); expect(text()).not.toContain('메뉴와 금액이 들어가요');
  for (const label of ['영수증 찍기', '정산 취소', '알리기', '금액 수정', '정산 내용 수정', '수취인 선택']) expect(control(label)).toBeUndefined();
  await press('미완료', 'tab'); expect(control('또리, 완료')).toBeUndefined(); expect(control('나야나, 대기')).toBeDefined();
  await press('전체', 'tab'); expect(control('또리, 완료')).toBeDefined();
  await press('정산 더보기'); expect(control('채팅방으로 가기')).toBeDefined(); expect(control('정산 내용 복사')).toBeUndefined();
  await press('채팅방으로 가기'); expect(navigation.replace).toHaveBeenCalledWith('ChatRoom', { roomId: 'room' });
  expect(query.eq).toHaveBeenCalledWith('id', 'bill'); expect(query.select.mock.calls[0][0]).not.toMatch(/account_number|bank_name|account_holder/);
  expect(query.select.mock.calls[0][0]).toContain('payment_disclosure_closed_at');
  expect(query.select.mock.calls[0][0]).toContain('rooms(title, meeting_date, location_name, confirmed_menu)');
});
it('allows requester to toggle someone else through the existing RPC in both directions', async () => {
  await mount(); await press('나야나, 대기');
  expect(supabase.rpc).toHaveBeenLastCalledWith('set_settlement_completed', { target_member: 'mine', completed: true });
  await press('또리, 완료');
  expect(text()).toContain('완료 표시를 취소할까요?'); expect(text()).not.toContain('잠금');
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  await press('그대로 둘게요'); expect(supabase.rpc).toHaveBeenCalledTimes(1);
  await press('또리, 완료'); await press('대기로 바꾸기');
  expect(supabase.rpc).toHaveBeenCalledTimes(2);
  expect(supabase.rpc).toHaveBeenLastCalledWith('set_settlement_completed', { target_member: 'other', completed: false });
});
it.each(['owner', 'sender'])('disables every toggle and hides accounts after completion for %s', async id => {
  setUser(id);
  row.dutch_pay_members.forEach(member => { member.is_completed = true; });
  await mount(); expect(text()).toContain('4명 모두 완료');
  expect(control('또리, 완료')).toBeUndefined(); expect(control('나야나 (나), 완료')).toBeUndefined();
  expect(text()).not.toContain('다시 누르면 대기'); expect(supabase.rpc).not.toHaveBeenCalled();
  expect(renderer.root.findAllByProps({ testID: 'payment-boundary' })).toHaveLength(0);
  await press('채팅방으로 가기'); expect(navigation.replace).toHaveBeenCalledWith('ChatRoom', { roomId: 'room' });
});
it('handles S1005 only as a race and immediately disables a closed bill', async () => {
  await mount(); supabase.rpc.mockImplementation(async () => {
    row.dutch_pay_members.forEach(member => { member.is_completed = true; });
    row.payment_disclosure_closed_at = '2026-10-20T01:00:00Z'; return { error: { code: 'S1005' } };
  });
  await press('또리, 완료'); await press('대기로 바꾸기'); expect(text()).toContain('끝난 정산은 되돌릴 수 없어요');
  expect(control('또리, 완료')).toBeUndefined(); expect(text()).toContain('4명 모두 완료');
});
it('requires sender confirmation, only permits self, and preserves failed confirmation', async () => {
  setUser('sender'); await mount();
  expect(control('또리, 완료')).toBeUndefined(); expect(control('웰링, 대기')).toBeUndefined();
  await press('송금했어요'); expect(text()).toContain('보냈나요?'); expect(supabase.rpc).not.toHaveBeenCalled();
  await press('아직이요'); expect(supabase.rpc).not.toHaveBeenCalled();
  await press('나야나 (나), 대기'); supabase.rpc.mockResolvedValueOnce({ error: { code: '42501' } }); await press('보냈어요');
  expect(control('보냈어요')).toBeDefined(); expect(text()).toContain('이 상태는 바꿀 수 없어요');
  supabase.rpc.mockImplementation(async () => { row.dutch_pay_members[1].is_completed = true; return { error: null }; });
  await press('보냈어요'); expect(supabase.rpc).toHaveBeenLastCalledWith('set_settlement_completed', { target_member: 'mine', completed: true });
  expect(text()).toContain('모아에게 보냈다고 알렸어요'); expect(control('송금했어요')).toBeUndefined();
});
it('warns before requester completes the last waiting recipient and locks duplicate confirmation', async () => {
  row.dutch_pay_members[3].is_completed = true; let finish;
  supabase.rpc.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await mount(); await press('나야나, 대기');
  expect(text()).toContain('모두 완료하면');
  expect(supabase.rpc).not.toHaveBeenCalled(); await press('그대로 둘게요'); expect(supabase.rpc).not.toHaveBeenCalled();
  await press('나야나, 대기');
  await act(async () => { const button = control('모두 완료로 표시'); button.props.onPress(); button.props.onPress(); });
  expect(supabase.rpc).toHaveBeenCalledTimes(1); expect(supabase.rpc).toHaveBeenCalledWith('set_settlement_completed', { target_member: 'mine', completed: true });
  row.dutch_pay_members[1].is_completed = true; await act(async () => finish({ error: null }));
  expect(control('모두 완료로 표시')).toBeUndefined(); expect(control('나야나, 완료')).toBeUndefined();
});
it('confirms undo for a sender and keeps account viewing available until the entire bill closes', async () => {
  setUser('sender'); row.dutch_pay_members[1].is_completed = true;
  await mount(); const boundary = renderer.root.findAllByProps({ testID: 'payment-boundary' }); expect(boundary.length).toBeGreaterThan(0);
  expect(boundary[0].props.canSend).toBe(false);
  await press('나야나 (나), 완료'); expect(supabase.rpc).not.toHaveBeenCalled(); expect(text()).toContain('실제 송금은 취소되지 않아요');
  await press('그대로 둘게요'); expect(supabase.rpc).not.toHaveBeenCalled();
  await press('나야나 (나), 완료'); await press('대기로 바꾸기');
  expect(supabase.rpc).toHaveBeenCalledWith('set_settlement_completed', { target_member: 'mine', completed: false });
});
it('never mounts a requester account, shows participant accounts, and respects explicit disclosure closure', async () => {
  await mount(); expect(renderer.root.findAllByProps({ testID: 'payment-boundary' })).toHaveLength(0);
  await act(async () => { setUser('sender'); renderer.update(React.createElement(Detail)); });
  expect(renderer.root.findAllByProps({ testID: 'payment-boundary' }).length).toBeGreaterThan(0);
  row.payment_disclosure_closed_at = '2026-10-20T01:00:00Z';
  await act(async () => appEvents.forEach(callback => callback('active')));
  expect(renderer.root.findAllByProps({ testID: 'payment-boundary' })).toHaveLength(0); expect(control('나야나 (나), 대기')).toBeUndefined();
  expect(text()).not.toContain('4명 모두 완료'); expect(text()).toContain('정산이 종료됐어요');
});
it.each([[{ code: 'P0002' }, '정산을 찾을 수 없어요'], [{ code: '42501' }, '이 상태는 바꿀 수 없어요'], [new Error('private diagnostic'), '연결을 확인하고']])('maps completion failure safely: %s', async (error, message) => {
  await mount(); supabase.rpc.mockResolvedValue({ error }); await press('또리, 완료'); await press('대기로 바꾸기');
  expect(text()).toContain(message); expect(text()).not.toContain('private diagnostic'); expect(text()).toContain('4명 중 2명 완료');
});
it('reloads on foreground and does not refill the screen after consent revocation or a late response', async () => {
  await mount(); const previous = query.maybeSingle.mock.calls.length;
  await act(async () => appEvents.forEach(callback => callback('background')));
  expect(query.maybeSingle).toHaveBeenCalledTimes(previous);
  let resolve; query.maybeSingle.mockImplementation(() => new Promise(done => { resolve = done; }));
  await act(async () => appEvents.forEach(callback => callback('active'))); expect(query.maybeSingle).toHaveBeenCalledTimes(previous + 1);
  await act(async () => setConsentAccess('owner', 'required')); expect(text()).not.toContain('오늘 저녁팟');
  await act(async () => resolve({ data: row, error: null }));
  await act(async () => appEvents.forEach(callback => callback('active')));
  expect(query.maybeSingle).toHaveBeenCalledTimes(previous + 1); expect(text()).not.toContain('오늘 저녁팟'); expect(control('또리, 완료')).toBeUndefined();
});
it('maps a rejected network request without exposing its diagnostic', async () => {
  await mount(); supabase.rpc.mockRejectedValue(new Error('private network diagnostic')); await press('또리, 완료'); await press('대기로 바꾸기');
  expect(text()).toContain('연결을 확인하고'); expect(text()).not.toContain('private network diagnostic');
});
it('explains the paid-bill lock in the chat creation sheet without changing generic shared messages', async () => {
  const { settlementUiError } = require('../src/components/ui/TransferConfirmationSheet');
  expect(settlementUiError({ code: '42501' })).toContain('만든 사람만'); expect(settlementUiError({ code: 'P0002' })).toContain('계좌');
  row = null; navigation.current = { name: 'ChatRoom', params: { roomId: 'room' } };
  supabase.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'SETTLEMENT_LOCKED_AFTER_PAYMENT' } });
  await mount(SettlementSheet, { visible: true, roomId: 'room', roomStage: 'confirmed', appointmentConfirmedAt: '2026-09-25T00:00:00Z', onClose: jest.fn() });
  await act(async () => renderer.root.findByType(TextInput).props.onChangeText('52000')); await press('정산 요청 보내기');
  expect(require('../src/lib/confirm').notify).toHaveBeenCalledWith('정산 요청 실패', expect.stringContaining('이미 송금 완료한 메이트'));
  expect(navigation.navigate).not.toHaveBeenCalled();
});
it.each([['owner', 'ChatRoom', { roomId: 'room' }], ['sender', 'Settlements', undefined]])('uses Figma back destination for %s', async (id, route, params) => {
  setUser(id); await mount(); await press('뒤로'); expect(navigation.replace).toHaveBeenCalledWith(route, params);
});
it('handles deleted rooms and inaccessible bills without exposing stale controls', async () => {
  row.room_id = null; row.rooms = null; await mount(); await press('정산 더보기'); expect(control('채팅방으로 가기')).toBeUndefined();
  await press('닫기'); await press('뒤로'); expect(navigation.replace).toHaveBeenCalledWith('Settlements', undefined);
  row = null; await act(async () => { renderer.unmount(); }); await mount(); expect(text()).toContain('정산을 불러오지 못했어요'); expect(control('정산 더보기')).toBeUndefined();
});
it('clears the loaded bill immediately on identity changes and ignores old responses', async () => {
  await mount(); let resolve;
  query.maybeSingle.mockImplementation(() => new Promise(done => { resolve = done; }));
  await act(async () => { setUser('stranger'); renderer.update(React.createElement(Detail)); });
  expect(text()).not.toContain('오늘 저녁팟'); expect(control('나야나, 대기')).toBeUndefined();
  await act(async () => { renderer.unmount(); }); await act(async () => { resolve({ data: row, error: null }); });
});
it('links the list to the dedicated bill route without account data in params', async () => {
  navigation.current = { name: 'Settlements' }; await mount(List); await press('정산 정산 상세 보기');
  expect(navigation.navigate).toHaveBeenCalledWith('SettlementDetail', { billId: 'bill', entry: 'Settlements' });
  expect(settlementDetailRoute('bill')).toEqual({ name: 'SettlementDetail', params: { billId: 'bill' } });
  expect(settlementDetailBackRoute(true, null)).toEqual({ name: 'Settlements' }); expect(ROUTE_TO_TAB.SettlementDetail).toBeUndefined();
  await press('뒤로'); expect(navigation.resetTo).toHaveBeenCalledWith('Home');
});
it('opens the returned bill after requesting from chat, and hides amount editing on existing bills', async () => {
  row = null; navigation.current = { name: 'ChatRoom', params: { roomId: 'room' } };
  const close = jest.fn(); supabase.rpc.mockResolvedValue({ data: 'created-bill', error: null });
  await mount(SettlementSheet, { visible: true, roomId: 'room', roomStage: 'confirmed', appointmentConfirmedAt: '2026-09-25T00:00:00Z', onClose: close });
  await act(async () => renderer.root.findByType(TextInput).props.onChangeText('52000')); await press('정산 요청 보내기');
  expect(supabase.rpc).toHaveBeenCalledWith('create_room_settlement_v2', expect.objectContaining({ amount: 52000, target_room: 'room' }));
  expect(close).toHaveBeenCalled(); expect(navigation.navigate).toHaveBeenCalledWith('SettlementDetail', { billId: 'created-bill', entry: 'ChatRoom' });
  expect(navigation.replace).toHaveBeenCalledWith('ChatRoom', expect.objectContaining({ openSheet: undefined, awaitingSettlementAccount: undefined }));
});
it.each([['owner', 'ChatRoom'], ['sender', 'Settlements']])('pops an existing %s entry instead of duplicating the return screen', async (id, entry) => {
  setUser(id); navigation.canGoBack = true; navigation.current.params.entry = entry;
  await mount(); await press('뒤로'); expect(navigation.goBack).toHaveBeenCalled(); expect(navigation.replace).not.toHaveBeenCalled();
});
it('uses the Figma requester destination for Android hardware back', async () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android'); const callbacks = [];
  const listener = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, callback) => { callbacks.push(callback); return { remove: jest.fn() }; });
  try {
    await mount(); await act(async () => { expect(callbacks.at(-1)()).toBe(true); });
    expect(navigation.replace).toHaveBeenCalledWith('ChatRoom', { roomId: 'room' });
  } finally { listener.mockRestore(); platform.restore(); }
});
