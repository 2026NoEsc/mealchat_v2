const React = require('react');
const { act, create } = require('react-test-renderer');
const { AccessibilityInfo, Platform, Text, StyleSheet } = require('react-native');
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/lib/availability', () => ({ fetchRoomAvailability: jest.fn(), saveMyAvailability: jest.fn() }));
jest.mock('../src/lib/rooms', () => ({ fetchRoom: jest.fn(), advanceRoomStage: jest.fn() }));
const ScheduleSheet = require('../src/screens/chat/ScheduleSheet').default;
const AvailabilityGrid = require('../src/components/AvailabilityGrid').default;
const Avatar = require('../src/components/Avatar').default;
const TimeCell = require('../src/components/ui/TimeCell').default;
const { PrimaryButton, SecondaryButton } = require('../src/components/ui/Button');
const { meetingTimeLabel } = require('../src/components/ui/MeetingCard');
const { useAuth } = require('../src/auth/AuthProvider');
const { fetchRoomAvailability, saveMyAvailability } = require('../src/lib/availability');
const { fetchRoom, advanceRoomStage } = require('../src/lib/rooms');
let renderer, props, availability, room;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 16, 9));
  useAuth.mockReturnValue({ user: { id: 'profile-me' } });
  availability = { members: [{ id: 'participant-me', name: '밀챗', avatarColor: '', submitted: true }, { id: 'participant-mate', name: '모아', avatarColor: '', submitted: false }], mySlots: ['2026-10-16-18'], othersSlots: ['2026-10-16-19'] };
  room = { id: 'room-a', stage: 'scheduling', confirmedSlot: null, isConfirmed: true, meetingDate: '2099-12-31', participants: [{ id: 'participant-me', profileId: 'profile-me', name: '밀챗' }, { id: 'participant-mate', profileId: 'profile-mate', name: '모아' }] };
  fetchRoomAvailability.mockImplementation(async () => ({ data: availability, error: null }));
  fetchRoom.mockImplementation(async () => ({ data: room, error: null }));
  saveMyAvailability.mockResolvedValue(null);
  advanceRoomStage.mockResolvedValue({ error: null });
  props = { visible: true, roomId: 'room-a', isOwner: true, onClose: jest.fn(), onStateChanged: jest.fn() };
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; jest.restoreAllMocks(); jest.useRealTimers(); });
async function render(overrides = {}) { props = { ...props, ...overrides }; await act(async () => { renderer = create(React.createElement(ScheduleSheet, props)); }); return renderer.root; }
const text = root => root.findAllByType(Text).map(node => Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children).join(' ');
const target = (root, label) => root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.style === 'function')[0];
async function press(root, label) { await act(async () => target(root, label).props.onPress()); }
const host = (root, id) => root.findAll(node => typeof node.type === 'string' && node.props.testID === id);

