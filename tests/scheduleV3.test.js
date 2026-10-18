const React = require('react');
const { act, create } = require('react-test-renderer');
const { AppState, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } = require('react-native');

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaProvider: ({ children }) => children }));
jest.mock('expo-linking', () => ({ getInitialURL: jest.fn().mockResolvedValue(null), addEventListener: jest.fn(() => ({ remove: jest.fn() })), createURL: path => path }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
// Calendar fixtures describe device-local dates; a KST midnight is July in UTC/LA.
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'me', created_at: new Date(2026, 7, 1).toISOString() } }) }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: jest.fn() }));
jest.mock('../src/components/NotificationsProvider', () => ({ useNotifications: () => ({ hasUnread: false, open: jest.fn() }) }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/lib/calendarNotes', () => ({ createEvent: jest.fn(), updateEvent: jest.fn(), deleteNote: jest.fn(), saveMemo: jest.fn() }));
jest.mock('../src/schedule/useMonthNotes', () => ({ ...jest.requireActual('../src/schedule/useMonthNotes'), useMonthNotes: jest.fn() }));
jest.mock('../src/lib/friends', () => ({ fetchMyFriends: jest.fn() }));
jest.mock('../src/lib/tmap', () => ({ searchPlaces: jest.fn() }));
jest.mock('../src/components/TmapMap', () => () => null);
jest.mock('../src/lib/rooms', () => ({ createRoom: jest.fn(), createRoomInvitation: jest.fn(), fetchRoom: jest.fn(), advanceRoomStage: jest.fn(), leaveRoom: jest.fn() }));
jest.mock('../src/lib/availability', () => ({ fetchRoomAvailability: jest.fn(), saveMyAvailability: jest.fn() }));
jest.mock('../src/lib/placeCandidates', () => ({ buildPlaceCandidates: jest.fn() }));
jest.mock('../src/rooms/useMyRooms', () => ({ useRoom: jest.fn(), useRoomMessages: jest.fn(), useMyRooms: () => ({ rooms: [], status: 'ready', reload: jest.fn() }), useMySettlements: () => [] }));
jest.mock('../src/lib/confirm', () => ({ confirmAction: jest.fn(), notify: jest.fn() }));
jest.mock('../src/screens/chat/ChatRoomSheets', () => ({ MembersSheet: () => null, SettlementSheet: () => null }));
jest.mock('../src/screens/chat/ScheduleSheet', () => () => null);
jest.mock('../src/screens/chat/VotingSheet', () => () => null);
jest.mock('../src/lib/consents', () => ({ getConsentServerMode: jest.fn(() => 's1'), fetchConsentManifest: jest.fn() }));
jest.mock('../src/lib/foodProfile', () => ({ ...jest.requireActual('../src/lib/foodProfile'), fetchFoodCatalog: jest.fn(async () => ({ data: { contract_version: 2 }, error: null })) }));
jest.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

const TimeCell = require('../src/components/ui/TimeCell').default;
const MateToggle = require('../src/components/ui/MateToggle').default;
const ColorDot = require('../src/components/ui/ColorDot').default;
const PersonalEventSheet = require('../src/screens/schedule/PersonalEventSheet').default;
const ScheduleHomeScreen = require('../src/screens/schedule/ScheduleHomeScreen').default;
const ScheduleDetailScreen = require('../src/screens/schedule/ScheduleDetailScreen').default;
const ScheduleTimeScreen = require('../src/screens/schedule/ScheduleTimeScreen').default;
const ScheduleConfirmedScreen = require('../src/screens/schedule/ScheduleConfirmedScreen').default;
const AvailabilityGrid = require('../src/components/AvailabilityGrid').default;
const { useNavigation } = require('../src/navigation/NavigationContext');
const { useMonthNotes } = require('../src/schedule/useMonthNotes');
const { fetchMyFriends } = require('../src/lib/friends');
const { searchPlaces } = require('../src/lib/tmap');
const { createRoom, createRoomInvitation, fetchRoom, advanceRoomStage, leaveRoom } = require('../src/lib/rooms');
const { buildPlaceCandidates } = require('../src/lib/placeCandidates');
const { supabase } = require('../src/lib/supabase');
const { earliestCalendarMonth, canMoveCalendarMonth } = require('../src/screens/schedule/scheduleState');
const { ROUTE_TO_TAB } = require('../src/navigation/routes');
const { useRoom, useRoomMessages } = require('../src/rooms/useMyRooms');
const { confirmAction, notify } = require('../src/lib/confirm');
const RoomDetailScreen = require('../src/screens/chat/RoomDetailScreen').default;
const ChatRoomScreen = require('../src/screens/chat/ChatRoomScreen').default;
const HomeScreen = require('../src/screens/HomeScreen').default;
const AsyncStorage = require('@react-native-async-storage/async-storage');
const { useMyProfile } = require('../src/profile/useMyProfile');
const { createEvent, updateEvent, deleteNote, saveMemo } = require('../src/lib/calendarNotes');
const { fetchRoomAvailability, saveMyAvailability } = require('../src/lib/availability');
let renderer;
let navigation;
const origin = { name: '서면역', address: '부산', lat: 35.1, lng: 129.1, fromGps: false };
const event = { id: 'event', title: '알바', time: '10:00 ~ 15:00', color: '#1D4ED8' };
const targets = (root) => root.findAll((node) => typeof node.props.onPress === 'function' && Boolean(node.props.accessibilityRole));
const target = (root, label) => targets(root).find((node) => node.props.accessibilityLabel === label);
const field = (root, label) => root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === label);
const text = (root) => root.findAllByType(Text).map((node) => node.props.children).flat().join(' ').replace(/\s+/g, ' ');
async function render(Component, props = {}) { await act(async () => { renderer = create(React.createElement(Component, props)); }); return renderer.root; }
async function press(root, label) { await act(async () => target(root, label).props.onPress()); }
function sheetProps(overrides = {}) { return { visible: true, session: 1, year: 2026, month: 9, day: 25, memo: '기존 메모', onClose: jest.fn(), onSave: jest.fn().mockResolvedValue(true), onSaveMemo: jest.fn().mockResolvedValue(true), onDelete: jest.fn().mockResolvedValue(true), ...overrides }; }
function picks() { return [1, 2].map((rank) => ({ rank, score: 90 - rank, slot: { id: 'slot' + rank, date: '2026-09-25', startTime: rank === 1 ? '19:00' : '18:00', endTime: '20:00', label: '' }, availableCount: rank === 1 ? 4 : 3, totalCount: 4, attendanceRate: 1, rainChance: rank === 1 ? 10 : null, reason: '실제 서버 이유 문장' })); }
beforeEach(() => {
  jest.clearAllMocks(); require('../src/lib/consents').getConsentServerMode.mockReturnValue('s1');
  jest.spyOn(console, 'error').mockImplementation(() => {});
  navigation = { current: { name: 'Schedule', params: { roomId: 'room', name: '오늘 저녁팟', invitees: [], origin } }, navigate: jest.fn(), resetTo: jest.fn(), replace: jest.fn(), goBack: jest.fn(), goBackWith: jest.fn() };
  useNavigation.mockReturnValue(navigation);
  useRoom.mockReturnValue({ room: null, reload: jest.fn() }); useRoomMessages.mockReturnValue({ messages: [], status: 'ready', reload: jest.fn() }); leaveRoom.mockResolvedValue(null);
  useMyProfile.mockReturnValue({ bundle: null });
  AsyncStorage.getItem.mockResolvedValue(null); AsyncStorage.setItem.mockResolvedValue(); AsyncStorage.removeItem.mockResolvedValue();
  createRoom.mockResolvedValue({ roomId: 'new-room', error: null }); createRoomInvitation.mockResolvedValue({ error: null });
  createEvent.mockResolvedValue({ data: null, error: null }); updateEvent.mockResolvedValue(null); deleteNote.mockResolvedValue(null); saveMemo.mockResolvedValue(null);
  fetchRoomAvailability.mockResolvedValue({ data: { members: [], mySlots: [], othersSlots: [] }, error: null }); saveMyAvailability.mockResolvedValue(null);
  useMonthNotes.mockReturnValue({ notes: [], status: 'ready', reload: jest.fn() });
  fetchMyFriends.mockResolvedValue({ data: [{ id: 'friend', profileId: 'mate', name: '모아' }] });
  fetchRoom.mockResolvedValue({ data: { participants: [{ profileId: 'me' }] }, error: null });
  buildPlaceCandidates.mockResolvedValue({ candidates: [{ id: 'place' }] });
  advanceRoomStage.mockResolvedValue({ error: null });
  supabase.functions.invoke.mockResolvedValue({ data: { slotRecommendations: picks() }, error: null });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; jest.restoreAllMocks(); jest.useRealTimers(); });

it.each(['mine', 'free', 'busy', 'shared'])('renders the TimeCell %s state with a separate 44px target', async (state) => {
  const onPress = jest.fn(); const root = await render(TimeCell, { state, label: '25일 12시', onPress });
  const button = target(root, '25일 12시');
  expect(button.props.accessibilityState).toEqual({ checked: state === 'mine', disabled: state === 'busy' });
  const style = StyleSheet.flatten(button.props.style({ pressed: false }));
  expect(style).toMatchObject({ width: 56, minHeight: 44 });
  const cell = root.findAll((node) => StyleSheet.flatten(node.props.style)?.height === 36)[0];
  expect(StyleSheet.flatten(cell.props.style)).toMatchObject({ width: 56, height: 36, borderRadius: 6 });
  if (state !== 'busy') { await press(root, '25일 12시'); expect(onPress).toHaveBeenCalledTimes(1); }
});
it('uses checkbox state and a check badge on the selected mate, then toggles off', async () => {
  const onChange = jest.fn(); const root = await render(MateToggle, { name: '모아', selected: true, onChange });
  expect(target(root, '모아').props.accessibilityState.checked).toBe(true);
  expect(text(root)).toContain('모아'); await press(root, '모아'); expect(onChange).toHaveBeenCalledWith(false);
});
it('exposes color names and selection with a 44px target and outline', async () => {
  const onSelect = jest.fn(); const root = await render(ColorDot, { label: '파랑', color: '#1D4ED8', selected: true, onSelect });
  const button = target(root, '파랑'); expect(button.props.accessibilityRole).toBe('radio');
  expect(StyleSheet.flatten(button.props.style({ pressed: false }))).toMatchObject({ width: 44, height: 44 });
  expect(root.findAll((node) => StyleSheet.flatten(node.props.style)?.borderWidth === 2).length).toBeGreaterThan(0);
  await press(root, '파랑'); expect(onSelect).toHaveBeenCalledTimes(1);
});
it('preserves separate drafts across sheet tabs and saves only the active memo', async () => {
  const props = sheetProps(); const root = await render(PersonalEventSheet, props);
  await act(async () => field(root, '일정 이름').props.onChangeText('수정한 일정'));
  await press(root, '약속 메모');
  await act(async () => field(root, '약속 메모').props.onChangeText('새 메모'));
  expect(target(root, '일정 삭제')).toBeUndefined();
  await press(root, '일정'); expect(field(root, '일정 이름').props.value).toBe('수정한 일정');
  await press(root, '약속 메모'); expect(field(root, '약속 메모').props.value).toBe('새 메모');
  await press(root, '저장하기'); expect(props.onSaveMemo).toHaveBeenCalledWith('새 메모'); expect(props.onSave).not.toHaveBeenCalled();
});
it('separates edit from delete and keeps the sheet open on deletion failure', async () => {
  const props = sheetProps({ editing: event, onDelete: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true) });
  const root = await render(PersonalEventSheet, props); expect(target(root, '수정하기')).toBeDefined();
  await press(root, '일정 삭제'); expect(props.onSave).not.toHaveBeenCalled(); expect(props.onClose).not.toHaveBeenCalled();
  await press(root, '일정 삭제'); expect(props.onDelete).toHaveBeenCalledWith('event'); expect(props.onClose).toHaveBeenCalledTimes(1);
});
it('blocks incomplete time, retains failed edits, and closes only after a successful save', async () => {
  const props = sheetProps({ editing: event, onSave: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true) });
  const root = await render(PersonalEventSheet, props);
  await act(async () => field(root, '시작 시간').props.onChangeText('09'));
  await press(root, '수정하기'); expect(props.onSave).not.toHaveBeenCalled(); expect(text(root)).toContain('네 자리');
  await act(async () => field(root, '시작 시간').props.onChangeText('0900'));
  await press(root, '수정하기'); expect(props.onClose).not.toHaveBeenCalled();
  await press(root, '수정하기'); expect(props.onSave).toHaveBeenLastCalledWith({ ...event, time: '09:00 ~ 15:00' }); expect(props.onClose).toHaveBeenCalledTimes(1);
});
it('does not render event deletion for a new event or the memo tab', async () => {
  const root = await render(PersonalEventSheet, sheetProps()); expect(target(root, '일정 삭제')).toBeUndefined();
  await press(root, '약속 메모'); expect(target(root, '일정 삭제')).toBeUndefined(); expect(target(root, '메모 지우기')).toBeDefined();
});
it('limits month navigation at the signup month while allowing later months across years', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 25, 12));
  const root = await render(ScheduleHomeScreen);
  await press(root, '이전 달'); expect(text(root)).toContain('2026 년 8 월');
  expect(target(root, '이전 달').props.disabled).toBe(true);
  await press(root, '이전 달'); expect(text(root)).toContain('2026 년 8 월');
  await press(root, '다음 달'); expect(target(root, '이전 달').props.disabled).toBe(false);
  expect(canMoveCalendarMonth({ year: 2027, month: 1 }, -1, { year: 2026, month: 8 })).toBe(true);
  expect(earliestCalendarMonth(undefined, new Date(2026, 8, 25))).toEqual({ year: 2026, month: 9 });
});
it.each([
  [new Date(2026, 7, 1), { year: 2026, month: 8 }],
  [new Date(2027, 0, 1), { year: 2027, month: 1 }],
  [new Date(2026, 11, 31, 23, 59), { year: 2026, month: 12 }],
])('keeps the local signup month at the calendar boundary %s', (createdAt, expected) => {
  expect(earliestCalendarMonth(createdAt.toISOString())).toEqual(expected);
});
it('shows at most 3 event dots from real notes and exposes 48px date targets', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 25, 12));
  useMonthNotes.mockReturnValue({ notes: Array.from({ length: 4 }, (_, index) => ({ id: 'note' + index, date: '2026-09-25', title: '일정', time: '10:00', endTime: '11:00', color: '#1D4ED8' })), status: 'ready', reload: jest.fn() });
  const root = await render(ScheduleHomeScreen); const day = target(root, '9월 25일, 일정 4개');
  expect(StyleSheet.flatten(day.props.style).height).toBe(48);
  const dots = day.findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.width === 4 && StyleSheet.flatten(node.props.style)?.height === 4);
  expect(dots).toHaveLength(3);
});
it('keeps other mates available cells selectable and disables past cells in v3', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 25, 10));
  const toggle = jest.fn(); const root = await render(AvailabilityGrid, { variant: 'v3', days: [{ date: '2026-09-25', month: 9, day: 25, label: '금' }], picked: new Set(), others: new Set(['2026-09-25-12']), onToggle: toggle });
  const cell = targets(root).find((node) => node.props.accessibilityLabel?.includes('12시 ~ 13시'));
  expect(cell.props.disabled).toBe(false); await act(async () => cell.props.onPress()); expect(toggle).toHaveBeenCalledWith('2026-09-25', 12);
});
it('selects a recommendation for comparison without presenting it as a saved time, then opens restaurants', async () => {
  const root = await render(ScheduleConfirmedScreen);
  expect(text(root)).not.toContain('89%'); expect(text(root)).toContain('4명 모두 가능');
  const radios = targets(root).filter((node) => node.props.accessibilityRole === 'radio'); expect(radios.map((node) => node.props.accessibilityState.checked)).toEqual([true, false]);
  await act(async () => radios[1].props.onPress()); expect(radios.map((node) => node.props.accessibilityState.checked)).toEqual([false, true]);
  expect(text(root)).not.toContain('확정'); expect(target(root, '이 시간으로 확정하기')).toBeUndefined();
  await press(root, '식당 정하러 가기'); expect(navigation.navigate).toHaveBeenCalledWith('ChatRoom', expect.objectContaining({ roomId: 'room', openSheet: 'menu' }));
});
it('connects real recommendation failure to retry and manual dates, and never advances stale recommendations', async () => {
  supabase.functions.invoke.mockResolvedValueOnce({ data: null, error: new Error('provider failure') }).mockResolvedValueOnce({ data: { slotRecommendations: picks() }, error: null });
  const root = await render(ScheduleConfirmedScreen); expect(text(root)).toContain('모두 되는 시간을 계산하지 못했어요'); expect(target(root, '식당 정하러 가기').props.disabled).toBe(true);
  await press(root, '날짜 직접 고르기'); expect(navigation.goBackWith).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'room' }));
  await press(root, '다시 시도'); expect(supabase.functions.invoke).toHaveBeenCalledTimes(2); expect(target(root, '식당 정하러 가기').props.disabled).toBe(false);
});
it('treats an empty recommendation response as a retryable failure', async () => {
  supabase.functions.invoke.mockResolvedValueOnce({ data: { slotRecommendations: [] }, error: null }); const root = await render(ScheduleConfirmedScreen); expect(target(root, '다시 시도')).toBeDefined(); expect(target(root, '식당 정하러 가기').props.disabled).toBe(true);
});
it('hides bottom tabs throughout new meeting creation ', () => {
  for (const route of ['ScheduleDetail', 'ScheduleTime', 'ScheduleConfirmed']) expect(ROUTE_TO_TAB[route]).toBeUndefined(); expect(ROUTE_TO_TAB.Schedule).toBe('schedule');
});

