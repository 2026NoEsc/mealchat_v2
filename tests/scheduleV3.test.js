const React = require('react');
const { act, create } = require('react-test-renderer');
const { AppState, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } = require('react-native');

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaProvider: ({ children }) => children }));
jest.mock('expo-linking', () => ({ getInitialURL: jest.fn().mockResolvedValue(null), addEventListener: jest.fn(() => ({ remove: jest.fn() })), createURL: path => path }));
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'me', created_at: '2026-08-01T00:00:00+09:00' } }) }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: jest.fn() }));
jest.mock('../src/components/NotificationsProvider', () => ({ useNotifications: () => ({ hasUnread: false, open: jest.fn() }) }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/lib/calendarNotes', () => ({ createEvent: jest.fn(), updateEvent: jest.fn(), deleteNote: jest.fn(), saveMemo: jest.fn() }));
jest.mock('../src/schedule/useMonthNotes', () => ({ ...jest.requireActual('../src/schedule/useMonthNotes'), useMonthNotes: jest.fn() }));
jest.mock('../src/lib/friends', () => ({ fetchMyFriends: jest.fn() }));
jest.mock('../src/lib/myLocation', () => ({ locateMe: jest.fn(), LocationDeniedError: class LocationDeniedError extends Error {} }));
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
jest.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

const TimeCell = require('../src/components/ui/TimeCell').default;
const MateToggle = require('../src/components/ui/MateToggle').default;
const ColorDot = require('../src/components/ui/ColorDot').default;
const PersonalEventSheet = require('../src/screens/schedule/PersonalEventSheet').default;
const ScheduleHomeScreen = require('../src/screens/schedule/ScheduleHomeScreen').default;
const ScheduleDetailScreen = require('../src/screens/schedule/ScheduleDetailScreen').default;
const ScheduleOriginSearchScreen = require('../src/screens/schedule/ScheduleOriginSearchScreen').default;
const ScheduleTimeScreen = require('../src/screens/schedule/ScheduleTimeScreen').default;
const ScheduleConfirmedScreen = require('../src/screens/schedule/ScheduleConfirmedScreen').default;
const AvailabilityGrid = require('../src/components/AvailabilityGrid').default;
const { useNavigation } = require('../src/navigation/NavigationContext');
const { useMonthNotes } = require('../src/schedule/useMonthNotes');
const { fetchMyFriends } = require('../src/lib/friends');
const { locateMe, LocationDeniedError } = require('../src/lib/myLocation');
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
const Location = require('expo-location');
const { useMyProfile } = require('../src/profile/useMyProfile');
const { createEvent, updateEvent, deleteNote, saveMemo } = require('../src/lib/calendarNotes');
const { fetchRoomAvailability, saveMyAvailability } = require('../src/lib/availability');
const { saveSettingsDraft, takeSettingsDraft } = require('../src/lib/scheduleDraft');
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
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  navigation = { current: { name: 'Schedule', params: { roomId: 'room', name: '오늘 저녁팟', invitees: [], origin } }, navigate: jest.fn(), resetTo: jest.fn(), replace: jest.fn(), goBack: jest.fn(), goBackWith: jest.fn() };
  useNavigation.mockReturnValue(navigation);
  useRoom.mockReturnValue({ room: null, reload: jest.fn() }); useRoomMessages.mockReturnValue({ messages: [], status: 'ready', reload: jest.fn() }); leaveRoom.mockResolvedValue(null);
  useMyProfile.mockReturnValue({ bundle: null });
  Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
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
  jest.useFakeTimers().setSystemTime(new Date('2026-09-25T12:00:00+09:00'));
  const root = await render(ScheduleHomeScreen);
  await press(root, '이전 달'); expect(text(root)).toContain('2026 년 8 월');
  expect(target(root, '이전 달').props.disabled).toBe(true);
  await press(root, '이전 달'); expect(text(root)).toContain('2026 년 8 월');
  await press(root, '다음 달'); expect(target(root, '이전 달').props.disabled).toBe(false);
  expect(canMoveCalendarMonth({ year: 2027, month: 1 }, -1, { year: 2026, month: 8 })).toBe(true);
  expect(earliestCalendarMonth(undefined, new Date(2026, 8, 25))).toEqual({ year: 2026, month: 9 });
});
it('shows at most 3 event dots from real notes and exposes 48px date targets', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-25T12:00:00+09:00'));
  useMonthNotes.mockReturnValue({ notes: Array.from({ length: 4 }, (_, index) => ({ id: 'note' + index, date: '2026-09-25', title: '일정', time: '10:00', endTime: '11:00', color: '#1D4ED8' })), status: 'ready', reload: jest.fn() });
  const root = await render(ScheduleHomeScreen); const day = target(root, '9월 25일, 일정 4개');
  expect(StyleSheet.flatten(day.props.style).height).toBe(48);
  const dots = day.findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.width === 4 && StyleSheet.flatten(node.props.style)?.height === 4);
  expect(dots).toHaveLength(3);
});
it('opens settings on actual location denial and keeps direct search available with the draft', async () => {
  locateMe.mockRejectedValueOnce(new LocationDeniedError('거부됨'));
  const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const root = await render(ScheduleDetailScreen); await press(root, '현재 위치로');
  expect(text(root)).toContain('위치 권한이 꺼져 있어요');
  await press(root, '설정 열기'); expect(settings).toHaveBeenCalledTimes(1);
  await press(root, '직접 검색'); expect(navigation.navigate).toHaveBeenCalledWith('ScheduleOriginSearch', expect.objectContaining({ name: '오늘 저녁팟', origin }));
  locateMe.mockResolvedValueOnce({ ...origin, fromGps: true }); await press(root, '현재 위치로'); expect(text(root)).not.toContain('위치 권한이 꺼져 있어요');
});
it('does not show the permission card for an ordinary location failure', async () => {
  locateMe.mockRejectedValueOnce(new Error('GPS failure')); const root = await render(ScheduleDetailScreen); await press(root, '현재 위치로');
  expect(target(root, '설정 열기')).toBeUndefined(); expect(text(root)).toContain('현재 위치를 잡지 못했어요');
});
it('returns search coordinates to the current meeting without a profile save', async () => {
  const place = { id: 'station', name: '서면역 1호선', address: '부산 부산진구', lat: 35.15, lng: 129.05 };
  searchPlaces.mockResolvedValueOnce([place]); const root = await render(ScheduleOriginSearchScreen);
  await act(async () => field(root, '출발지 검색').props.onChangeText('서면역')); await press(root, '검색'); await press(root, place.name + ', ' + place.address); await press(root, '이 위치로 정하기');
  expect(navigation.goBackWith).toHaveBeenCalledWith({ origin: { name: place.name, address: place.address, lat: place.lat, lng: place.lng, fromGps: false }, originSource: 'search' });
});
it('keeps other mates available cells selectable and disables past cells in v3', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00+09:00'));
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
  await press(root, '날짜 직접 고르기'); expect(navigation.goBackWith).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'room', origin }));
  await press(root, '다시 시도'); expect(supabase.functions.invoke).toHaveBeenCalledTimes(2); expect(target(root, '식당 정하러 가기').props.disabled).toBe(false);
});
it('treats an empty recommendation response as a retryable failure', async () => {
  supabase.functions.invoke.mockResolvedValueOnce({ data: { slotRecommendations: [] }, error: null }); const root = await render(ScheduleConfirmedScreen); expect(target(root, '다시 시도')).toBeDefined(); expect(target(root, '식당 정하러 가기').props.disabled).toBe(true);
});
it('hides bottom tabs throughout new meeting creation and origin search', () => {
  for (const route of ['ScheduleDetail', 'ScheduleTime', 'ScheduleConfirmed', 'ScheduleOriginSearch']) expect(ROUTE_TO_TAB[route]).toBeUndefined(); expect(ROUTE_TO_TAB.Schedule).toBe('schedule');
});

