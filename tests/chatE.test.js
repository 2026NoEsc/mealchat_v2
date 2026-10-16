const React = require('react');
const { act, create } = require('react-test-renderer');
const { BackHandler, Clipboard, Image, Platform, StyleSheet, Text, TextInput } = require('react-native');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaProvider: ({ children }) => children }));
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: jest.fn() }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: () => ({ bundle: null }) }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/lifecycle/AppLifecycleContext', () => ({ useForegroundRefreshToken: () => 0 }));
jest.mock('../src/rooms/useMyRooms', () => ({ useRoom: jest.fn(), useRoomMessages: jest.fn() }));
jest.mock('../src/lib/rooms', () => ({ sendRoomMessage: jest.fn(), sendRoomSticker: jest.fn(), leaveRoom: jest.fn(), advanceRoomStage: jest.fn(), fetchRoom: jest.fn() }));
jest.mock('../src/lib/voting', () => ({ fetchRoomVoting: jest.fn(), confirmRoomVote: jest.fn(), addVotingItem: jest.fn(), removeVotingItem: jest.fn(), toggleVote: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('../src/lib/placeCandidates', () => ({ buildPlaceCandidates: jest.fn() }));
jest.mock('../src/lib/settlements', () => ({}));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
jest.mock('../src/screens/chat/ScheduleSheet', () => jest.fn(() => null));
jest.mock('../src/screens/chat/VotingSheet', () => jest.fn(() => null));
jest.mock('../src/screens/chat/ChatRoomSheets', () => ({ ...jest.requireActual('../src/screens/chat/ChatRoomSheets'), SettlementSheet: jest.fn(() => null) }));
const ChatRoomScreen = require('../src/screens/chat/ChatRoomScreen').default;
const RoomDetailScreen = require('../src/screens/chat/RoomDetailScreen').default;
const EmoticonPanel = require('../src/screens/chat/EmoticonPanel').default;
const { STICKERS } = require('../src/screens/chat/EmoticonPanel');
const { MembersSheet, SettlementSheet } = require('../src/screens/chat/ChatRoomSheets');
const ScheduleSheet = require('../src/screens/chat/ScheduleSheet');
const { useKeyboardOverlap } = require('../src/theme/keyboard');
const { fetchRoomVoting, confirmRoomVote } = require('../src/lib/voting');
const { advanceRoomStage } = require('../src/lib/rooms');
const RealVotingSheet = jest.requireActual('../src/screens/chat/VotingSheet').default;
const PlanConfirmation = require('../src/components/ui/PlanConfirmation').default;
const InviteCodeBox = require('../src/components/ui/InviteCodeBox').default;
const { roomDeletionErrorMessage } = require('../src/screens/chat/RoomDetailScreen');
const VotingSheet = require('../src/screens/chat/VotingSheet');
const ActionTray = require('../src/components/ui/ActionTray').default;
const DestructiveDialog = require('../src/components/ui/DestructiveDialog').default;
const { meetingTimeLabel } = require('../src/components/ui/MeetingCard');
const { v3Colors } = require('../src/theme/tokens');
const { useRoom, useRoomMessages } = require('../src/rooms/useMyRooms');
const { useAuth } = require('../src/auth/AuthProvider');
const { useNavigation } = require('../src/navigation/NavigationContext');
const { sendRoomMessage, sendRoomSticker, leaveRoom } = require('../src/lib/rooms');
const members = [
  { id: 'p1', profileId: 'me', name: '나야나', avatarUrl: null, avatarColor: '#FF9900' },
  { id: 'p2', profileId: 'mate', name: '모아', avatarUrl: null, avatarColor: '#FF9900' },
];
const room = { id: 'room', code: 'REAL42', title: '오늘 저녁팟', ownerId: 'me', participants: members, stage: 'place', confirmedSlot: '9월 25일 (금) 19:00', meetingDate: '2099-12-31', locationName: null, expiresAt: '2099-12-31T00:00:00Z' };
let renderer, navigation, reload;
const text = root => root.findAllByType(Text).map(n => n.props.children).flat().filter(Boolean).join(' ');
const target = (root, label) => root.findAll(n => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const targets = (root, label) => root.findAll(n => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
async function render(Component, props = {}) { await act(async () => { renderer = create(React.createElement(Component, props)); }); return renderer.root; }
async function press(root, label) { const button = target(root, label); expect(button).toBeDefined(); await act(async () => button.props.onPress()); }
beforeEach(() => {
  jest.clearAllMocks(); VotingSheet.mockImplementation(() => null); useKeyboardOverlap.mockReturnValue({ overlap: 0, remeasure: jest.fn() });
  fetchRoomVoting.mockResolvedValue({ data: [{ id: 'restaurant', kind: 'menu', label: '돼지집 서면점', voters: [{name:'a'},{name:'b'},{name:'c'}], mine: true }], memberCount: 4, error: null });
  confirmRoomVote.mockResolvedValue(null); advanceRoomStage.mockResolvedValue({ error: null, stage: 'confirmed' });
  useAuth.mockReturnValue({ user: { id: 'me' } });
  navigation = { current: { name: 'ChatRoom', params: { roomId: 'room' } }, navigate: jest.fn(), resetTo: jest.fn(), goBack: jest.fn() };
  useNavigation.mockReturnValue(navigation); reload = jest.fn();
  useRoom.mockReturnValue({ room, reload: jest.fn() }); useRoomMessages.mockReturnValue({ messages: [], status: 'ready', reload });
  sendRoomMessage.mockResolvedValue(null); sendRoomSticker.mockResolvedValue(null); leaveRoom.mockResolvedValue(null);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; jest.restoreAllMocks(); jest.useRealTimers(); });

it.each(['scheduling', 'place', 'confirmed'])('opens five truthful tray actions with existing stage permissions: %s', async stage => {
  useRoom.mockReturnValue({ room: { ...room, stage }, reload: jest.fn() });
  const root = await render(ChatRoomScreen); expect(root.findAllByType(ActionTray)).toHaveLength(0);
  await press(root, '메뉴 펼치기'); const tray = root.findByType(ActionTray);
  expect(text(tray)).toContain('일정 조율'); expect(text(tray)).toContain('식당 정하기'); expect(text(tray)).toContain('N빵 정산'); expect(text(tray)).toContain('멤버'); expect(text(tray)).toContain('이모티콘');
  expect(text(tray)).not.toContain('메뉴 정하기'); // 약속 확정은 이 진입점의 방장용 식당 시트에서 검증한다.
  expect(target(tray, '일정 조율').props.disabled).toBe(stage !== 'scheduling');
  expect(target(tray, '식당 정하기').props.disabled).toBe(stage !== 'place');
  expect(target(tray, 'N빵 정산').props.disabled).toBe(stage === 'scheduling' || stage === 'place');
  await press(root, '메뉴 접기'); expect(root.findAllByType(ActionTray)).toHaveLength(0);
});
it.each([['scheduling','일정 조율',ScheduleSheet],['place','식당 정하기',VotingSheet],['confirmed','N빵 정산',SettlementSheet]])('opens the existing %s sheet from the tray', async (stage, label, Component) => {
  useRoom.mockReturnValue({ room: { ...room, stage }, reload: jest.fn() }); const root = await render(ChatRoomScreen); await press(root, '메뉴 펼치기');
  await press(root.findByType(ActionTray), label); expect(root.findByType(Component).props.visible).toBe(true); expect(root.findAllByType(ActionTray)).toHaveLength(0);
  expect(root.findByType(Component).props.roomId).toBe('room');
});
it.each(['scheduling','place'])('gates restaurant choice by stage, without invented saved times: %s', async stage => {
  useRoom.mockReturnValue({ room: { ...room, stage, confirmedSlot: null }, reload: jest.fn() }); const root = await render(ChatRoomScreen);
  expect(text(root)).toContain(stage === 'place' ? '시간 미정' : '시간 확정 전'); expect(target(root, '식당 정하기').props.disabled).toBe(stage !== 'place');
  if (stage === 'scheduling') expect(text(root)).toContain('일정이 정해지면 시작할 수 있어요');
  else { await press(root,'식당 정하기'); expect(root.findByType(VotingSheet).props.visible).toBe(true); }
  expect(text(root)).not.toContain('2099');
});
it('opens restaurant voting from the card only with a saved time and retains vote confirmation wiring', async () => {
  const root = await render(ChatRoomScreen); await press(root, '식당 정하기'); const sheet = root.findByType(VotingSheet);
  expect(sheet.props.visible).toBe(true); expect(sheet.props.kind).toBe('menu');
  await act(async () => sheet.props.onConfirm()); expect(reload).toHaveBeenCalledTimes(1);
});
it('opens emoticons from the fifth tray action, closes, and submits a real sticker at 96px', async () => {
  const root = await render(ChatRoomScreen); await press(root, '메뉴 펼치기'); await press(root, '이모티콘');
  expect(root.findAllByType(ActionTray)).toHaveLength(0); expect(text(root)).not.toContain('전체 보기');
  await press(root, '이모티콘 닫기'); expect(root.findAllByType(EmoticonPanel)).toHaveLength(0);
  await press(root, '메뉴 펼치기'); await press(root, '이모티콘'); await press(root, '두두 하트 이모티콘 보내기');
  expect(sendRoomSticker).toHaveBeenCalledWith('room', 'dudu-love'); expect(reload).toHaveBeenCalledTimes(1);
  useRoomMessages.mockReturnValue({ messages: [{ id: 'sent', roomId: 'room', senderId: 'me', senderName: '나', createdAt: '2026-09-25T10:05:00Z', kind: 'user', text: '[emoticon:dudu-love]' }], status: 'ready', reload });
  await act(async () => renderer.update(React.createElement(ChatRoomScreen)));
  const image = root.findAllByType(Image).find(n => n.props.source === STICKERS[0].source);
  expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: 96, height: 96 });
});
it('preserves messaging failures and the draft while using the new send button', async () => {
  sendRoomMessage.mockResolvedValueOnce(Error('offline')); const root = await render(ChatRoomScreen);
  await act(async () => root.findByType(TextInput).props.onChangeText('안녕')); await press(root, '메시지 보내기');
  expect(sendRoomMessage).toHaveBeenCalledWith('room', '안녕'); expect(root.findByType(TextInput).props.value).toBe('안녕'); expect(reload).not.toHaveBeenCalled();
});
it('copies the real members code and identifies owner and current member independently', async () => {
  const copy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
  const root = await render(MembersSheet, { visible: true, participants: members, ownerId: 'me', code: 'REAL42', myId: 'me', onClose: jest.fn(), onInvite: jest.fn() });
  expect(text(root)).toContain('멤버 2명'); expect(text(root)).toContain('방장 · 나'); await press(root, '초대 코드 복사'); expect(copy).toHaveBeenCalledWith('REAL42'); expect(text(root)).toContain('복사됨');
  await act(async () => renderer.update(React.createElement(MembersSheet, { visible: true, participants: members, ownerId: 'me', code: 'REAL42', myId: 'mate', onClose: jest.fn(), onInvite: jest.fn() })));
  expect(text(root)).toContain('방장'); expect(text(root)).not.toContain('방장 · 나'); expect(text(root)).toContain('나');
});
it('preserves the actual invitation message from the members sheet', async () => {
  const root = await render(ChatRoomScreen); await press(root, '메뉴 펼치기'); await press(root, '멤버');
  await press(root, '＋ 메이트 초대'); expect(sendRoomMessage).toHaveBeenCalledWith('room', '초대 코드 REAL42를 메이트에게 알려 주세요.'); expect(root.findByType(MembersSheet).props.visible).toBe(false);
});
it('does not offer copy or invitation when the real code is unavailable', async () => {
  const root = await render(MembersSheet, { visible: true, participants: [], code: null, myId: 'me', onClose: jest.fn(), onInvite: jest.fn() });
  expect(target(root, '초대 코드 복사')).toBeUndefined(); expect(target(root, '＋ 메이트 초대')).toBeUndefined(); expect(text(root)).toContain('참여 멤버를 불러오지 못했어요');
});
it('routes missing-place choice and invitation to existing chat sheets and copies the actual code on detail', async () => {
  const copy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {}); const root = await render(RoomDetailScreen);
  await press(root, '초대 코드 복사'); expect(copy).toHaveBeenCalledWith('REAL42');
  await press(root, '장소 정하기'); expect(navigation.navigate).toHaveBeenCalledWith('ChatRoom', { roomId: 'room', title: '오늘 저녁팟', openSheet: 'menu' });
  await press(root, '메이트 초대'); expect(navigation.navigate).toHaveBeenLastCalledWith('ChatRoom', { roomId: 'room', title: '오늘 저녁팟', openSheet: 'members' });
  expect(navigation.navigate).not.toHaveBeenCalledWith('Origin');
});
it('cancels deletion without a call, shows real failure, and emits feedback only after success', async () => {
  const root = await render(RoomDetailScreen); await press(root, '방 없애기'); expect(root.findByType(DestructiveDialog).props.visible).toBe(true); expect(leaveRoom).not.toHaveBeenCalled();
  await press(root, '그대로 둘게요'); expect(root.findByType(DestructiveDialog).props.visible).toBe(false); expect(leaveRoom).not.toHaveBeenCalled();
  await press(root, '방 없애기'); leaveRoom.mockResolvedValueOnce(Error('denied')); await press(root, '없애기');
  expect(text(root)).toContain('방을 없애지 못했어요'); expect(text(root)).not.toContain('denied'); expect(navigation.resetTo).not.toHaveBeenCalled();
  await press(root, '없애기'); expect(leaveRoom).toHaveBeenCalledTimes(2); expect(navigation.resetTo).toHaveBeenCalledWith('Home', { deletedRoomId: 'room', deletedRoomTitle: '오늘 저녁팟' });
});
it('prevents duplicate deletion calls while the real request is pending', async () => {
  let resolve; leaveRoom.mockReturnValueOnce(new Promise(yes => { resolve = yes; })); const root = await render(RoomDetailScreen); await press(root, '방 없애기');
  const confirm = target(root, '없애기').props.onPress; await act(async () => { confirm(); confirm(); });
  expect(leaveRoom).toHaveBeenCalledTimes(1); expect(target(root, '없애기').props.disabled).toBe(true);
  await act(async () => resolve(null)); expect(navigation.resetTo).toHaveBeenCalledTimes(1);
});
it.each(['mate','settling'])('preserves deletion restrictions for %s and never invents mate-leave', async kind => {
  if (kind === 'mate') useAuth.mockReturnValue({ user: { id: 'mate' } }); else useRoom.mockReturnValue({ room: { ...room, stage: 'settling' }, reload: jest.fn() });
  const root = await render(RoomDetailScreen);
  if (kind === 'mate') expect(target(root, '방 없애기')).toBeUndefined(); else expect(target(root, '방 없애기').props.disabled).toBe(true);
  expect(target(root, '방 나가기')).toBeUndefined();
});
it('renders mine text in ink at contrast above 4.5:1 on the primary bubble', async () => {
  useRoomMessages.mockReturnValue({ messages: [{ id: 'mine', senderId: 'me', senderName: '나', kind: 'user', text: '내 메시지', createdAt: '2026-09-25T10:03:00Z' }], status: 'ready', reload });
  const root = await render(ChatRoomScreen); const node = root.findAllByType(Text).find(n => n.props.children === '내 메시지'); expect(StyleSheet.flatten(node.props.style).color).toBe(v3Colors.ink);
  const luminance = hex => hex.slice(1).match(/../g).map(h => parseInt(h,16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
  expect((luminance(v3Colors.primary)+.05)/(luminance(v3Colors.ink)+.05)).toBeGreaterThanOrEqual(4.5);
});
it.each(['confirmed','settling','done'])('never substitutes meetingDate in %s', async stage => {
  useRoom.mockReturnValue({ room: { ...room, stage, confirmedSlot: null }, reload: jest.fn() }); const root = await render(ChatRoomScreen); expect(text(root)).toContain('시간 미정'); expect(text(root)).not.toContain('2099'); expect(text(root)).not.toContain('12월 31일');
});
it('formats only a real saved slot and preserves human text', () => {
  expect(meetingTimeLabel(null,'confirmed')).toBe('시간 미정'); expect(meetingTimeLabel('9월 25일 (금) 19:00','place')).toBe('9월 25일 (금) 19:00');
  expect(meetingTimeLabel('2026-09-25T19:00:00','place')).toBe('9월 25일 (금) 19:00');
});
it('closes the tray on Android back and cleans up its subscription', async () => {
  const previous = Platform.OS; Platform.OS = 'android'; let handler; const remove=jest.fn(); jest.spyOn(BackHandler,'addEventListener').mockImplementation((_,fn)=>{handler=fn;return {remove};});
  try { const root=await render(ChatRoomScreen);await press(root,'메뉴 펼치기');await act(async()=>{expect(handler()).toBe(true);});expect(root.findAllByType(ActionTray)).toHaveLength(0);expect(remove).toHaveBeenCalled();expect(navigation.goBack).not.toHaveBeenCalled(); }
  finally { Platform.OS=previous; }
});

const votingProps = overrides => ({ visible: true, roomId: 'room', kind: 'menu', title: '식당 정하기', subtitle: '식당에 투표해 주세요', placeholder: '식당 이름', isOwner: true, stage: 'place', confirmedSlot: null, participantCount: 4, onConfirm: jest.fn(), onClose: jest.fn(), ...overrides });
it('shows the Figma summary before calling RPCs, then saves the vote before advancing the stage', async () => {
  const props=votingProps();const root=await render(RealVotingSheet,props);await press(root,'약속 확정');
  expect(root.findByType(PlanConfirmation).props.restaurant).toBe('돼지집 서면점');expect(text(root)).toContain('시간 미정');expect(text(root)).toContain('4');expect(confirmRoomVote).not.toHaveBeenCalled();
  await press(root,'확정하기');expect(confirmRoomVote).toHaveBeenCalledWith('room','restaurant');expect(advanceRoomStage).toHaveBeenCalledWith('room','confirmed');
  expect(confirmRoomVote.mock.invocationCallOrder[0]).toBeLessThan(advanceRoomStage.mock.invocationCallOrder[0]);expect(props.onConfirm).toHaveBeenCalledTimes(1);expect(props.onClose).toHaveBeenCalledTimes(1);
});
it('keeps strict majority and owner checks, without requiring every member to vote', async () => {
  const root=await render(RealVotingSheet,votingProps({isOwner:false}));expect(target(root,'약속 확정')).toBeUndefined();
  await act(async()=>renderer.update(React.createElement(RealVotingSheet,votingProps({isOwner:true}))));expect(target(root,'약속 확정').props.disabled).toBe(false);
  await press(root,'약속 확정');await press(root,'다시 볼게요');expect(confirmRoomVote).not.toHaveBeenCalled();
  fetchRoomVoting.mockResolvedValue({data:[{id:'restaurant',kind:'menu',label:'식당',voters:[{name:'a'},{name:'b'}],mine:true}],memberCount:4,error:null});
  await act(async()=>renderer.update(React.createElement(RealVotingSheet,votingProps({visible:false}))));await act(async()=>renderer.update(React.createElement(RealVotingSheet,votingProps())));
  expect(target(root,'약속 확정').props.disabled).toBe(true);
});
it.each(['returned','thrown'])('does not advance on a %s vote-save failure', async mode => {
  if(mode==='returned')confirmRoomVote.mockResolvedValueOnce(Error('SQL secret'));else confirmRoomVote.mockRejectedValueOnce(Error('SQL secret'));
  const props=votingProps();const root=await render(RealVotingSheet,props);await press(root,'약속 확정');await press(root,'확정하기');
  expect(advanceRoomStage).not.toHaveBeenCalled();expect(props.onClose).not.toHaveBeenCalled();expect(text(root)).toContain('식당 선택을 저장하지 못했어요');expect(text(root)).not.toContain('SQL secret');
});
it.each(['returned','thrown'])('retries only stage advancement after partial success: %s', async mode => {
  if(mode==='returned')advanceRoomStage.mockResolvedValueOnce({error:Error('SQL secret')});else advanceRoomStage.mockRejectedValueOnce(Error('SQL secret'));
  const props=votingProps();const root=await render(RealVotingSheet,props);await press(root,'약속 확정');await press(root,'확정하기');
  expect(text(root)).toContain('식당은 저장됐지만');expect(props.onConfirm).not.toHaveBeenCalled();expect(props.onClose).not.toHaveBeenCalled();
  await press(root,'다시 볼게요');await press(root,'약속 확정 다시 시도');await press(root,'다시 확정하기');
  expect(confirmRoomVote).toHaveBeenCalledTimes(1);expect(advanceRoomStage).toHaveBeenCalledTimes(2);expect(props.onConfirm).toHaveBeenCalledTimes(1);
});
it('restores a partial-failure retry after closing and reopening the sheet', async () => {
  advanceRoomStage.mockResolvedValueOnce({error:Error('offline')});const props=votingProps();const root=await render(RealVotingSheet,props);await press(root,'약속 확정');await press(root,'확정하기');await press(root,'다시 볼게요');
  await act(async()=>renderer.update(React.createElement(RealVotingSheet,{...props,visible:false})));await act(async()=>renderer.update(React.createElement(RealVotingSheet,props)));
  await press(root,'약속 확정 다시 시도');await press(root,'다시 확정하기');expect(confirmRoomVote).toHaveBeenCalledTimes(1);expect(props.onConfirm).toHaveBeenCalledTimes(1);
});
it('prevents duplicate confirmation calls while the vote RPC is pending', async () => {
  let resolve;confirmRoomVote.mockReturnValueOnce(new Promise(yes=>{resolve=yes;}));const root=await render(RealVotingSheet,votingProps());await press(root,'약속 확정');const confirm=target(root,'확정하기').props.onPress;
  await act(async()=>{confirm();confirm();});expect(confirmRoomVote).toHaveBeenCalledTimes(1);expect(advanceRoomStage).not.toHaveBeenCalled();await act(async()=>resolve(null));expect(advanceRoomStage).toHaveBeenCalledTimes(1);
});
it('moves the actual chat flow from place to confirmed and enables N빵 after owner confirmation', async () => {
  VotingSheet.mockImplementation(props=>React.createElement(RealVotingSheet,props));
  advanceRoomStage.mockImplementationOnce(async()=>{useRoom.mockReturnValue({room:{...room,stage:'confirmed'},reload:jest.fn()});return{error:null,stage:'confirmed'};});
  const root=await render(ChatRoomScreen);await press(root,'약속 확정');await press(root.findByType(RealVotingSheet),'약속 확정');await press(root.findByType(RealVotingSheet),'확정하기');
  await press(root,'메뉴 펼치기');expect(target(root.findByType(ActionTray),'N빵 정산').props.disabled).toBe(false);
});
it.each(['me','mate'])('shows detail restaurant choice for %s only in loaded place rooms',async id=>{
  useAuth.mockReturnValue({user:{id}});const root=await render(RoomDetailScreen);expect(target(root,'장소 정하기')).toBeDefined();
  for(const stage of ['scheduling','confirmed','settling','done']){useRoom.mockReturnValue({room:{...room,stage},reload:jest.fn()});await act(async()=>renderer.update(React.createElement(RoomDetailScreen)));expect(target(root,'장소 정하기')).toBeUndefined();}
  useRoom.mockReturnValue({room:null,reload:jest.fn()});await act(async()=>renderer.update(React.createElement(RoomDetailScreen)));expect(target(root,'장소 정하기')).toBeUndefined();expect(text(root)).toContain('••••••');expect(text(root)).not.toContain('코드를 불러오지 못했어요');
});
it('distinguishes InviteCodeBox loading from missing-code failure',async()=>{
  const root=await render(InviteCodeBox,{code:null,loading:true});expect(text(root)).toContain('••••••');await act(async()=>renderer.update(React.createElement(InviteCodeBox,{code:null,loading:false})));expect(text(root)).toContain('코드를 불러오지 못했어요');
});
it('collapses the fixed meeting card for either panel or keyboard and closes panels on input focus',async()=>{
  const root=await render(ChatRoomScreen);await press(root,'메뉴 펼치기');expect(root.findAll(n=>n.props.testID==='meeting-card-compact').length).toBeGreaterThan(0);
  await act(async()=>root.findByType(TextInput).props.onFocus());expect(root.findAllByType(ActionTray)).toHaveLength(0);
  await press(root,'메뉴 펼치기');await press(root,'이모티콘');await act(async()=>root.findByType(TextInput).props.onFocus());expect(root.findAllByType(EmoticonPanel)).toHaveLength(0);
  useKeyboardOverlap.mockReturnValue({overlap:240,remeasure:jest.fn()});await act(async()=>renderer.update(React.createElement(ChatRoomScreen)));expect(root.findAll(n=>n.props.testID==='meeting-card-compact').length).toBeGreaterThan(0);
});
it('provides disabled action reasons and visually dims both icons and labels',async()=>{
  const root=await render(ActionTray,{stage:'place',onChoose:jest.fn()});const button=target(root,'N빵 정산');expect(button.props.accessibilityHint).toContain('약속을 확정하면');expect(button.findAll(n=>StyleSheet.flatten(n.props.style)?.opacity===0.4).length).toBeGreaterThanOrEqual(2);
});
it('restores settlement timers and stops the interval on unmount',async()=>{
  jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00Z'));useRoom.mockReturnValue({room:{...room,stage:'done',expiresAt:'2026-09-25T10:30:00Z'},reload:jest.fn()});const root=await render(ChatRoomScreen);
  const initial=text(root);expect(initial).toContain('방이 사라져요');await act(async()=>jest.advanceTimersByTime(1000));expect(text(root)).not.toBe(initial);
  const clearIntervalSpy=jest.spyOn(global,'clearInterval');await act(async()=>renderer.unmount());renderer=undefined;expect(clearIntervalSpy).toHaveBeenCalled();
});
it.each([['place','위치 보기',VotingSheet],['settlement','정산하기',SettlementSheet]])('restores the %s notice action badge',async(kind,label,Component)=>{
  useRoomMessages.mockReturnValue({messages:[{id:'notice',kind:'system',text:'[notice:'+kind+']실제 안내',createdAt:'2026-09-25T10:00:00Z'}],status:'ready',reload});const root=await render(ChatRoomScreen);await press(root,label);expect(root.findByType(Component).props.visible).toBe(true);
});
it('keeps deletion hints factual and never exposes arbitrary backend errors',async()=>{
  expect(roomDeletionErrorMessage({code:'42501',message:'internal secret'})).toContain('방장만');expect(roomDeletionErrorMessage(Error('internal secret'))).not.toContain('internal');
  useRoom.mockReturnValue({room:{...room,stage:'settling'},reload:jest.fn()});const root=await render(RoomDetailScreen);expect(text(root)).toContain('정산이 끝나면 없앨 수 있어요.');
  useAuth.mockReturnValue({user:{id:'mate'}});await act(async()=>renderer.update(React.createElement(RoomDetailScreen)));expect(text(root)).toContain('방은 방장만 없앨 수 있어요.');
});
it('stores sticker labels with their data and dims disabled sticker targets',async()=>{
  expect(STICKERS.every(sticker=>typeof sticker.label==='string'&&sticker.label.length>0)).toBe(true);const root=await render(EmoticonPanel,{disabled:true,onClose:jest.fn(),onPick:jest.fn()});
  const button=target(root,'두두 하트 이모티콘 보내기');expect(button.props.disabled).toBe(true);expect(StyleSheet.flatten(button.props.style).opacity).toBe(0.4);
});

it('shows a real room lookup failure with a retry and no restaurant entry',async()=>{const retry=jest.fn();useRoom.mockReturnValue({room:null,status:'error',reload:retry});const root=await render(RoomDetailScreen);expect(text(root)).toContain('방 정보를 불러오지 못했어요');expect(text(root)).not.toContain('••••••');expect(target(root,'장소 정하기')).toBeUndefined();await press(root,'다시 시도');expect(retry).toHaveBeenCalledTimes(1);});
it('returns useRoom loading, failure, retry and loaded states from the existing fetch API',async()=>{
  const {useRoom:actualUseRoom}=jest.requireActual('../src/rooms/useMyRooms');const {fetchRoom}=require('../src/lib/rooms');let resolve,result;fetchRoom.mockReturnValueOnce(new Promise(yes=>{resolve=yes;}));
  function Probe(){result=actualUseRoom('room');return null;}await render(Probe);expect(result.status).toBe('loading');await act(async()=>resolve({data:null,error:Error('offline')}));expect(result.status).toBe('error');
  fetchRoom.mockResolvedValueOnce({data:room,error:null});await act(async()=>result.reload());expect(result.status).toBe('ready');expect(result.room).toEqual(room);
  fetchRoom.mockRejectedValueOnce(Error('offline'));await act(async()=>result.reload());expect(result.status).toBe('error');expect(result.room).toBe(null);
});