it('includes a sixth selected color for a legacy event and preserves it on save', async () => {
  const props = sheetProps({ editing: { ...event, color: '#5B9BD5' } }); const root = await render(PersonalEventSheet, props);
  expect(target(root, '기존 색상').props.accessibilityState.checked).toBe(true);
  expect(new Set(targets(root).filter(n => n.props.accessibilityRole === 'radio').map(n => n.props.accessibilityLabel)).size).toBe(6);
  await press(root, '수정하기'); expect(props.onSave).toHaveBeenCalledWith({ ...event, color: '#5B9BD5' });
});
it('uses the new palette only for missing colors and preserves stored legacy colors', () => {
  const { groupNotes } = jest.requireActual('../src/schedule/useMonthNotes');
  const { scheduleEventColors } = require('../src/theme/scheduleTokens');
  const result = groupNotes([{ id: 'a', date: '2026-09-25', title: 'a', time: '09:00', color: null }, { id: 'b', date: '2026-09-25', title: 'b', time: '10:00', color: '#5B9BD5' }]);
  expect(result.eventsByDay[25].map(e => e.color)).toEqual([scheduleEventColors[0].value, '#5B9BD5']);
});
it('exposes both mine and mate availability with a visible non-color marker and today text', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 25, 10));
  const root = await render(AvailabilityGrid, { variant: 'v3', days: [{ date: '2026-09-25', month: 9, day: 25, label: '금' }], picked: new Set(['2026-09-25-12']), others: new Set(['2026-09-25-12']), onToggle: jest.fn() });
  const cell = targets(root).find(n => n.props.accessibilityLabel?.includes('12시 ~ 13시'));
  expect(cell.props.accessibilityLabel).toContain('내가 가능, 메이트 가능, 오늘'); expect(cell.props.accessibilityState.checked).toBe(true);
  expect(cell.findAll(n => n.props.testID === 'mate-available-marker').length).toBeGreaterThan(0); expect(text(root)).toContain('오늘');
});
it('keeps all five days inside a 298px viewport on a 360px device with 44px targets', async () => {
  const days = Array.from({ length: 5 }, (_, i) => ({ date: '2026-09-' + (25 + i), month: 9, day: 25 + i, label: '금' }));
  const root = await render(AvailabilityGrid, { variant: 'v3', days, picked: new Set(), onToggle: jest.fn() });
  const scroll = root.findAll(n => n.props.horizontal && n.props.onLayout)[0]; await act(async () => scroll.props.onLayout({ nativeEvent: { layout: { width: 298 } } }));
  const widths = root.findAllByType(TimeCell).slice(0, 5).map(n => n.props.width);
  expect(Math.max(...widths)).toBeLessThan(56); expect(Math.min(...widths)).toBeGreaterThanOrEqual(44); expect(widths.reduce((a,b) => a+b, 36 + 5*4)).toBeCloseTo(298);
});
it('passes exact calendar event, edit, delete and memo arguments to existing APIs', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 25, 12));
  useMonthNotes.mockReturnValue({ notes: [{ id: 'event', date: '2026-09-25', title: '알바', time: '10:00', endTime: '15:00', color: '#1D4ED8' }, { id: 'memo', date: '2026-09-25', title: '', time: null, content: 'old' }], status: 'ready', reload: jest.fn() });
  const root = await render(ScheduleHomeScreen); const sheet = root.findByType(PersonalEventSheet);
  await act(async () => sheet.props.onSave({ ...event, id: 'new' })); expect(createEvent).toHaveBeenCalledWith({ profileId: 'me', date: '2026-09-25', title: '알바', time: '10:00', endTime: '15:00', color: '#1D4ED8' });
  await act(async () => sheet.props.onSave(event)); expect(updateEvent).toHaveBeenCalledWith('event', { title: '알바', time: '10:00', endTime: '15:00', color: '#1D4ED8' });
  await act(async () => sheet.props.onDelete('event')); expect(deleteNote).toHaveBeenCalledWith('event');
  await act(async () => sheet.props.onSaveMemo('new memo')); expect(saveMemo).toHaveBeenCalledWith({ profileId: 'me', date: '2026-09-25', existingId: 'memo', content: 'new memo' });
});
it('saves one-hour cell keys in the existing availability format before navigation', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 25, 10));
  fetchRoomAvailability.mockResolvedValue({ data: { members: [], mySlots: ['2026-09-25-12'], othersSlots: [] }, error: null });
  const root = await render(ScheduleTimeScreen); await press(root, '선택 완료'); expect(saveMyAvailability).toHaveBeenCalledWith('room', ['2026-09-25-12']); expect(navigation.navigate).toHaveBeenCalledWith('ScheduleConfirmed', expect.objectContaining({ roomId: 'room' })); expect(navigation.navigate.mock.calls.at(-1)[1]).not.toHaveProperty('origin');
});
it('creates a room and sends only selected invitations before moving to time selection', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 25, 10)); navigation.current.params.invitees = ['mate', 'mate2'];
  const root = await render(ScheduleDetailScreen); await press(root, '다음');
  expect(createRoom).toHaveBeenCalledWith({ ownerId: 'me', title: '오늘 저녁팟', meetingDate: '2026-10-02', expiresAt: new Date('2026-10-02T23:59:59').toISOString() });
  expect(createRoomInvitation.mock.calls).toEqual([['new-room', 'mate'], ['new-room', 'mate2']]); expect(navigation.navigate).toHaveBeenCalledWith('ScheduleTime', expect.objectContaining({ roomId: 'new-room', invitees: ['mate','mate2'] }));
});
it.each([
  ['missing-room-id', '밥약 정보가 없어요', '새 밥약 만들기'], ['room-missing', '밥약을 찾을 수 없어요', '홈으로 가기'], ['room-error', '밥약 정보를 불러오지 못했어요', '다시 시도'],
])('separates prerequisite failure %s and stops before invoking recommendations', async (kind, message, action) => {
  if (kind === 'missing-room-id') navigation.current.params.roomId = undefined;
  if (kind === 'missing-origin') navigation.current.params.origin = undefined;
  if (kind === 'room-missing') fetchRoom.mockResolvedValue({ data: null, error: null });
  if (kind === 'room-error') fetchRoom.mockResolvedValue({ data: null, error: new Error('offline') });
  if (kind === 'no-midpoint') buildPlaceCandidates.mockResolvedValue(null);
  if (kind === 'no-candidates') buildPlaceCandidates.mockResolvedValue({ candidates: [] });
  if (kind === 'candidate-error') buildPlaceCandidates.mockRejectedValue(new Error('offline'));
  const root = await render(ScheduleConfirmedScreen); expect(text(root)).toContain(message); expect(target(root, action)).toBeDefined(); expect(supabase.functions.invoke).not.toHaveBeenCalled();
  if (action !== '다시 시도') { expect(target(root, '다시 시도')).toBeUndefined(); await press(root, action); }
  if (kind === 'missing-room-id') { expect(navigation.navigate).toHaveBeenCalledWith('ScheduleDetail'); expect(navigation.resetTo).not.toHaveBeenCalled(); }
  if (kind === 'room-missing' || kind === 'room-error') expect(buildPlaceCandidates).not.toHaveBeenCalled();
});