it('refreshes location after returning from settings with permission granted', async () => {
  let activate;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => { activate = handler; return { remove: jest.fn() }; });
  const Location = require('expo-location');
  Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  locateMe.mockRejectedValueOnce(new LocationDeniedError('거부됨')).mockResolvedValueOnce({ ...origin, fromGps: true });
  const root = await render(ScheduleDetailScreen);
  await press(root, '현재 위치로'); expect(text(root)).toContain('위치 권한이 꺼져 있어요');
  await act(async () => activate('active'));
  expect(locateMe).toHaveBeenCalledTimes(2); expect(text(root)).not.toContain('위치 권한이 꺼져 있어요');
});
it('shows a settings-opening error while leaving manual origin search available', async () => {
  locateMe.mockRejectedValueOnce(new LocationDeniedError('거부됨'));
  jest.spyOn(Linking, 'openSettings').mockRejectedValue(new Error('settings unavailable'));
  const root = await render(ScheduleDetailScreen); await press(root, '현재 위치로'); await press(root, '설정 열기');
  expect(text(root)).toContain('설정을 열지 못했어요'); expect(target(root, '직접 검색')).toBeDefined();
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
it('labels an automatically filled location as the profile departure', async () => {
  navigation.current.params = { name: '점심', invitees: [] };
  useMyProfile.mockReturnValue({ bundle: { privateProfile: { startLat: 0, startLng: 129, startLocationName: '프로필 위치' } } });
  const root = await render(ScheduleDetailScreen); expect(text(root)).toContain('프로필 출발지'); expect(text(root)).not.toContain('직접 고른 위치');
});
it('requests permission again when allowed instead of directing the user to settings', async () => {
  Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });
  locateMe.mockRejectedValueOnce(new LocationDeniedError('denied')).mockResolvedValueOnce({ ...origin, fromGps: true });
  const root = await render(ScheduleDetailScreen); await press(root, '현재 위치로');
  expect(target(root, '설정 열기')).toBeUndefined(); expect(text(root)).not.toContain('설정에서 위치 권한을 켜');
  await press(root, '권한 다시 요청'); expect(locateMe).toHaveBeenCalledTimes(2); expect(text(root)).not.toContain('위치 권한이 꺼져 있어요');
});
it('saves a scoped draft before opening settings and restores it after remount', async () => {
  locateMe.mockRejectedValueOnce(new LocationDeniedError('denied')); jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  let root = await render(ScheduleDetailScreen); await act(async () => field(root, '약속 이름').props.onChangeText('보존할 밥약')); await press(root, '모아'); await press(root, '현재 위치로'); await press(root, '설정 열기');
  const [key, saved] = AsyncStorage.setItem.mock.calls[0]; expect(key).toContain('/me');
  expect(JSON.parse(saved).draft).toMatchObject({ name: '보존할 밥약', invitees: ['mate'], origin });
  expect(AsyncStorage.setItem.mock.invocationCallOrder[0]).toBeLessThan(Linking.openSettings.mock.invocationCallOrder[0]);
  await act(async () => renderer.unmount()); renderer = undefined; navigation.current.params = {};
  AsyncStorage.getItem.mockResolvedValueOnce(saved); root = await render(ScheduleDetailScreen);
  expect(field(root, '약속 이름').props.value).toBe('보존할 밥약'); expect(target(root, '모아').props.accessibilityState.checked).toBe(true); expect(text(root)).toContain('서면역'); expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
});
it('does not restore expired or corrupt settings drafts', async () => {
  AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ expiresAt: Date.now() - 1, draft: { name: 'old' } })); expect(await takeSettingsDraft('me')).toBeNull();
  AsyncStorage.getItem.mockResolvedValueOnce('not json'); expect(await takeSettingsDraft('me')).toBeNull();
});
it('exposes both mine and mate availability with a visible non-color marker and today text', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00+09:00'));
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
  jest.useFakeTimers().setSystemTime(new Date('2026-09-25T12:00:00+09:00'));
  useMonthNotes.mockReturnValue({ notes: [{ id: 'event', date: '2026-09-25', title: '알바', time: '10:00', endTime: '15:00', color: '#1D4ED8' }, { id: 'memo', date: '2026-09-25', title: '', time: null, content: 'old' }], status: 'ready', reload: jest.fn() });
  const root = await render(ScheduleHomeScreen); const sheet = root.findByType(PersonalEventSheet);
  await act(async () => sheet.props.onSave({ ...event, id: 'new' })); expect(createEvent).toHaveBeenCalledWith({ profileId: 'me', date: '2026-09-25', title: '알바', time: '10:00', endTime: '15:00', color: '#1D4ED8' });
  await act(async () => sheet.props.onSave(event)); expect(updateEvent).toHaveBeenCalledWith('event', { title: '알바', time: '10:00', endTime: '15:00', color: '#1D4ED8' });
  await act(async () => sheet.props.onDelete('event')); expect(deleteNote).toHaveBeenCalledWith('event');
  await act(async () => sheet.props.onSaveMemo('new memo')); expect(saveMemo).toHaveBeenCalledWith({ profileId: 'me', date: '2026-09-25', existingId: 'memo', content: 'new memo' });
});
it('saves one-hour cell keys in the existing availability format before navigation', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00+09:00'));
  fetchRoomAvailability.mockResolvedValue({ data: { members: [], mySlots: ['2026-09-25-12'], othersSlots: [] }, error: null });
  const root = await render(ScheduleTimeScreen); await press(root, '선택 완료'); expect(saveMyAvailability).toHaveBeenCalledWith('room', ['2026-09-25-12']); expect(navigation.navigate).toHaveBeenCalledWith('ScheduleConfirmed', expect.objectContaining({ roomId: 'room', origin }));
});
it('creates a room and sends only selected invitations before moving to time selection', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00+09:00')); navigation.current.params.invitees = ['mate', 'mate2'];
  const root = await render(ScheduleDetailScreen); await press(root, '다음');
  expect(createRoom).toHaveBeenCalledWith({ ownerId: 'me', title: '오늘 저녁팟', meetingDate: '2026-10-02', expiresAt: new Date('2026-10-02T23:59:59').toISOString() });
  expect(createRoomInvitation.mock.calls).toEqual([['new-room', 'mate'], ['new-room', 'mate2']]); expect(navigation.navigate).toHaveBeenCalledWith('ScheduleTime', expect.objectContaining({ roomId: 'new-room', invitees: ['mate','mate2'], origin }));
});
it.each([
  ['missing-room-id', '밥약 정보가 없어요', '새 밥약 만들기'], ['missing-origin', '출발지를 골라 주세요', '다른 출발지 고르기'], ['room-missing', '밥약을 찾을 수 없어요', '홈으로 가기'], ['room-error', '밥약 정보를 불러오지 못했어요', '다시 시도'], ['no-midpoint', '중간 지점을 계산하지 못했어요', '다른 출발지 고르기'], ['no-candidates', '근처에서 식당 후보를 찾지 못했어요', '다른 출발지 고르기'], ['candidate-error', '식당 후보를 불러오지 못했어요', '다시 시도'],
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
  if (kind === 'no-midpoint') expect(navigation.navigate).toHaveBeenCalledWith('ScheduleOriginSearch', expect.objectContaining({ origin }));
  if (kind === 'missing-room-id') { expect(navigation.navigate).toHaveBeenCalledWith('ScheduleDetail'); expect(navigation.resetTo).not.toHaveBeenCalled(); }
  if (kind === 'room-missing' || kind === 'room-error') expect(buildPlaceCandidates).not.toHaveBeenCalled();
});

