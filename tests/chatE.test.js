const React = require('react');
const { act, create } = require('react-test-renderer');
const { BackHandler, Clipboard, Image, Platform, Share, StyleSheet, Text, TextInput } = require('react-native');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaProvider: ({ children }) => children }));
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: jest.fn() }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: jest.fn() }));
jest.mock('../src/lib/tmap', () => ({ searchPlaces: jest.fn() }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/lifecycle/AppLifecycleContext', () => ({ useForegroundRefreshToken: () => 0 }));
jest.mock('../src/rooms/useMyRooms', () => ({ useRoom: jest.fn(), useRoomMessages: jest.fn() }));
jest.mock('../src/lib/rooms', () => ({ sendRoomMessage: jest.fn(), sendRoomSticker: jest.fn(), leaveRoom: jest.fn(), advanceRoomStage: jest.fn(), fetchRoom: jest.fn() }));
jest.mock('../src/lib/voting', () => ({ fetchRoomVoting: jest.fn(), confirmRoomVote: jest.fn(), addVotingItem: jest.fn(), removeVotingItem: jest.fn(), toggleVote: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() }, from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../src/lib/placeCandidates', () => ({ buildPlaceCandidates: jest.fn() }));
jest.mock('../src/lib/settlements', () => ({ ...jest.requireActual('../src/lib/settlementAccess'), fetchRoomSettlements: jest.fn(), createRoomSettlement: jest.fn(), setSettlementCompleted: jest.fn(), fetchSettlementPaymentDetails: jest.fn(), subscribeSettlementPayments: () => () => {} }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
jest.mock('../src/screens/chat/ScheduleSheet', () => jest.fn(() => null));
jest.mock('../src/screens/chat/VotingSheet', () => jest.fn(() => null));
jest.mock('../src/screens/chat/ChatRoomSheets', () => ({ ...jest.requireActual('../src/screens/chat/ChatRoomSheets'), SettlementSheet: jest.fn(() => null) }));
const ChatRoomScreen = require('../src/screens/chat/ChatRoomScreen').default;
const RoomDetailScreen = require('../src/screens/chat/RoomDetailScreen').default;
const EmoticonPanel = require('../src/screens/chat/EmoticonPanel').default;
const { STICKERS } = require('../src/screens/chat/EmoticonPanel');
const { MembersSheet, SettlementSheet } = require('../src/screens/chat/ChatRoomSheets');
const RealSettlementSheet = jest.requireActual('../src/screens/chat/ChatRoomSheets').SettlementSheet;
const { fetchRoomSettlements, createRoomSettlement, setSettlementCompleted: completeSheetMember } = require('../src/lib/settlements');
const MateInviteSheet = require('../src/components/ui/MateInviteSheet').default;
const ScheduleSheet = require('../src/screens/chat/ScheduleSheet');
const { useKeyboardOverlap } = require('../src/theme/keyboard');
const { fetchRoomVoting, confirmRoomVote, toggleVote, addVotingItem, removeVotingItem } = require('../src/lib/voting');
const { useMyProfile } = require('../src/profile/useMyProfile');
const { buildPlaceCandidates } = require('../src/lib/placeCandidates');
const { setRestaurantRecommendationUser, createRestaurantRecommendation, getRestaurantRecommendation } = require('../src/lib/restaurantRecommendationCache');
const { supabase } = require('../src/lib/supabase');
const { searchPlaces } = require('../src/lib/tmap');
const VoteToggle = require('../src/components/ui/VoteToggle').default;
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
const target = (root, label) => root.findAll(n => n.props.accessibilityRole === 'button' && (n.props.accessibilityLabel === label || (label === '약속 확정' && n.props.testID === 'voting-confirm-cta')) && typeof n.props.onPress === 'function')[0];
const targets = (root, label) => root.findAll(n => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
async function render(Component, props = {}) { await act(async () => { renderer = create(React.createElement(Component, props)); }); return renderer.root; }
// Simulate the AuthProvider event alongside the mocked auth context.
function setChatUser(user) { setRestaurantRecommendationUser(user?.id ?? null); useAuth.mockReturnValue({ user }); }
async function press(root, label) { const button = target(root, label); expect(button).toBeDefined(); await act(async () => button.props.onPress()); }
beforeEach(() => {
  setRestaurantRecommendationUser(null);
  jest.clearAllMocks(); VotingSheet.mockImplementation(() => null); useKeyboardOverlap.mockReturnValue({ overlap: 0, remeasure: jest.fn() });
  fetchRoomVoting.mockResolvedValue({ data: [{ id: 'restaurant', kind: 'menu', label: '돼지집 서면점', voters: [{name:'a'},{name:'b'},{name:'c'}], mine: true }], memberCount: 4, error: null });
  useMyProfile.mockReturnValue({bundle:null}); searchPlaces.mockReset().mockResolvedValue([]);
  toggleVote.mockResolvedValue(null); addVotingItem.mockResolvedValue(null); removeVotingItem.mockResolvedValue(null);
  buildPlaceCandidates.mockReset(); supabase.functions.invoke.mockReset();
  fetchRoomSettlements.mockResolvedValue({ data: [], error: null }); createRoomSettlement.mockResolvedValue({ billId: 'created', error: null }); completeSheetMember.mockResolvedValue(null);
  require('../src/lib/settlements').fetchSettlementPaymentDetails.mockImplementation(async billId => ({ data: { billId, status: 'open', details: { bankName: '카카오뱅크', accountNumber: '3333-01-2345678', accountHolder: '모아' } }, error: null }));
  confirmRoomVote.mockResolvedValue(null); advanceRoomStage.mockResolvedValue({ error: null, stage: 'confirmed' });
  setChatUser({ id: 'me' });
  navigation = { replace: jest.fn(), current: { name: 'ChatRoom', params: { roomId: 'room' } }, navigate: jest.fn(), resetTo: jest.fn(), goBack: jest.fn() };
  useNavigation.mockReturnValue(navigation); reload = jest.fn();
  useRoom.mockReturnValue({ room, reload: jest.fn() }); useRoomMessages.mockReturnValue({ messages: [], status: 'ready', reload });
  sendRoomMessage.mockResolvedValue(null); sendRoomSticker.mockResolvedValue(null); leaveRoom.mockResolvedValue(null);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; setRestaurantRecommendationUser(null); jest.restoreAllMocks(); jest.useRealTimers(); });

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
it('opens the invitation sheet from members without sending a chat message', async () => {
  const root = await render(ChatRoomScreen); await press(root, '메뉴 펼치기'); await press(root, '멤버');
  await press(root, '＋ 메이트 초대'); expect(text(root)).toContain('메이트 초대'); expect(target(root, '초대 코드 공유')).toBeDefined(); expect(sendRoomMessage).not.toHaveBeenCalled(); expect(root.findByType(MembersSheet).props.visible).toBe(true);
});
it('does not offer copy or invitation when the real code is unavailable', async () => {
  const root = await render(MembersSheet, { visible: true, participants: [], code: null, myId: 'me', onClose: jest.fn(), onInvite: jest.fn() });
  expect(target(root, '초대 코드 복사')).toBeUndefined(); expect(target(root, '＋ 메이트 초대')).toBeUndefined(); expect(text(root)).toContain('참여 멤버를 불러오지 못했어요');
});
it('routes missing-place choice and invitation to existing chat sheets and copies the actual code on detail', async () => {
  const copy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {}); const root = await render(RoomDetailScreen);
  await press(root, '초대 코드 복사'); expect(copy).toHaveBeenCalledWith('REAL42');
  await press(root, '장소 정하기'); expect(navigation.navigate).toHaveBeenCalledWith('ChatRoom', { roomId: 'room', title: '오늘 저녁팟', openSheet: 'menu' });
  await press(root, '메이트 초대'); expect(target(root, '초대 코드 공유')).toBeDefined(); expect(navigation.navigate).toHaveBeenCalledTimes(1);
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
  if (kind === 'mate') setChatUser({ id: 'mate' }); else useRoom.mockReturnValue({ room: { ...room, stage: 'settling' }, reload: jest.fn() });
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
  setChatUser({id});const root=await render(RoomDetailScreen);expect(target(root,'장소 정하기')).toBeDefined();
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
  setChatUser({id:'mate'});await act(async()=>renderer.update(React.createElement(RoomDetailScreen)));expect(text(root)).toContain('방은 방장만 없앨 수 있어요.');
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

const voteButton = (root,label) => root.findAll(n=>n.props.accessibilityRole==='checkbox'&&n.props.accessibilityLabel===label+' 투표'&&typeof n.props.onPress==='function')[0];
const profileOrigin = {bundle:{privateProfile:{startLat:35,startLng:129,startLocationName:'서면'}}};
const aiCandidates = {candidates:[{id:'new',name:'새 식당',address:'실제 검색 주소',latitude:35,longitude:129,category:'한식'},{id:'existing',name:'돼지집 서면점'}]};
const aiResponse = name => ({data:{placeRecommendations:[{place:{name},rank:1,score:85}]},error:null});
it.each([false,true])('recovers a remounted stored restaurant without re-confirming a changed leader (load fails: %s)',async loadFails=>{
  fetchRoomVoting.mockResolvedValue(loadFails?{data:null,error:Error('offline'),memberCount:0}:{data:[{id:'other',kind:'menu',label:'바뀐 1위',voters:[],mine:false}],memberCount:4,error:null});
  const props=votingProps({confirmedRestaurant:'이미 저장한 식당'});const root=await render(RealVotingSheet,props);
  expect(target(root,'약속 확정 다시 시도').props.disabled).toBe(false);await press(root,'약속 확정 다시 시도');expect(root.findByType(PlanConfirmation).props.restaurant).toBe('이미 저장한 식당');await press(root,'다시 확정하기');
  expect(confirmRoomVote).not.toHaveBeenCalled();expect(advanceRoomStage).toHaveBeenCalledWith('room','confirmed');expect(props.onConfirm).toHaveBeenCalledTimes(1);
});
it('keeps the owner retry entry after reopening the actual chat room',async()=>{
  useRoom.mockReturnValue({room:{...room,confirmedMenu:'저장된 식당'},reload:jest.fn()});VotingSheet.mockImplementation(props=>React.createElement(RealVotingSheet,props));
  const root=await render(ChatRoomScreen);await press(root,'약속 확정 다시 시도');await press(root.findByType(RealVotingSheet),'약속 확정 다시 시도');await press(root,'다시 확정하기');expect(confirmRoomVote).not.toHaveBeenCalled();expect(advanceRoomStage).toHaveBeenCalledTimes(1);
});
it('recovers an already-confirmed vote after the refreshed room reveals its saved restaurant',async()=>{
  confirmRoomVote.mockResolvedValueOnce(Error('already been confirmed'));const props=votingProps();const root=await render(RealVotingSheet,props);await press(root,'약속 확정');await press(root,'확정하기');expect(props.onVoted).toBeUndefined();
  await act(async()=>renderer.update(React.createElement(RealVotingSheet,{...props,confirmedRestaurant:'원래 저장한 식당'})));expect(root.findByType(PlanConfirmation).props.restaurant).toBe('원래 저장한 식당');await press(root,'다시 확정하기');expect(confirmRoomVote).toHaveBeenCalledTimes(1);expect(advanceRoomStage).toHaveBeenCalledTimes(1);
});
it('explains missing majority visually and in the disabled CTA hint',async()=>{
  fetchRoomVoting.mockResolvedValue({data:[{id:'r',kind:'menu',label:'식당',voters:[{name:'a'},{name:'b'}],mine:false}],memberCount:4,error:null});const root=await render(RealVotingSheet,votingProps());
  expect(text(root)).toContain('과반수 표가 필요해요');expect(target(root,'약속 확정').props.accessibilityLabel).toBe('식당으로 정하기');expect(target(root,'약속 확정').props.accessibilityHint).toBe('과반수 표가 필요해요');expect(target(root,'약속 확정').props.disabled).toBe(true);
  await act(async()=>renderer.update(React.createElement(RealVotingSheet,votingProps({isOwner:false}))));expect(text(root)).toContain('방장이 확정해요');expect(target(root,'약속 확정')).toBeUndefined();
});
it('renders an independently reversible accessible v3 VoteToggle',async()=>{
  const onPress=jest.fn();const root=await render(VoteToggle,{label:'식당',selected:false,onPress});let button=voteButton(root,'식당');expect(StyleSheet.flatten(button.props.style)).toMatchObject({width:56,height:52,borderRadius:12});expect(button.props.accessibilityState.checked).toBe(false);expect(button.props['aria-checked']).toBe(false);await act(async()=>button.props.onPress());expect(onPress).toHaveBeenCalledTimes(1);
  await act(async()=>renderer.update(React.createElement(VoteToggle,{label:'식당',selected:true,onPress,disabled:true})));button=voteButton(root,'식당');expect(button.props.accessibilityState.checked).toBe(true);expect(button.props.disabled).toBe(true);expect(text(root)).toContain('투표함');
});
it('toggles a real stored candidate through the existing vote API',async()=>{
  const root=await render(RealVotingSheet,votingProps());await act(async()=>voteButton(root,'돼지집 서면점').props.onPress());expect(toggleVote).toHaveBeenCalledWith('room','restaurant');expect(fetchRoomVoting).toHaveBeenCalledTimes(2);
  await press(root,'돼지집 서면점 후보 삭제');expect(removeVotingItem).toHaveBeenCalledWith('room','restaurant');
});
it('labels only actual AI suggestions and adds then votes through real API contracts',async()=>{
  const root=await render(RealVotingSheet,votingProps({suggestions:[{label:'새 식당',fresh:true}]}));expect(text(root)).toContain('AI 새 추천');expect(text(root)).not.toContain('85%');
  fetchRoomVoting.mockResolvedValue({data:[{id:'new',kind:'menu',label:'새 식당',voters:[],mine:false}],memberCount:4,error:null});await act(async()=>voteButton(root,'새 식당').props.onPress());
  expect(addVotingItem).toHaveBeenCalledWith('room','menu','새 식당');expect(toggleVote).toHaveBeenCalledWith('room','new');expect(addVotingItem.mock.invocationCallOrder[0]).toBeLessThan(toggleVote.mock.invocationCallOrder[0]);
});
it('searches existing places and adds a real result, preserving the result address only for display',async()=>{
  const rows=[{id:'found',name:'찾은 식당',address:'검색 주소',lat:35,lng:129,category:'한식'}];searchPlaces.mockResolvedValue(rows);const root=await render(RealVotingSheet,votingProps());await press(root,'직접 추가');
  expect(target(root,'식당 직접 추가 닫기')).toBeDefined();await act(async()=>root.findByType(TextInput).props.onChangeText('찾은'));
  await act(async()=>new Promise(resolve=>setTimeout(resolve,380)));expect(searchPlaces).toHaveBeenCalledWith('찾은');expect(text(root)).toContain('검색 주소');await press(root,'찾은 식당 추가');expect(addVotingItem).toHaveBeenCalledWith('room','menu','찾은 식당');expect(toggleVote).not.toHaveBeenCalled();
});
it('keeps direct addition available on search failure and gives kind-specific close labels',async()=>{
  searchPlaces.mockRejectedValue(Error('provider detail'));const root=await render(RealVotingSheet,votingProps());await press(root,'직접 추가');await act(async()=>root.findByType(TextInput).props.onChangeText('내 식당'));await act(async()=>new Promise(resolve=>setTimeout(resolve,380)));
  expect(text(root)).toContain('식당을 검색하지 못했어요');expect(text(root)).not.toContain('provider detail');await press(root,'이 이름으로 후보 추가');expect(addVotingItem).toHaveBeenCalledWith('room','menu','내 식당');await press(root,'식당 직접 추가 닫기');
  await act(async()=>renderer.update(React.createElement(RealVotingSheet,votingProps({kind:'time',title:'시간 정하기'}))));expect(target(root,'시간 시트 닫기')).toBeDefined();
});
it.each(['returned','thrown','malformed'])('renders actual recommendation %s failure and retries the existing invocation',async mode=>{
  useMyProfile.mockReturnValue(profileOrigin);buildPlaceCandidates.mockResolvedValue(aiCandidates);
  if(mode==='returned')supabase.functions.invoke.mockResolvedValueOnce({error:Error('private detail')});else if(mode==='thrown')supabase.functions.invoke.mockRejectedValueOnce(Error('private detail'));else if(mode==='empty')buildPlaceCandidates.mockResolvedValueOnce({candidates:[]});else supabase.functions.invoke.mockResolvedValueOnce({data:{placeRecommendations:[{place:{name:'없는 식당'}}]},error:null});
  VotingSheet.mockImplementation(props=>React.createElement(RealVotingSheet,props));const root=await render(ChatRoomScreen);await press(root,'식당 정하기');expect(text(root)).toContain('추천을 불러오지 못했어요');expect(text(root)).not.toContain('private detail');
  supabase.functions.invoke.mockResolvedValue(aiResponse('새 식당'));await press(root.findByType(RealVotingSheet),'다시 시도');expect(text(root)).not.toContain('추천을 불러오지 못했어요');expect(text(root)).toContain('새 식당');expect(supabase.functions.invoke).toHaveBeenLastCalledWith('schedule-recommend',{body:{meetingName:room.title,roomId:'room',placeCandidates:aiCandidates.candidates}});
});
it('does not fabricate recommendation failure when the profile origin is missing',async()=>{
  const root=await render(ChatRoomScreen);expect(buildPlaceCandidates).not.toHaveBeenCalled();expect(root.findByType(VotingSheet).props.suggestionStatus).toBe('unavailable');expect(root.findByType(VotingSheet).props.suggestionReason).toContain('프로필 출발지');
});
it('merges actual new recommendations without duplicates and marks only new names',async()=>{
  useMyProfile.mockReturnValue(profileOrigin);buildPlaceCandidates.mockResolvedValue(aiCandidates);supabase.functions.invoke.mockResolvedValueOnce(aiResponse('돼지집 서면점')).mockResolvedValueOnce(aiResponse('새 식당'));
  const root=await render(ChatRoomScreen);expect(root.findByType(VotingSheet).props.suggestions).toEqual([{label:'돼지집 서면점',fresh:false}]);await act(async()=>root.findByType(VotingSheet).props.onRequestSuggestions());
  expect(root.findByType(VotingSheet).props.suggestions).toEqual([{label:'돼지집 서면점',fresh:false},{label:'새 식당',fresh:true}]);expect(root.findByType(VotingSheet).props.receivedMore).toBe(true);
});
it.each(['confirmed','settling','done','scheduling'])('routes a historical place notice to details at stage %s',async stage=>{
  useRoom.mockReturnValue({room:{...room,stage},reload:jest.fn()});useRoomMessages.mockReturnValue({messages:[{id:'n',kind:'system',text:'[notice:place]식당 안내',createdAt:'2026-09-25T10:00:00Z'}],status:'ready',reload});const root=await render(ChatRoomScreen);await press(root,'위치 보기');expect(navigation.navigate).toHaveBeenCalledWith('RoomDetail',{roomId:'room',title:room.title});expect(root.findByType(VotingSheet).props.visible).toBe(false);
});
it('maps confirmed_menu separately from a general location through the existing room queries',async()=>{
  const raw={id:'r',code:'ABC',title:'방',stage:'place',location_name:'일반 위치',confirmed_menu:'저장된 식당',participants:[],messages:[]};const builder={select:jest.fn(),eq:jest.fn(),order:jest.fn(),limit:jest.fn(),maybeSingle:jest.fn(),returns:jest.fn()};for(const method of ['select','eq','order','limit'])builder[method].mockReturnValue(builder);builder.maybeSingle.mockResolvedValue({data:raw,error:null});builder.returns.mockResolvedValue({data:[raw],error:null});supabase.from.mockReturnValue(builder);supabase.rpc.mockResolvedValue({error:null});const actual=jest.requireActual('../src/lib/rooms');
  const one=await actual.fetchRoom('r');expect(one.data).toMatchObject({locationName:'일반 위치',confirmedMenu:'저장된 식당'});const many=await actual.fetchMyRooms('me');expect(many.data[0].confirmedMenu).toBe('저장된 식당');
});

it('closes a stale confirmation when stage or owner permission changes',async()=>{const props=votingProps();const root=await render(RealVotingSheet,props);await press(root,'약속 확정');await act(async()=>renderer.update(React.createElement(RealVotingSheet,{...props,stage:'confirmed'})));expect(root.findAllByType(PlanConfirmation)).toHaveLength(0);expect(target(root,'약속 확정')).toBeUndefined();});

it('reports partial add-and-vote failure without claiming the saved candidate was lost',async()=>{const root=await render(RealVotingSheet,votingProps({suggestions:[{label:'새 식당'}]}));fetchRoomVoting.mockResolvedValue({data:[{id:'new',kind:'menu',label:'새 식당',voters:[],mine:false}],memberCount:4,error:null});toggleVote.mockResolvedValueOnce(Error('offline'));await act(async()=>voteButton(root,'새 식당').props.onPress());expect(text(root)).toContain('후보는 추가됐지만 투표하지 못했어요');expect(text(root)).not.toContain('후보를 추가하지 못했어요');expect(addVotingItem).toHaveBeenCalledTimes(1);});

it.each([false,true])('locks saved restaurant edits for owner=%s but keeps only the owner stage retry',async isOwner=>{
  const request=jest.fn();const props=votingProps({isOwner,confirmedRestaurant:'저장한 식당',onRequestSuggestions:request,suggestions:[{label:'추가 AI 후보'}],suggestionStatus:'ready'});const root=await render(RealVotingSheet,props);
  expect(text(root)).toContain('식당이 정해졌어요. 방장이 약속을 확정하면 끝나요');expect(text(root)).not.toContain('그동안 투표를 바꿀 수 있어요');expect(voteButton(root,'돼지집 서면점').props.disabled).toBe(true);expect(target(root,'직접 추가').props.disabled).toBe(true);expect(target(root,'AI 추천 더 받기').props.disabled).toBe(true);expect(voteButton(root,'추가 AI 후보')).toBeUndefined();
  await act(async()=>voteButton(root,'돼지집 서면점').props.onPress());await press(root,'직접 추가');expect(toggleVote).not.toHaveBeenCalled();expect(addVotingItem).not.toHaveBeenCalled();expect(text(root)).not.toContain('식당 직접 추가');expect(request).not.toHaveBeenCalled();
  if(isOwner){await press(root,'약속 확정 다시 시도');await press(root,'다시 확정하기');expect(advanceRoomStage).toHaveBeenCalledWith('room','confirmed');expect(confirmRoomVote).not.toHaveBeenCalled();}else expect(target(root,'약속 확정 다시 시도')).toBeUndefined();
});
it('skips recommendation calls for a mate when confirmedMenu is already saved',async()=>{
  setChatUser({id:'mate'});useMyProfile.mockReturnValue(profileOrigin);useRoom.mockReturnValue({room:{...room,confirmedMenu:'저장한 식당'},reload:jest.fn()});const root=await render(ChatRoomScreen);await act(async()=>root.findByType(VotingSheet).props.onRequestSuggestions());expect(buildPlaceCandidates).not.toHaveBeenCalled();expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
it('does not invoke the recommendation function when the restaurant becomes saved during candidate lookup',async()=>{
  let resolve;useMyProfile.mockReturnValue(profileOrigin);buildPlaceCandidates.mockReturnValue(new Promise(done=>{resolve=done;}));const root=await render(ChatRoomScreen);useRoom.mockReturnValue({room:{...room,confirmedMenu:'저장됨'},reload:jest.fn()});await act(async()=>renderer.update(React.createElement(ChatRoomScreen)));await act(async()=>resolve(aiCandidates));expect(supabase.functions.invoke).not.toHaveBeenCalled();expect(root.findByType(VotingSheet).props.confirmedRestaurant).toBe('저장됨');
});
it('hides literal-name addition during loading and restores it even with search results',async()=>{
  let resolve;searchPlaces.mockReturnValueOnce(new Promise(done=>{resolve=done;}));const root=await render(RealVotingSheet,votingProps());await press(root,'직접 추가');await act(async()=>root.findByType(TextInput).props.onChangeText('입력한 이름'));
  expect(target(root,'이 이름으로 후보 추가')).toBeUndefined();await act(async()=>new Promise(done=>setTimeout(done,380)));expect(target(root,'이 이름으로 후보 추가')).toBeUndefined();await act(async()=>resolve([{id:'found',name:'검색 결과 이름',address:'주소'}]));expect(target(root,'이 이름으로 후보 추가')).toBeDefined();await press(root,'이 이름으로 후보 추가');expect(addVotingItem).toHaveBeenCalledWith('room','menu','입력한 이름');
});
it('requests automatically only once despite title/member changes, including an in-flight request',async()=>{
  let resolve;useMyProfile.mockReturnValue(profileOrigin);buildPlaceCandidates.mockReturnValueOnce(new Promise(done=>{resolve=done;}));supabase.functions.invoke.mockResolvedValue(aiResponse('새 식당'));const root=await render(ChatRoomScreen);
  useRoom.mockReturnValue({room:{...room,title:'변경한 제목',participants:[...members,{profileId:'third',name:'메이트'}]},reload:jest.fn()});await act(async()=>renderer.update(React.createElement(ChatRoomScreen)));await act(async()=>resolve(aiCandidates));expect(buildPlaceCandidates).toHaveBeenCalledTimes(1);expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
  await act(async()=>renderer.update(React.createElement(ChatRoomScreen)));expect(buildPlaceCandidates).toHaveBeenCalledTimes(1);expect(root.findByType(VotingSheet).props.receivedMore).toBe(false);expect(root.findByType(VotingSheet).props.suggestions.every(item=>!item.fresh)).toBe(true);
  buildPlaceCandidates.mockResolvedValue(aiCandidates);await act(async()=>root.findByType(VotingSheet).props.onRequestSuggestions());expect(buildPlaceCandidates).toHaveBeenCalledTimes(2);expect(supabase.functions.invoke).toHaveBeenLastCalledWith('schedule-recommend',{body:{meetingName:'변경한 제목',roomId:'room',placeCandidates:aiCandidates.candidates}});
});
it('uses the same-session cached result after remount without a fresh recommendation or toast',async()=>{
  useMyProfile.mockReturnValue(profileOrigin);buildPlaceCandidates.mockResolvedValue(aiCandidates);supabase.functions.invoke.mockResolvedValue(aiResponse('새 식당'));const first=await render(ChatRoomScreen);expect(first.findByType(VotingSheet).props.receivedMore).toBe(false);await act(async()=>renderer.unmount());renderer=undefined;const second=await render(ChatRoomScreen);expect(buildPlaceCandidates).toHaveBeenCalledTimes(1);expect(second.findByType(VotingSheet).props.receivedMore).toBe(false);expect(second.findByType(VotingSheet).props.suggestions).toEqual([{label:'새 식당',fresh:false}]);
});
it('does not mark a different room automatic result fresh after requesting more in the first room',async()=>{
  useMyProfile.mockReturnValue(profileOrigin);buildPlaceCandidates.mockResolvedValue(aiCandidates);supabase.functions.invoke.mockResolvedValue(aiResponse('새 식당'));const root=await render(ChatRoomScreen);await act(async()=>root.findByType(VotingSheet).props.onRequestSuggestions());navigation.current={name:'ChatRoom',params:{roomId:'second'}};useRoom.mockReturnValue({room:{...room,id:'second'},reload:jest.fn()});await act(async()=>renderer.update(React.createElement(ChatRoomScreen)));expect(root.findByType(VotingSheet).props.receivedMore).toBe(false);expect(root.findByType(VotingSheet).props.suggestions.every(item=>!item.fresh)).toBe(true);expect(buildPlaceCandidates).toHaveBeenCalledTimes(3);
});
it.each(['candidates','recommendations'])('distinguishes zero %s from invocation failure and offers direct addition',async kind=>{
  useMyProfile.mockReturnValue(profileOrigin);buildPlaceCandidates.mockResolvedValue(kind==='candidates'?{candidates:[]}:aiCandidates);supabase.functions.invoke.mockResolvedValue({data:{placeRecommendations:[]},error:null});VotingSheet.mockImplementation(props=>React.createElement(RealVotingSheet,props));const root=await render(ChatRoomScreen);await press(root,'식당 정하기');expect(text(root)).toContain('근처에서 찾은 곳이 없어요');expect(text(root)).toContain('아는 식당을 직접 추가해 주세요');expect(target(root.findByType(RealVotingSheet),'다시 시도')).toBeUndefined();await press(root,'직접 추가');expect(target(root,'식당 직접 추가 닫기')).toBeDefined();if(kind==='candidates')expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
it('announces that voting on an AI suggestion first adds it as a candidate',async()=>{const root=await render(RealVotingSheet,votingProps({suggestions:[{label:'AI 식당'}]}));expect(voteButton(root,'AI 식당').props.accessibilityHint).toBe('후보에 추가하고 투표해요');expect(voteButton(root,'돼지집 서면점').props.accessibilityHint).toBe('다시 누르면 투표를 취소해요');expect(StyleSheet.flatten(voteButton(root,'AI 식당').findAllByType(Text).at(-1).props.style).fontSize).toBeGreaterThanOrEqual(12);});

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const suggestions = root => root.findByType(VotingSheet).props;
async function refreshChat() { await act(async () => renderer.update(React.createElement(ChatRoomScreen))); }
async function leaveChat() { await act(async () => renderer.unmount()); renderer = undefined; }

it.each(['candidates', 'invocation'])('shares an in-flight %s request after leaving and returning', async phase => {
  const pending = deferred();
  useMyProfile.mockReturnValue(profileOrigin);
  buildPlaceCandidates.mockResolvedValue(aiCandidates);
  supabase.functions.invoke.mockResolvedValue(aiResponse('새 식당'));
  if (phase === 'candidates') buildPlaceCandidates.mockReturnValueOnce(pending.promise);
  else supabase.functions.invoke.mockReturnValueOnce(pending.promise);
  await render(ChatRoomScreen);
  await leaveChat();
  const root = await render(ChatRoomScreen);
  expect(suggestions(root).suggestionStatus).toBe('loading');
  await act(async () => pending.resolve(phase === 'candidates' ? aiCandidates : aiResponse('새 식당')));
  expect(suggestions(root).suggestionStatus).toBe('ready');
  expect(suggestions(root).suggestions).toEqual([{ label: '새 식당', fresh: false }]);
  expect(suggestions(root).receivedMore).toBe(false);
  expect(buildPlaceCandidates).toHaveBeenCalledTimes(1);
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});
it.each(['ready', 'error'])('caches %s completion while no screen is subscribed', async result => {
  const pending = deferred();
  useMyProfile.mockReturnValue(profileOrigin); buildPlaceCandidates.mockResolvedValue(aiCandidates);
  supabase.functions.invoke.mockReturnValueOnce(pending.promise);
  await render(ChatRoomScreen); await leaveChat();
  await act(async () => result === 'ready' ? pending.resolve(aiResponse('새 식당')) : pending.reject(Error('offline')));
  const root = await render(ChatRoomScreen);
  expect(suggestions(root).suggestionStatus).toBe(result);
  expect(suggestions(root).receivedMore).toBe(false);
  expect(buildPlaceCandidates).toHaveBeenCalledTimes(1);
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});
it.each([false, true])('keeps automatic requests through foreground profile reset; completed during reset=%s', async duringReset => {
  const pending = deferred();
  useMyProfile.mockReturnValue(profileOrigin); buildPlaceCandidates.mockReturnValueOnce(pending.promise);
  supabase.functions.invoke.mockResolvedValue(aiResponse('새 식당'));
  const root = await render(ChatRoomScreen);
  useMyProfile.mockReturnValue({ bundle: null }); await refreshChat();
  expect(suggestions(root).suggestionStatus).toBe('loading');
  if (duringReset) await act(async () => pending.resolve(aiCandidates));
  useMyProfile.mockReturnValue(profileOrigin); await refreshChat();
  if (!duringReset) await act(async () => pending.resolve(aiCandidates));
  expect(suggestions(root).suggestionStatus).toBe('ready');
  expect(suggestions(root).suggestions).toEqual([{ label: '새 식당', fresh: false }]);
  expect(suggestions(root).receivedMore).toBe(false);
  expect(buildPlaceCandidates).toHaveBeenCalledTimes(1);
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});
it('reuses the cache after the user object changes but its id stays the same', async () => {
  useMyProfile.mockReturnValue(profileOrigin); buildPlaceCandidates.mockResolvedValue(aiCandidates);
  supabase.functions.invoke.mockResolvedValue(aiResponse('새 식당'));
  await render(ChatRoomScreen); await leaveChat();
  setChatUser({ id: 'me', email: 'refreshed' });
  const root = await render(ChatRoomScreen);
  expect(suggestions(root).suggestionStatus).toBe('ready');
  expect(buildPlaceCandidates).toHaveBeenCalledTimes(1);
});
it('isolates user ids and clears the previous user cache on account switches', async () => {
  useMyProfile.mockReturnValue(profileOrigin); buildPlaceCandidates.mockResolvedValue(aiCandidates);
  supabase.functions.invoke.mockResolvedValueOnce(aiResponse('새 식당')).mockResolvedValueOnce(aiResponse('돼지집 서면점'));
  const root = await render(ChatRoomScreen);
  expect(suggestions(root).suggestions[0].label).toBe('새 식당');
  useMyProfile.mockReturnValue({ bundle: null }); setChatUser({ id: 'other' }); await refreshChat();
  expect(suggestions(root).suggestions).toEqual([]);
  useMyProfile.mockReturnValue(profileOrigin); await refreshChat();
  expect(suggestions(root).suggestions).toEqual([{ label: '돼지집 서면점', fresh: false }]);
  useMyProfile.mockReturnValue({ bundle: null }); setChatUser({ id: 'me' }); await refreshChat();
  expect(suggestions(root).suggestions).toEqual([]);
  expect(buildPlaceCandidates).toHaveBeenCalledTimes(2);
});
it.each(['logout', 'switch'])('discards late responses after %s, including returning to the same id', async transition => {
  const pending = deferred();
  useMyProfile.mockReturnValue(profileOrigin); buildPlaceCandidates.mockResolvedValue(aiCandidates);
  supabase.functions.invoke.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(aiResponse('돼지집 서면점'));
  const root = await render(ChatRoomScreen);
  setChatUser(transition === 'logout' ? null : { id: 'other' });
  useMyProfile.mockReturnValue({ bundle: null }); await refreshChat();
  expect(suggestions(root).suggestions).toEqual([]);
  setChatUser({ id: 'me' }); useMyProfile.mockReturnValue(profileOrigin); await refreshChat();
  await act(async () => pending.resolve(aiResponse('새 식당')));
  expect(suggestions(root).suggestions).toEqual([{ label: '돼지집 서면점', fresh: false }]);
  expect(suggestions(root).receivedMore).toBe(false);
  expect(buildPlaceCandidates).toHaveBeenCalledTimes(2);
});
it('does not replay manual fresh-result feedback after leaving during that request', async () => {
  const pending = deferred();
  useMyProfile.mockReturnValue(profileOrigin); buildPlaceCandidates.mockResolvedValue(aiCandidates);
  supabase.functions.invoke.mockResolvedValueOnce(aiResponse('돼지집 서면점')).mockReturnValueOnce(pending.promise);
  const first = await render(ChatRoomScreen);
  await act(async () => suggestions(first).onRequestSuggestions()); await leaveChat();
  const root = await render(ChatRoomScreen);
  await act(async () => pending.resolve(aiResponse('새 식당')));
  expect(suggestions(root).suggestions.every(item => !item.fresh)).toBe(true);
  expect(suggestions(root).receivedMore).toBe(false);
});
it('allows one-character direct addition while reserving place search for two characters', async () => {
  const root = await render(RealVotingSheet, votingProps()); await press(root, '직접 추가');
  expect(text(root)).toContain('식당 이름을 입력해 주세요. 검색은 두 글자부터 가능해요.');
  await act(async () => root.findByType(TextInput).props.onChangeText('밥'));
  expect(target(root, '이 이름으로 후보 추가')).toBeDefined();
  expect(searchPlaces).not.toHaveBeenCalled();
  await press(root, '이 이름으로 후보 추가');
  expect(addVotingItem).toHaveBeenCalledWith('room', 'menu', '밥');
});

it('does not reuse an explicit fresh intent after logout and login with the same id', async () => {
  useMyProfile.mockReturnValue(profileOrigin); buildPlaceCandidates.mockResolvedValue(aiCandidates);
  supabase.functions.invoke.mockResolvedValueOnce(aiResponse('돼지집 서면점')).mockResolvedValueOnce(aiResponse('새 식당')).mockResolvedValueOnce(aiResponse('새 식당'));
  const root = await render(ChatRoomScreen);
  await act(async () => suggestions(root).onRequestSuggestions());
  expect(suggestions(root).receivedMore).toBe(true);
  // The auth event may clear the module while the chat screen has not unmounted yet.
  setRestaurantRecommendationUser(null);
  setRestaurantRecommendationUser('me'); // AuthProvider handles re-login before publishing its context.
  useMyProfile.mockReturnValue({ bundle: null }); await refreshChat();
  useMyProfile.mockReturnValue(profileOrigin); await refreshChat();
  expect(suggestions(root).suggestions).toEqual([{ label: '새 식당', fresh: false }]);
  expect(suggestions(root).receivedMore).toBe(false);
  expect(buildPlaceCandidates).toHaveBeenCalledTimes(3);
});

it.each(['candidates', 'invocation'])('times out stalled %s within a combined 25-second budget, ignores late results and permits retry', async phase => {
  jest.useFakeTimers();
  const candidates = deferred(), invocation = deferred();
  useMyProfile.mockReturnValue(profileOrigin);
  buildPlaceCandidates.mockReturnValueOnce(candidates.promise);
  supabase.functions.invoke.mockReturnValueOnce(invocation.promise);
  const root = await render(ChatRoomScreen);
  await act(async () => jest.advanceTimersByTime(10000));
  if (phase === 'invocation') await act(async () => candidates.resolve(aiCandidates));
  await act(async () => jest.advanceTimersByTime(14999));
  expect(suggestions(root).suggestionStatus).toBe('loading');
  await act(async () => jest.advanceTimersByTime(1));
  expect(suggestions(root).suggestionStatus).toBe('error');
  expect(suggestions(root).suggestionReason).toContain('다시 시도');
  if (phase === 'candidates') {
    await act(async () => candidates.resolve(aiCandidates));
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  } else await act(async () => invocation.resolve(aiResponse('새 식당')));
  expect(suggestions(root).suggestionStatus).toBe('error');
  expect(suggestions(root).suggestions).toEqual([]);
  buildPlaceCandidates.mockResolvedValue(aiCandidates);
  supabase.functions.invoke.mockReset().mockResolvedValue(aiResponse('돼지집 서면점'));
  await act(async () => suggestions(root).onRequestSuggestions());
  expect(suggestions(root).suggestionStatus).toBe('ready');
  expect(suggestions(root).suggestions).toEqual([{ label: '돼지집 서면점', fresh: true }]);
});
it('keeps the same timeout deadline across screen departure and exposes retry on return', async () => {
  jest.useFakeTimers();
  useMyProfile.mockReturnValue(profileOrigin);
  buildPlaceCandidates.mockReturnValueOnce(new Promise(() => {}));
  await render(ChatRoomScreen); await act(async () => jest.advanceTimersByTime(20000));
  await leaveChat();
  const root = await render(ChatRoomScreen);
  await act(async () => jest.advanceTimersByTime(5000));
  expect(suggestions(root).suggestionStatus).toBe('error');
  buildPlaceCandidates.mockResolvedValue(aiCandidates); supabase.functions.invoke.mockResolvedValue(aiResponse('새 식당'));
  VotingSheet.mockImplementation(props => React.createElement(RealVotingSheet, props));
  await refreshChat(); await press(root, '식당 정하기');
  await press(root.findByType(RealVotingSheet), '다시 시도');
  expect(text(root)).toContain('새 식당'); expect(text(root)).not.toContain('추천을 불러오지 못했어요');
  expect(buildPlaceCandidates).toHaveBeenCalledTimes(2);
});
it('leaves cache ownership to AuthProvider when mounting a chat screen', async () => {
  setRestaurantRecommendationUser('other');
  const entry = createRestaurantRecommendation('other', 'saved', 0, { key: 'saved', roomId: 'saved', status: 'ready', items: [], receivedMore: false });
  // The mocked context intentionally lags behind the provider event.
  await render(ChatRoomScreen);
  expect(getRestaurantRecommendation('other', 'saved')).toBe(entry);
});
it('applies the 120-character input limit and disables case-insensitive duplicates in direct input and search results', async () => {
  fetchRoomVoting.mockResolvedValue({ data: [{ id: 'cafe', kind: 'menu', label: 'Cafe', voters: [], mine: false }], memberCount: 2, error: null });
  searchPlaces.mockResolvedValue([{ id: 'found', name: 'CAFE', address: '주소' }]);
  const root = await render(RealVotingSheet, votingProps({ suggestions: [{ label: 'cafe' }] }));
  expect(root.findAllByType(VoteToggle)).toHaveLength(1);
  await press(root, '직접 추가'); expect(root.findByType(TextInput).props.maxLength).toBe(120);
  await act(async () => root.findByType(TextInput).props.onChangeText(' cafe '));
  await act(async () => new Promise(done => setTimeout(done, 380)));
  expect(target(root, '이 이름으로 후보 추가').props.disabled).toBe(true);
  expect(target(root, 'CAFE 추가됨').props.disabled).toBe(true);
  expect(addVotingItem).not.toHaveBeenCalled();
});
it.each([
  ['23505', '이미 같은 이름의 후보가 있어요'],
  ['22023', '후보는 30개까지 추가할 수 있어요'],
  ['42501', '후보를 추가하지 못했어요'],
])('explains add error %s using a safe localized message', async (code, expected) => {
  addVotingItem.mockResolvedValueOnce({ code, message: 'private SQL detail', details: 'private table' });
  const root = await render(RealVotingSheet, votingProps()); await press(root, '직접 추가');
  await act(async () => root.findByType(TextInput).props.onChangeText('밥'));
  await press(root, '이 이름으로 후보 추가');
  expect(text(root)).toContain(expected); expect(text(root)).not.toContain('private');
});
it('validates overlong restaurant names from search results before treating a 22023 response as the option limit', async () => {
  const longName = '가'.repeat(121);
  searchPlaces.mockResolvedValue([{ id: 'long', name: longName, address: '주소' }]);
  const root = await render(RealVotingSheet, votingProps()); await press(root, '직접 추가');
  await act(async () => root.findByType(TextInput).props.onChangeText('검색'));
  await act(async () => new Promise(done => setTimeout(done, 380)));
  await press(root, longName + ' 추가');
  expect(text(root)).toContain('후보 이름은 1~120자로 입력해 주세요');
  expect(addVotingItem).not.toHaveBeenCalled();
});

const accountProfile = { status: 'ready', bundle: { profile: { name: '나야나' }, privateProfile: { bankName: '카카오뱅크', accountNumber: '3333-01-2345678' } }, reload: jest.fn() };
it('shares only the existing code and app instructions through the OS share sheet', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
  const root = await render(MateInviteSheet, { visible: true, code: 'REAL42', onClose: jest.fn() });
  await press(root, '초대 코드 공유');
  expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('초대 코드: REAL42') });
  const shared = share.mock.calls[0][0].message;
  expect(shared).toContain('MEALCHAT 앱'); expect(shared).not.toMatch(/https?:/); expect(shared).not.toContain('3333');
  expect(text(root)).not.toContain('7일'); expect(text(root)).not.toContain('카카오톡'); expect(sendRoomMessage).not.toHaveBeenCalled();
});
it('shows share failure without claiming it was sent, keeping code copy available', async () => {
  jest.spyOn(Share, 'share').mockRejectedValue(Error('native private detail'));
  const copy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
  const root = await render(MateInviteSheet, { visible: true, code: 'REAL42', onClose: jest.fn() });
  await press(root, '초대 코드 공유'); expect(text(root)).toContain('공유 창을 열지 못했어요'); expect(text(root)).not.toContain('private detail');
  await press(root, '초대 코드 복사'); expect(copy).toHaveBeenCalledWith('REAL42'); expect(text(root)).toContain('초대 코드를 복사했어요');
});
it.each([true, false])('opens only copy actions for a long-pressed message; mine=%s', async mine => {
  const copy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
  useRoomMessages.mockReturnValue({ messages: [{ id: 'long', roomId: 'room', senderId: mine ? 'me' : 'mate', senderName: mine ? '나' : '모아', kind: 'user', text: '복사할 내용', createdAt: '2026-09-25T10:00:00Z' }], status: 'ready', reload });
  const root = await render(ChatRoomScreen);
  const expectedLabel = mine ? '나, 복사할 내용' : '모아, 복사할 내용';
  const bubble = root.findAll(node => typeof node.props.onLongPress === 'function' && node.props.accessibilityLabel === expectedLabel)[0];
  expect(bubble).toBeDefined(); expect(bubble.props.accessibilityLabel).toBe(expectedLabel);
  expect(bubble.props.hitSlop).toBeUndefined();
  expect(StyleSheet.flatten(bubble.props.style)).toMatchObject({ minHeight: 44, paddingVertical: 3 });
  expect(StyleSheet.flatten(bubble.props.style).marginTop).toBeUndefined();
  await act(async () => bubble.props.onLongPress());
  expect(target(root, '메시지 복사')).toBeDefined();
  for (const label of ['답장', '삭제', '신고하기', '차단하기']) expect(target(root, label)).toBeUndefined();
  await press(root, '메시지 복사'); expect(copy).toHaveBeenCalledWith('복사할 내용'); expect(text(root)).toContain('메시지를 복사했어요');
});
it('offers the same message menu through accessibilityActions', async () => {
  useRoomMessages.mockReturnValue({ messages: [{ id: 'accessible', roomId: 'room', senderId: 'mate', senderName: '모아', kind: 'user', text: '접근성 메시지', createdAt: '2026-09-25T10:00:00Z' }], status: 'ready', reload });
  const root = await render(ChatRoomScreen);
  const bubble = root.findAll(node => node.props.accessibilityActions?.some(action => action.name === 'showMenu'))[0];
  expect(bubble.props.accessibilityActions).toEqual([{ name: 'showMenu', label: '복사 메뉴 열기' }]);
  await act(async () => bubble.props.onAccessibilityAction({ nativeEvent: { actionName: 'showMenu' } }));
  expect(target(root, '메시지 복사')).toBeDefined();
});
it('keeps the member-to-invitation flow inside one modal and returns to members on close', async () => {
  const { Modal } = require('react-native'); const close = jest.fn();
  const root = await render(MembersSheet, { visible: true, participants: members, code: 'REAL42', myId: 'me', ownerId: 'me', onClose: close });
  await press(root, '＋ 메이트 초대'); expect(root.findAllByType(Modal).filter(node => node.props.visible)).toHaveLength(1);
  await press(root, '닫기'); expect(text(root)).toContain('멤버 2명'); expect(close).not.toHaveBeenCalled();
  await press(root, '닫기'); expect(close).toHaveBeenCalledTimes(1);
});
it('creates a settlement with the same API payload, without sending client participant selections', async () => {
  useMyProfile.mockReturnValue(accountProfile); const close = jest.fn(), changed = jest.fn();
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', participants: members, onClose: close, onStateChanged: changed });
  await act(async () => root.findByType(TextInput).props.onChangeText('52,000'));
  expect(root.findAll(node => node.props.accessibilityRole === 'checkbox')).toHaveLength(0);
  expect(text(root)).toContain('요청 후 표시');
  expect(text(root)).toContain('•••• 5678'); expect(text(root)).not.toContain('3333-01-2345678');
  await press(root, '정산 요청 보내기');
  expect(createRoomSettlement).toHaveBeenCalledWith({ roomId: 'room', title: '식사 정산', amount: 52000, bankName: '카카오뱅크', accountNumber: '3333-01-2345678', accountHolder: '나야나' });
  expect(changed).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
});
it('blocks requests without an account and preserves the amount when opening the existing profile editor', async () => {
  useMyProfile.mockReturnValue({ status: 'ready', bundle: { profile: { name: '나' }, privateProfile: {} }, reload: jest.fn() });
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', participants: members, onClose: jest.fn() });
  await act(async () => root.findByType(TextInput).props.onChangeText('52000'));
  expect(text(root)).toContain('받을 계좌가 아직 없어요'); expect(target(root, '계좌를 먼저 등록해 주세요').props.disabled).toBe(true);
  await press(root, '계좌 등록하기');
  expect(navigation.replace).toHaveBeenCalledWith('ChatRoom', expect.objectContaining({ roomId: 'room', openSheet: 'settlement', settlementAmountText: '52000', awaitingSettlementAccount: true }));
  expect(navigation.navigate).toHaveBeenCalledWith('ProfileEdit'); expect(createRoomSettlement).not.toHaveBeenCalled();
});
it('reads the profile on sheet entry and shows real registration feedback only once an account is available', async () => {
  const refresh = jest.fn(); navigation.current.params = { roomId: 'room', settlementAmountText: '52000', awaitingSettlementAccount: true };
  useMyProfile.mockReturnValue({ status: 'loading', bundle: null, reload: refresh });
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn() });
  expect(refresh).toHaveBeenCalledTimes(1); expect(text(root)).toContain('받을 계좌를 확인하고 있어요'); expect(text(root)).not.toContain('받을 계좌가 아직 없어요');
  useMyProfile.mockReturnValue({ ...accountProfile, reload: refresh });
  await act(async () => renderer.update(React.createElement(RealSettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn() })));
  expect(text(root)).toContain('계좌를 등록했어요'); expect(target(root, '정산 요청 보내기').props.disabled).toBe(false);
});
it('retains the existing bill split and completion contract while preventing edits by a mate', async () => {
  useMyProfile.mockReturnValue(accountProfile);
  fetchRoomSettlements.mockResolvedValue({ data: [{ id: 'bill', creatorId: 'mate', totalAmount: 52000, splitCount: 4, members: [{ id: 'mine', profileId: 'me', name: '나', isCompleted: false }, { id: 'other', profileId: 'mate', name: '모아', isCompleted: true }] }], error: null });
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn() });
  expect(text(root)).toContain('13,000원'); expect(text(root)).toContain('3333-01-2345678'); expect(root.findByType(TextInput).props.editable).toBe(false);
  expect(require('../src/lib/settlements').fetchSettlementPaymentDetails).toHaveBeenCalledWith('bill');
  expect(target(root, '정산 내용 수정')).toBeUndefined(); await press(root, '나 (나), 대기');
  expect(completeSheetMember).not.toHaveBeenCalled(); expect(text(root)).toContain('13,000원');
  const { Modal } = require('react-native'); expect(root.findAllByType(Modal).filter(node => node.props.visible)).toHaveLength(1);
  await press(root, '아직이요'); expect(completeSheetMember).not.toHaveBeenCalled();
  await press(root, '나 (나), 대기'); await press(root, '보냈어요');
  expect(completeSheetMember).toHaveBeenCalledWith('mine', true); expect(createRoomSettlement).not.toHaveBeenCalled();
});
it('blocks settlement creation after a fetch failure and offers retry', async () => {
  useMyProfile.mockReturnValue(accountProfile); fetchRoomSettlements.mockResolvedValueOnce({ data: null, error: Error('private detail') });
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn() });
  expect(text(root)).toContain('정산을 불러오지 못했어요'); expect(text(root)).not.toContain('private detail');
  expect(target(root, '정산 요청 보내기').props.disabled).toBe(true); await press(root, '다시 시도'); expect(fetchRoomSettlements).toHaveBeenCalledTimes(2);
});

it.each([null, ''])('hides the detail invitation without a usable room code: %s', async code => {
  useRoom.mockReturnValue({ room: { ...room, code }, status: 'ready', reload });
  const root = await render(RoomDetailScreen);
  expect(target(root, '메이트 초대')).toBeUndefined(); expect(target(root, '초대 코드 공유')).toBeUndefined();
  expect(text(root)).toContain('코드를 불러오지 못했어요');
});
const sheetBill = (overrides = {}) => ({ id: 'bill', creatorId: 'mate', accountHolder: '모아', totalAmount: 52000, splitCount: 4, members: [{ id: 'mine', profileId: 'me', name: '나', isCompleted: false }, { id: 'other', profileId: 'mate', name: '모아', isCompleted: false }], ...overrides });
it('keeps a completed creator bill read-only without a payment fetch, profile account or edit action', async () => {
  const bill = sheetBill({ creatorId: 'me' });
  bill.members = bill.members.map(member => ({ ...member, isCompleted: true }));
  fetchRoomSettlements.mockResolvedValue({ data: [bill], error: null }); useMyProfile.mockReturnValue(accountProfile);
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn() });
  expect(root.findByType(TextInput).props.editable).toBe(false);
  expect(text(root)).toContain('정산이 끝났어요. 되돌릴 수 없어요.');
  expect(text(root)).not.toContain('받을 계좌:');
  expect(text(root)).not.toContain('정산을 요청하면 이 계좌를');
  expect(target(root, '정산 내용 수정')).toBeUndefined();
  expect(target(root, '계좌 복사')).toBeUndefined();
  expect(target(root, '토스로 보내기')).toBeUndefined();
  expect(require('../src/lib/settlements').fetchSettlementPaymentDetails).not.toHaveBeenCalled();
});
it.each([['creator', true], ['undo', false]])('preserves immediate completion behavior for %s', async (kind, expected) => {
  const bill = sheetBill(kind === 'creator' ? { creatorId: 'me' } : { members: [{ id: 'mine', profileId: 'me', name: '나', isCompleted: true }, { id: 'other', profileId: 'mate', name: '모아', isCompleted: false }] });
  fetchRoomSettlements.mockResolvedValue({ data: [bill], error: null }); useMyProfile.mockReturnValue(accountProfile);
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn() });
  await press(root, kind === 'creator' ? '나 (나), 대기' : '나 (나), 완료');
  expect(completeSheetMember).toHaveBeenCalledWith('mine', expected); expect(target(root, '보냈어요')).toBeUndefined();
});
it('keeps sender confirmation open on permission failure, hides backend details, and supports retry', async () => {
  fetchRoomSettlements.mockResolvedValue({ data: [sheetBill()], error: null });
  completeSheetMember.mockResolvedValueOnce({ code: '42501', message: 'private SQL detail' }); const changed = jest.fn();
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn(), onStateChanged: changed });
  await press(root, '나 (나), 대기'); expect(text(root)).toContain('모아에게'); await press(root, '보냈어요');
  expect(text(root)).toContain('정산 내용은 만든 사람만 수정할 수 있어요.'); expect(text(root)).not.toContain('private'); expect(changed).not.toHaveBeenCalled();
  await press(root, '보냈어요'); expect(completeSheetMember).toHaveBeenCalledTimes(2); expect(changed).toHaveBeenCalledTimes(1); expect(target(root, '보냈어요')).toBeUndefined();
});
it('blocks duplicate sender confirmation and cancellation while the completion call is pending', async () => {
  fetchRoomSettlements.mockResolvedValue({ data: [sheetBill()], error: null }); let finish;
  completeSheetMember.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn() });
  await press(root, '나 (나), 대기'); const confirm = target(root, '보냈어요');
  await act(async () => { confirm.props.onPress(); confirm.props.onPress(); });
  expect(completeSheetMember).toHaveBeenCalledTimes(1); expect(target(root, '아직이요').props.disabled).toBe(true);
  await press(root, '아직이요'); expect(text(root)).toContain('보냈나요?');
  await act(async () => finish(null)); expect(target(root, '보냈어요')).toBeUndefined();
});
it('returns from sender confirmation on the sheet back action without mutating a settlement', async () => {
  fetchRoomSettlements.mockResolvedValue({ data: [sheetBill()], error: null }); const close = jest.fn();
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', onClose: close }); await press(root, '나 (나), 대기');
  const { Modal } = require('react-native'); await act(async () => root.findByType(Modal).props.onRequestClose());
  expect(text(root)).toContain('N빵 정산'); expect(completeSheetMember).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
});