it('renders the real navigator without tabs on all creation routes and with tabs on the calendar', async () => {
  // Other bundles are not rendered; keep their module side effects out of this route integration test.
  for (const module of ['../src/screens/LoginScreen', '../src/screens/signup/SignupCalendarScreen', '../src/screens/signup/SignupPersonalScreen', '../src/screens/signup/SignupStartScreen', '../src/screens/signup/SignupTasteScreen', '../src/screens/signup/SignupTermsScreen', '../src/screens/food/FoodProfileScreen', '../src/screens/profile/FriendsScreen', '../src/screens/profile/OriginScreen', '../src/screens/profile/PrivacyScreen', '../src/screens/profile/ProfileEditScreen', '../src/screens/profile/ProfileHomeScreen']) jest.doMock(module, () => () => null);
  jest.doMock('../src/screens/food/FoodProfilePrompt', () => () => null);
  const AppNavigator = require('../src/navigation/AppNavigator').default;
  const BottomNav = require('../src/components/BottomNav').default;
  for (const route of ['ScheduleDetail', 'ScheduleTime', 'ScheduleConfirmed']) {
    navigation.current.name = route; const root = await render(AppNavigator); expect(root.findAllByType(BottomNav)).toHaveLength(0);
    await act(async () => renderer.unmount()); renderer = undefined;
  }
  navigation.current.name = 'Schedule'; const root = await render(AppNavigator); expect(root.findAllByType(BottomNav)).toHaveLength(1);
});
it('shows time pending when confirmed_slot is absent instead of the generated meetingDate', async () => {
  useRoom.mockReturnValue({ room: { id: 'room', title: '밥약', participants: [], stage: 'place', isConfirmed: false, confirmedSlot: null, meetingDate: '2099-12-31', locationName: '서면역', expiresAt: '2099-12-31T00:00:00Z', color: '#FF9900' }, reload: jest.fn() });
  const root = await render(ChatRoomScreen); expect(text(root)).toContain('시간 미정'); expect(text(root)).toContain('서면역'); expect(text(root)).not.toContain('12월 31일');
});
it('passes owner deletion feedback only after the real leave API succeeds', async () => {
  useRoom.mockReturnValue({ room: { ownerId: 'me', title: '오늘 저녁팟', code: 'ABC123', meetingDate: '2026-09-25', locationName: null, participants: [], stage: 'place' }, reload: jest.fn() });
  const root = await render(RoomDetailScreen); await press(root, '방 없애기');
  leaveRoom.mockResolvedValueOnce(new Error('denied')); await press(root, '없애기'); expect(navigation.resetTo).not.toHaveBeenCalled();
  expect(text(root)).toContain('방을 없애지 못했어요. 잠시 후 다시 시도해 주세요.'); expect(text(root)).not.toContain('denied'); await press(root, '없애기'); expect(navigation.resetTo).toHaveBeenCalledWith('Home', { deletedRoomId: 'room', deletedRoomTitle: '오늘 저녁팟' });
});
it('shows and consumes the actual owner-deletion toast once, then dismisses it after 3 seconds', async () => {
  jest.useFakeTimers(); navigation.current = { name: 'Home', params: { deletedRoomId: 'room', deletedRoomTitle: '오늘 저녁팟', preserved: true } };
  const root = await render(HomeScreen); expect(text(root)).toContain('오늘 저녁팟을 없앴어요'); expect(navigation.replace).toHaveBeenCalledWith('Home', { preserved: true });
  await act(async () => renderer.update(React.createElement(HomeScreen))); expect(navigation.replace).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(3000)); expect(text(root)).not.toContain('없앴어요');
});
it('does not invent a deletion or mate-leave toast from an empty room list', async () => {
  navigation.current = { name: 'Home', params: {} }; const root = await render(HomeScreen); expect(text(root)).not.toContain('없앴어요'); expect(text(root)).not.toContain('나왔어요');
});