it('renders the real navigator without tabs on all creation routes and with tabs on the calendar', async () => {
  // Other bundles are not rendered; keep their module side effects out of this route integration test.
  for (const module of ['../src/screens/LoginScreen', '../src/screens/signup/SignupCalendarScreen', '../src/screens/signup/SignupPersonalScreen', '../src/screens/signup/SignupStartScreen', '../src/screens/signup/SignupTasteScreen', '../src/screens/signup/SignupTermsScreen', '../src/screens/taste/TasteGameScreen', '../src/screens/profile/FriendsScreen', '../src/screens/profile/OriginScreen', '../src/screens/profile/PrivacyScreen', '../src/screens/profile/ProfileEditScreen', '../src/screens/profile/ProfileHomeScreen']) jest.doMock(module, () => () => null);
  const AppNavigator = require('../src/navigation/AppNavigator').default;
  const BottomNav = require('../src/components/BottomNav').default;
  for (const route of ['ScheduleDetail', 'ScheduleTime', 'ScheduleConfirmed', 'ScheduleOriginSearch']) {
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
it('clears the settings draft when Android hardware back leaves new-meeting inputs', async () => {
  const previous = Platform.OS; Platform.OS = 'android'; let handler; const remove = jest.fn();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, callback) => { handler = callback; return { remove }; });
  try {
    await render(ScheduleDetailScreen); await act(async () => { expect(handler()).toBe(true); });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@mealchat/schedule-settings-draft/v1/me'); expect(navigation.goBack).toHaveBeenCalledTimes(1);
    await act(async () => renderer.unmount()); renderer = undefined; expect(remove).toHaveBeenCalled();
  } finally { Platform.OS = previous; }
});

it.each([false, true])('clears only the signed-out account draft on successful logout; API error=%s', async fail => {
  const { AuthProvider, useAuth: useRealAuth } = jest.requireActual('../src/auth/AuthProvider');
  const oldAuth = supabase.auth; let authContext;
  supabase.auth = { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'logout-user' } } } }), onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })), signOut: jest.fn().mockResolvedValue({ error: fail ? Error('denied') : null }) };
  function AuthProbe() { authContext = useRealAuth(); return null; }
  try {
    await render(AuthProvider, { children: React.createElement(AuthProbe) }); expect(authContext.user.id).toBe('logout-user'); AsyncStorage.removeItem.mockClear();
    await act(async () => authContext.signOut());
    if (fail) expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('@mealchat/schedule-settings-draft/v1/logout-user');
    else expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@mealchat/schedule-settings-draft/v1/logout-user');
  } finally { supabase.auth = oldAuth; }
});