it('renders a confirmed card only for a stored confirmedSlot, with the supplied v3 geometry', async () => {
  room.confirmedSlot = '10월 16일 (금) 18:00~20:00';
  const root = await render();
  const card = host(root, 'schedule-confirmed')[0];
  expect(StyleSheet.flatten(card.props.style)).toMatchObject({ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#E8F5EC' });
  expect(text(root)).toContain(room.confirmedSlot);
  expect(text(root)).not.toContain('2099');
  expect(fetchRoom).toHaveBeenCalledWith('room-a');
});
it.each(['scheduling', 'place', 'confirmed', 'settling', 'done'])('uses a neutral %s notice without inventing a time', async stage => {
  room.stage = stage; room.confirmedSlot = '  ';
  const root = await render();
  expect(host(root, 'schedule-confirmed')).toHaveLength(0);
  expect(text(root)).toContain(stage === 'scheduling' ? '모두 가능한 시간을 제출하면 방장이 식당 정하기로 넘어갈 수 있어요.' : '시간 미정');
  expect(text(root)).not.toContain('2099');
});
it('uses submitted flags and participant-to-profile IDs for badges, counts, and the mine label', async () => {
  const root = await render();
  expect(text(root)).toContain('2명 중 1명');
  expect(host(root, 'schedule-submission-participant-me')[0].props.accessibilityLabel).toBe('밀챗 (나), 제출');
  expect(host(root, 'schedule-submission-participant-mate')[0].props.accessibilityLabel).toBe('모아, 아직');
  const avatars = root.findAllByType(Avatar);
  expect(avatars[0].props).toMatchObject({ seed: 'profile-me', size: 32, radius: 16 });
  expect(StyleSheet.flatten(host(root, 'schedule-submission-participant-me')[0].props.style).minHeight).toBe(44);
});
it('keeps the existing in-sheet edit flow and switches its timetable to B v3 cells', async () => {
  const root = await render();
  expect(root.findAllByType(AvailabilityGrid)).toHaveLength(0);
  await press(root, '일정 수정');
  expect(root.findByType(AvailabilityGrid).props.variant).toBe('v3');
  expect(root.findByType(AvailabilityGrid).props.others).toEqual(new Set(availability.othersSlots));
  const cells = root.findAllByType(TimeCell);
  expect(cells).toHaveLength(50);
  expect(cells.find(cell => cell.props.label.includes('10월 16일 18시 ~ 19시')).props.state).toBe('mine');
  expect(cells.find(cell => cell.props.label.includes('10월 16일 19시 ~ 20시')).props.state).toBe('shared');
  expect(text(root)).toContain('언제 만날까요?');
});
it('saves the existing availability keys, refreshes the status, and never advances automatically', async () => {
  const root = await render(); await press(root, '일정 수정');
  await act(async () => root.findAllByType(TimeCell).find(cell => cell.props.label.includes('10월 16일 19시 ~ 20시')).props.onPress());
  availability = { ...availability, mySlots: ['2026-10-16-18', '2026-10-16-19'] };
  await press(root, '선택 완료');
  expect(saveMyAvailability).toHaveBeenCalledWith('room-a', ['2026-10-16-18', '2026-10-16-19']);
  expect(props.onStateChanged).toHaveBeenCalledTimes(1);
  expect(fetchRoomAvailability).toHaveBeenCalledTimes(2);
  expect(fetchRoom).toHaveBeenCalledTimes(2);
  expect(fetchRoom.mock.invocationCallOrder[1]).toBeLessThan(saveMyAvailability.mock.invocationCallOrder[0]);
  expect(advanceRoomStage).not.toHaveBeenCalled();
  expect(root.findAllByType(AvailabilityGrid)).toHaveLength(0);
});
it('opens the grid for an unsubmitted user and blocks an empty selection', async () => {
  availability.mySlots = []; availability.members[0].submitted = false;
  const root = await render();
  expect(root.findAllByType(AvailabilityGrid)).toHaveLength(1);
  expect(root.findByType(PrimaryButton).props.disabled).toBe(true);
  await press(root, '선택 완료');
  expect(saveMyAvailability).not.toHaveBeenCalled();
});
it.each([false, true])('shows only safe Korean save errors and preserves the selection; thrown=%s', async thrown => {
  const root = await render(); await press(root, '일정 수정');
  if (thrown) saveMyAvailability.mockRejectedValueOnce(Error('provider-private-fixture'));
  else saveMyAvailability.mockResolvedValueOnce(Error('provider-private-fixture'));
  await press(root, '선택 완료');
  expect(text(root)).toContain('일정을 저장하지 못했어요.');
  expect(text(root)).not.toContain('provider-private-fixture');
  expect(root.findByType(AvailabilityGrid).props.picked).toEqual(new Set(['2026-10-16-18']));
  expect(props.onStateChanged).not.toHaveBeenCalled();
});
it('keeps owner and all-submitted restrictions, even when a disabled handler is invoked directly', async () => {
  const root = await render();
  expect(target(root, '식당 정하러 가기').props.disabled).toBe(true);
  await press(root, '식당 정하러 가기');
  expect(advanceRoomStage).not.toHaveBeenCalled();
  expect(root.findAllByType(SecondaryButton)).toHaveLength(1);
});
it('does not offer the owner action to a mate after everyone submits', async () => {
  availability.members[1].submitted = true;
  const root = await render({ isOwner: false });
  expect(target(root, '식당 정하러 가기')).toBeUndefined();
  expect(text(root)).toContain('방장이 마치면 식당 정하기로 넘어가요.');
  await press(root, '일정 수정');
  expect(root.findAllByType(AvailabilityGrid)).toHaveLength(1);
  expect(advanceRoomStage).not.toHaveBeenCalled();
});
it('uses the existing owner place transition once, then refreshes the parent and closes', async () => {
  availability.members[1].submitted = true;
  let finish; advanceRoomStage.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const root = await render();
  await act(async () => { target(root, '식당 정하러 가기').props.onPress(); target(root, '식당 정하러 가기').props.onPress(); });
  expect(advanceRoomStage).toHaveBeenCalledTimes(1);
  expect(advanceRoomStage).toHaveBeenCalledWith('room-a', 'place');
  expect(root.findByType(SecondaryButton).props.disabled).toBe(true);
  await act(async () => finish({ error: null }));
  expect(props.onStateChanged).toHaveBeenCalledTimes(1); expect(props.onClose).toHaveBeenCalledTimes(1);
  expect(saveMyAvailability).not.toHaveBeenCalled();
});
it.each([false, true])('keeps the sheet open with a safe transition error; thrown=%s', async thrown => {
  availability.members[1].submitted = true;
  if (thrown) advanceRoomStage.mockRejectedValueOnce(Error('provider-private-fixture'));
  else advanceRoomStage.mockResolvedValueOnce({ error: Error('provider-private-fixture') });
  const root = await render(); await press(root, '식당 정하러 가기');
  expect(text(root)).toContain('식당 정하기로 넘어가지 못했어요.');
  expect(text(root)).not.toContain('provider-private-fixture');
  expect(props.onClose).not.toHaveBeenCalled(); expect(props.onStateChanged).not.toHaveBeenCalled();
});
it.each([false, true])('does not fabricate submission states after an availability load failure; thrown=%s', async thrown => {
  if (thrown) fetchRoomAvailability.mockRejectedValueOnce(Error('provider-private-fixture'));
  else fetchRoomAvailability.mockResolvedValueOnce({ data: null, error: Error('provider-private-fixture') });
  const root = await render();
  expect(text(root)).toContain('일정 제출 현황을 불러오지 못했어요.');
  expect(text(root)).not.toContain('provider-private-fixture'); expect(text(root)).not.toContain('0명 중 0명');
  expect(host(root, 'schedule-submissions')).toHaveLength(0);
  await press(root, '다시 불러오기');
  expect(host(root, 'schedule-submissions')).toHaveLength(1);
});
it('does not infer mine by matching a name or claim a time when the room read fails', async () => {
  fetchRoom.mockRejectedValueOnce(Error('provider-private-fixture'));
  const root = await render();
  expect(text(root)).toContain('방 정보를 불러오지 못해 지금은 일정을 낼 수 없어요. 다시 불러와 주세요.');
  expect(target(root, '일정 수정')).toBeUndefined();
  expect(target(root, '식당 정하러 가기')).toBeUndefined();
  expect(text(root)).not.toContain('provider-private-fixture'); expect(text(root)).not.toContain('(나)');
  expect(host(root, 'schedule-confirmed')).toHaveLength(0);
});
it('does not read APIs while hidden and lets X and the scrim return to chat', async () => {
  const root = await render({ visible: false });
  expect(fetchRoomAvailability).not.toHaveBeenCalled(); expect(fetchRoom).not.toHaveBeenCalled();
  await act(async () => renderer.update(React.createElement(ScheduleSheet, { ...props, visible: true })));
  await press(root, '닫기');
  const scrim = root.findAll(node => node.props.testID === 'auth-sheet-scrim' && node.props.onPress)[0];
  await act(async () => scrim.props.onPress());
  expect(props.onClose).toHaveBeenCalledTimes(2);
});
it('ignores an old room response after the room changes', async () => {
  let finish; fetchRoomAvailability.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const root = await render();
  availability = { ...availability, members: [{ id: 'participant-b', name: '다른 방', submitted: true }] };
  await act(async () => renderer.update(React.createElement(ScheduleSheet, { ...props, roomId: 'room-b' })));
  await act(async () => finish({ data: { ...availability, members: [{ id: 'old', name: '이전 방', submitted: true }] }, error: null }));
  expect(text(root)).toContain('다른 방'); expect(text(root)).not.toContain('이전 방');
});

it('saves once on repeated presses and does not refresh a different room when the old save finishes', async () => {
  let finish; saveMyAvailability.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const root = await render(); await press(root, '일정 수정');
  await act(async () => { target(root, '선택 완료').props.onPress(); target(root, '선택 완료').props.onPress(); });
  expect(saveMyAvailability).toHaveBeenCalledTimes(1);
  await act(async () => renderer.update(React.createElement(ScheduleSheet, { ...props, roomId: 'room-b' })));
  expect(target(root, '일정 수정').props.disabled).toBe(false);
  await act(async () => finish(null));
  expect(props.onStateChanged).not.toHaveBeenCalled();
  expect(fetchRoomAvailability).toHaveBeenCalledTimes(2);
  expect(target(root, '일정 수정').props.disabled).toBe(false);
});

it.each(['save', 'advance'])('refreshes the parent after a successful %s response even when the sheet has closed', async operation => {
  availability.members[1].submitted = true;
  let finish;
  if (operation === 'save') saveMyAvailability.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  else advanceRoomStage.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const root = await render();
  if (operation === 'save') await press(root, '일정 수정');
  await press(root, operation === 'save' ? '선택 완료' : '식당 정하러 가기');
  await press(root, '닫기');
  const latestRefresh = jest.fn();
  await act(async () => renderer.update(React.createElement(ScheduleSheet, { ...props, visible: false, onStateChanged: latestRefresh })));
  await act(async () => finish(operation === 'save' ? null : { error: null }));
  expect(latestRefresh).toHaveBeenCalledTimes(1);
  expect(props.onStateChanged).not.toHaveBeenCalled();
  expect(props.onClose).toHaveBeenCalledTimes(1);
  expect(fetchRoomAvailability).toHaveBeenCalledTimes(1);
  expect(fetchRoom).toHaveBeenCalledTimes(operation === 'save' ? 2 : 1);
});

it('does not notify the new room when the previous room stage transition completes', async () => {
  availability.members[1].submitted = true;
  let finish; advanceRoomStage.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const root = await render(); await press(root, '식당 정하러 가기');
  await act(async () => renderer.update(React.createElement(ScheduleSheet, { ...props, roomId: 'room-b' })));
  await act(async () => finish({ error: null }));
  expect(props.onStateChanged).not.toHaveBeenCalled(); expect(props.onClose).not.toHaveBeenCalled();
});

it('retries only room metadata and preserves picked cells and editing state', async () => {
  fetchRoom.mockRejectedValueOnce(Error('offline fixture'));
  const root = await render();
  // Retain this room-only retry handler so we can exercise the read path after editing begins.
  const reloadRoom = target(root, '방 정보 다시 불러오기').props.onPress;
  await act(async () => reloadRoom());
  await press(root, '일정 수정');
  await act(async () => root.findAllByType(TimeCell).find(cell => cell.props.label.includes('10월 16일 19시 ~ 20시')).props.onPress());
  const expected = new Set(['2026-10-16-18', '2026-10-16-19']);
  let finish; fetchRoom.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await act(async () => reloadRoom());
  expect(root.findByType(AvailabilityGrid).props.picked).toEqual(expected);
  await act(async () => finish({ data: { ...room, confirmedSlot: '2026-10-16T18:00:00+09:00' }, error: null }));
  expect(root.findByType(AvailabilityGrid).props.picked).toEqual(expected);
  expect(target(root, '선택 완료')).toBeDefined();
  expect(fetchRoomAvailability).toHaveBeenCalledTimes(1);
  expect(fetchRoom).toHaveBeenCalledTimes(3);
});

it.each(['place', 'confirmed', 'settling', 'done'])('hides schedule actions and the grid after scheduling, stage=%s', async stage => {
  room.stage = stage; availability.mySlots = [];
  const root = await render();
  expect(target(root, '일정 수정')).toBeUndefined();
  expect(target(root, '식당 정하러 가기')).toBeUndefined();
  expect(target(root, '선택 완료')).toBeUndefined();
  expect(root.findAllByType(AvailabilityGrid)).toHaveLength(0);
  expect(text(root)).toContain({ place: '지금은 식당 정하기 단계예요.', confirmed: '약속이 확정됐어요.', settling: '정산 중이에요.', done: '밥약이 끝났어요.' }[stage]);
  expect(saveMyAvailability).not.toHaveBeenCalled(); expect(advanceRoomStage).not.toHaveBeenCalled();
});

it('formats an ISO confirmed time with the shared meetingTimeLabel', async () => {
  room.confirmedSlot = '2026-10-16T18:00:00+09:00';
  const root = await render();
  expect(text(root)).toContain(meetingTimeLabel(room.confirmedSlot, room.stage));
  expect(text(root)).not.toContain(room.confirmedSlot);
});

it('does not invent a mine row when the participant list does not contain the signed-in profile', async () => {
  room.participants = room.participants.filter(person => person.profileId !== 'profile-me');
  const root = await render();
  expect(text(root)).not.toContain('(나)');
  expect(host(root, 'schedule-submission-participant-me')[0].props.accessibilityLabel).toBe('밀챗, 제출');
  expect(root.findAllByType(Avatar)[0].props.seed).toBe('participant-me');
});

it('keeps a profileId-null legacy row separate from the signed-in user, even when its name matches', async () => {
  room.participants[0].profileId = null;
  const root = await render();
  expect(text(root)).not.toContain('(나)');
  expect(host(root, 'schedule-submission-participant-me')[0].props.accessibilityLabel).toBe('밀챗, 제출');
  expect(root.findAllByType(Avatar)[0].props.seed).toBe('participant-me');
  expect(text(root)).toContain('2명 중 1명');
});

it.each(['place', 'confirmed', 'settling', 'done'])('rechecks the stage immediately before save and stops when it is now %s', async stage => {
  const root = await render(); await press(root, '일정 수정');
  fetchRoom.mockResolvedValueOnce({ data: { ...room, stage }, error: null });
  await press(root, '선택 완료');
  expect(saveMyAvailability).not.toHaveBeenCalled();
  expect(root.findAllByType(AvailabilityGrid)).toHaveLength(0);
  expect(target(root, '선택 완료')).toBeUndefined();
  expect(text(root)).toContain({ place: '지금은 식당 정하기 단계예요.', confirmed: '약속이 확정됐어요.', settling: '정산 중이에요.', done: '밥약이 끝났어요.' }[stage]);
  expect(props.onStateChanged).toHaveBeenCalledTimes(1);
});

it.each([false, true])('blocks submission and explains why when the pre-save room check fails, thrown=%s', async thrown => {
  const root = await render(); await press(root, '일정 수정');
  if (thrown) fetchRoom.mockRejectedValueOnce(Error('provider-private-fixture'));
  else fetchRoom.mockResolvedValueOnce({ data: null, error: Error('provider-private-fixture') });
  await press(root, '선택 완료');
  expect(saveMyAvailability).not.toHaveBeenCalled();
  expect(text(root)).toContain('방 정보를 불러오지 못해 지금은 일정을 낼 수 없어요. 다시 불러와 주세요.');
  expect(text(root)).not.toContain('provider-private-fixture');
  expect(target(root, '선택 완료')).toBeUndefined();
  expect(root.findByType(AvailabilityGrid).props.picked).toEqual(new Set(['2026-10-16-18']));
  await press(root, '방 정보 다시 불러오기');
  expect(root.findByType(AvailabilityGrid).props.picked).toEqual(new Set(['2026-10-16-18']));
  expect(target(root, '선택 완료').props.disabled).toBe(false);
});

it('cancels an unsent save when the sheet closes while its stage check is pending', async () => {
  const root = await render(); await press(root, '일정 수정');
  let finish; fetchRoom.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await press(root, '선택 완료');
  await act(async () => renderer.update(React.createElement(ScheduleSheet, { ...props, visible: false })));
  await act(async () => finish({ data: room, error: null }));
  expect(saveMyAvailability).not.toHaveBeenCalled(); expect(props.onStateChanged).not.toHaveBeenCalled();
  await act(async () => renderer.update(React.createElement(ScheduleSheet, props)));
  expect(target(root, '일정 수정').props.disabled).toBe(false);
});

it.each(['reopen', 'remount'])('keeps an unfinished save locked per room across %s and refreshes after completion', async mode => {
  let finish; saveMyAvailability.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  let root = await render(); await press(root, '일정 수정'); await press(root, '선택 완료');
  expect(saveMyAvailability).toHaveBeenCalledTimes(1);
  if (mode === 'reopen') {
    await act(async () => renderer.update(React.createElement(ScheduleSheet, { ...props, visible: false })));
    await act(async () => renderer.update(React.createElement(ScheduleSheet, props)));
  } else {
    await act(async () => renderer.unmount()); renderer = undefined;
    root = await render();
  }
  expect(target(root, '일정 수정').props.disabled).toBe(true);
  await press(root, '일정 수정');
  expect(root.findAllByType(AvailabilityGrid)).toHaveLength(0);
  expect(saveMyAvailability).toHaveBeenCalledTimes(1);
  availability = { ...availability, mySlots: ['2026-10-16-18', '2026-10-16-19'] };
  await act(async () => finish(null));
  expect(target(root, '일정 수정').props.disabled).toBe(false);
  await press(root, '일정 수정');
  expect(root.findByType(AvailabilityGrid).props.picked).toEqual(new Set(availability.mySlots));
  expect(fetchRoomAvailability).toHaveBeenCalledTimes(3);
  expect(fetchRoom).toHaveBeenCalledTimes(3); // Initial, pre-save, reopened; none after the save.
});

it('also preserves a stage-transition lock across reopening and refreshes the completed stage', async () => {
  availability.members[1].submitted = true;
  let finish; advanceRoomStage.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const root = await render(); await press(root, '식당 정하러 가기');
  await act(async () => renderer.update(React.createElement(ScheduleSheet, { ...props, visible: false })));
  await act(async () => renderer.update(React.createElement(ScheduleSheet, props)));
  expect(target(root, '식당 정하러 가기').props.disabled).toBe(true);
  expect(target(root, '일정 수정').props.disabled).toBe(true);
  room = { ...room, stage: 'place' };
  await act(async () => finish({ error: null }));
  expect(text(root)).toContain('지금은 식당 정하기 단계예요.');
  expect(target(root, '식당 정하러 가기')).toBeUndefined();
  expect(props.onClose).not.toHaveBeenCalled();
  expect(props.onStateChanged).toHaveBeenCalledTimes(1);
});

it('exposes availability loading, room loading, and stage notices as polite live regions on Android', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  let finishAvailability, finishRoom;
  fetchRoomAvailability.mockReturnValueOnce(new Promise(resolve => { finishAvailability = resolve; }));
  fetchRoom.mockReturnValueOnce(new Promise(resolve => { finishRoom = resolve; }));
  const root = await render();
  const message = label => root.findAllByType(Text).find(node => node.props.children === label);
  expect(message('일정을 불러오는 중이에요.').props.accessibilityLiveRegion).toBe('polite');
  await act(async () => finishAvailability({ data: availability, error: null }));
  expect(message('방 정보를 불러오는 중이에요.').props.accessibilityLiveRegion).toBe('polite');
  await act(async () => finishRoom({ data: { ...room, stage: 'place' }, error: null }));
  expect(message('지금은 식당 정하기 단계예요.').props.accessibilityLiveRegion).toBe('polite');
  expect(AccessibilityInfo.announceForAccessibilityWithOptions).not.toHaveBeenCalled();
});

it('queues iOS loading and stage announcements without repeating them on ordinary renders', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios'); room.stage = 'place';
  await render();
  expect(AccessibilityInfo.announceForAccessibilityWithOptions).toHaveBeenCalledWith('일정을 불러오는 중이에요.', { queue: true });
  expect(AccessibilityInfo.announceForAccessibilityWithOptions).toHaveBeenCalledWith('지금은 식당 정하기 단계예요.', { queue: true });
  const calls = AccessibilityInfo.announceForAccessibilityWithOptions.mock.calls.length;
  await act(async () => renderer.update(React.createElement(ScheduleSheet, props)));
  expect(AccessibilityInfo.announceForAccessibilityWithOptions).toHaveBeenCalledTimes(calls);
});