it.each(['confirmed', 'settling', 'done'])('uses neutral time wording for the %s chat stage without a saved slot', async stage => {
  useRoom.mockReturnValue({ room: { id: 'room', title: '밥약', participants: [], stage, confirmedSlot: null, meetingDate: '2099-12-31', locationName: '서면역', expiresAt: '2099-12-31T00:00:00Z' }, reload: jest.fn() });
  const root = await render(ChatRoomScreen); expect(text(root)).toContain('시간 미정'); expect(text(root)).toContain('서면역'); expect(text(root)).not.toContain('시간 확정 전'); expect(text(root)).not.toContain('12월 31일');
});
it.each([null, '9월 27일 (일) 12:30'])('shows only a stored confirmed slot on room detail: %s', async slot => {
  useRoom.mockReturnValue({ room: { ownerId: 'me', title: '밥약', participants: [], stage: 'confirmed', meetingDate: '2099-12-31', confirmedSlot: slot }, reload: jest.fn() });
  const root = await render(RoomDetailScreen); expect(text(root)).toContain(slot || '시간 미정'); expect(text(root)).not.toContain('2099');
});
it('returns when Android hardware back leaves new-meeting inputs', async () => {
  const previous = Platform.OS; Platform.OS = 'android'; let handler; const remove = jest.fn();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, callback) => { handler = callback; return { remove }; });
  try {
    await render(ScheduleDetailScreen); await act(async () => { expect(handler()).toBe(true); });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    await act(async () => renderer.unmount()); renderer = undefined; expect(remove).toHaveBeenCalled();
  } finally { Platform.OS = previous; }
});