it.each([[4, 13000], [3, 17334], [0, 52000]])('uses loaded server total and split count for confirmation after a returned draft (split=%s)', async (splitCount, expected) => {
  navigation.current.params = { roomId: 'room', settlementAmountText: '70000', awaitingSettlementAccount: true };
  fetchRoomSettlements.mockResolvedValue({ data: [sheetBill({ splitCount })], error: null });
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn() });
  expect(root.findByType(TextInput).props.value).toBe('52,000');
  expect(navigation.current.params.settlementAmountText).toBe('70000');
  await press(root, '나 (나), 대기');
  expect(text(root)).toContain(expected.toLocaleString('ko-KR') + '원');
  expect(text(root)).not.toContain('17,500원'); expect(completeSheetMember).not.toHaveBeenCalled();
  await press(root, '보냈어요'); expect(completeSheetMember).toHaveBeenCalledWith('mine', true);
});
it('keeps the returned creation amount only when no server settlement exists', async () => {
  navigation.current.params = { roomId: 'room', settlementAmountText: '70000', awaitingSettlementAccount: true };
  useMyProfile.mockReturnValue(accountProfile);
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn() });
  expect(root.findByType(TextInput).props.value).toBe('70,000');
  await press(root, '정산 요청 보내기'); expect(createRoomSettlement).toHaveBeenCalledWith(expect.objectContaining({ amount: 70000 }));
});
it.each([
  ['3333-01-2345678', '•••• 5678', '계좌 끝자리 5678'],
  ['12-34', '•••• 1234', '계좌 끝자리 1234'],
  ['123', '계좌 등록됨', '계좌 등록됨'],
  ['12-3', '계좌 등록됨', '계좌 등록됨'],
])('exposes a safe account display and spoken label for %s', async (accountNumber, display, label) => {
  useMyProfile.mockReturnValue({ ...accountProfile, bundle: { ...accountProfile.bundle, privateProfile: { bankName: '카카오뱅크', accountNumber } } });
  const root = await render(RealSettlementSheet, { visible: true, roomId: 'room', onClose: jest.fn() });
  const accountText = root.findAllByType(Text).find(node => node.props.accessibilityLabel === label);
  expect(accountText).toBeDefined(); expect(accountText.props.children).toContain(display);
  if (accountNumber.replace(/\D/g, '').length < 4) expect(text(root)).not.toContain('••••');
});