it.each(['restored', 'event', 'switched', 'cleanup-fails'])('clears the previous account draft on an external SIGNED_OUT event: %s', async mode => {
  const { AuthProvider, useAuth: useRealAuth } = jest.requireActual('../src/auth/AuthProvider');
  const oldAuth = supabase.auth;
  let authContext, authChanged;
  const unsubscribe = jest.fn();
  supabase.auth = {
    getSession: jest.fn().mockResolvedValue({ data: { session: mode === 'event' ? null : { user: { id: 'account-a' } } } }),
    onAuthStateChange: jest.fn(callback => { authChanged = callback; return { data: { subscription: { unsubscribe } } }; }),
    signOut: jest.fn(),
  };
  function AuthProbe() { authContext = useRealAuth(); return null; }
  try {
    await render(AuthProvider, { children: React.createElement(AuthProbe) });
    AsyncStorage.removeItem.mockClear();
    if (mode === 'cleanup-fails') AsyncStorage.removeItem.mockRejectedValueOnce(Error('local storage unavailable'));
    await act(async () => {
      if (mode === 'event') authChanged('SIGNED_IN', { user: { id: 'account-a' } });
      if (mode === 'switched') authChanged('SIGNED_IN', { user: { id: 'account-b' } });
      authChanged('SIGNED_OUT', null);
    });
    const expectedUser = mode === 'switched' ? 'account-b' : 'account-a';
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@mealchat/schedule-settings-draft/v1/' + expectedUser);
    if (mode === 'switched') expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('@mealchat/schedule-settings-draft/v1/account-a');
    expect(authContext.user).toBeNull();
    expect(authContext.passwordResetPending).toBe(false);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    await act(async () => renderer.unmount()); renderer = undefined;
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  } finally { supabase.auth = oldAuth; }
});