it('creates a meeting without reading or requesting a private origin', async () => {
  navigation.current.params={name:'공용 지역 약속',invitees:[]};
  useMyProfile.mockReturnValue({bundle:null});
  const root=await render(ScheduleDetailScreen);
  expect(text(root)).toContain('공용 만남 지역');expect(target(root,'현재 위치로')).toBeUndefined();expect(target(root,'직접 검색')).toBeUndefined();
  await press(root,'다음');expect(createRoom).toHaveBeenCalled();expect(navigation.navigate).toHaveBeenCalledWith('ScheduleTime',expect.not.objectContaining({origin:expect.anything()}));
});

it('blocks time invocation on a legacy server before room/provider work', async () => {
  require('../src/lib/consents').getConsentServerMode.mockReturnValue('legacy');
  const root = await render(ScheduleConfirmedScreen); expect(text(root)).toContain('시간 추천은 곧 다시 이용할 수 있어요');
  expect(supabase.functions.invoke).not.toHaveBeenCalled(); expect(fetchRoom).not.toHaveBeenCalled();
  await press(root,'추천 없이 식당 정하기');expect(advanceRoomStage).toHaveBeenCalledWith('room','place');
  expect(navigation.navigate).toHaveBeenCalledWith('ChatRoom',expect.objectContaining({openSheet:'menu'}));
});
it('blocks time invocation on an S1-only server without S5 RPCs', async () => {
  require('../src/lib/foodProfile').fetchFoodCatalog.mockResolvedValueOnce({data:null,error:{code:'S5_UNAVAILABLE'}});
  const root = await render(ScheduleConfirmedScreen);
  expect(text(root)).toContain('시간 추천은 곧 다시 이용할 수 있어요');
  expect(fetchRoom).not.toHaveBeenCalled(); expect(supabase.functions.invoke).not.toHaveBeenCalled();
  await press(root,'추천 없이 식당 정하기');expect(advanceRoomStage).toHaveBeenCalled();
});
it('preserves stage permission failures when continuing without recommendation',async()=>{
 require('../src/lib/consents').getConsentServerMode.mockReturnValue('legacy');advanceRoomStage.mockResolvedValueOnce({error:{message:'private denial'}});
 const root=await render(ScheduleConfirmedScreen);await press(root,'추천 없이 식당 정하기');expect(navigation.navigate).not.toHaveBeenCalled();
});
it('does not mistake an S5 capability network failure for a legacy server', async () => {
  require('../src/lib/foodProfile').fetchFoodCatalog.mockResolvedValueOnce({data:null,error:{code:'NETWORK'}});
  const root = await render(ScheduleConfirmedScreen);
  expect(text(root)).toContain('시간 추천 지원 여부를 확인하지 못했어요');
  expect(target(root,'다시 시도')).toBeDefined(); expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
it('distinguishes HTTP 400 Edge contract mismatch from ordinary recommendation failure', async () => {
  supabase.functions.invoke.mockResolvedValueOnce({data:null,error:{context:{status:400},message:'private server raw'}});
  const root = await render(ScheduleConfirmedScreen); expect(text(root)).toContain('현재 서버와 앱의 시간 추천 방식이 달라요'); expect(text(root)).not.toContain('private server raw'); expect(target(root,'다시 시도')).toBeUndefined();
});
