const React = require('react');
const { act, create } = require('react-test-renderer');
const { FlatList, TextInput } = require('react-native');

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'me' } }),
}));
jest.mock('../src/navigation/NavigationContext', () => ({
  useNavigation: () => ({
    goBack: jest.fn(), navigate: jest.fn(), current: { params: { roomId: 'room-test' } },
  }),
}));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: () => ({ bundle: null }) }));
jest.mock('../src/rooms/useMyRooms', () => ({ useRoom: jest.fn(), useRoomMessages: jest.fn() }));
jest.mock('../src/lib/rooms', () => ({ sendRoomMessage: jest.fn(), sendRoomSticker: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('../src/lib/placeCandidates', () => ({ buildPlaceCandidates: jest.fn() }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn(), confirmAction: jest.fn() }));
jest.mock('../src/theme/keyboard', () => ({
  useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/components/Avatar', () => 'Avatar');
jest.mock('../src/screens/chat/ChatRoomSheets', () => ({
  MembersSheet: () => null, SettlementSheet: () => null,
}));
jest.mock('../src/screens/chat/ScheduleSheet', () => () => null);
jest.mock('../src/screens/chat/VotingSheet', () => () => null);

const { default: ChatRoomScreen, toDisplayMessages } = require('../src/screens/chat/ChatRoomScreen');
const { useRoom, useRoomMessages } = require('../src/rooms/useMyRooms');
const { sendRoomMessage } = require('../src/lib/rooms');
const { notify } = require('../src/lib/confirm');

const message = (id, overrides = {}) => ({
  id, roomId: 'room-test', senderId: 'me', senderName: 'Tester', senderColor: '#000000',
  text: id, createdAt: '2026-10-02T10:00:00Z', kind: 'user', ...overrides,
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

let renderer;
let reload;
beforeEach(() => {
  jest.clearAllMocks();
  reload = jest.fn();
  useRoom.mockReturnValue({ room: null, reload: jest.fn() });
  useRoomMessages.mockReturnValue({ messages: [], status: 'ready', reload });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
});
async function mount() {
  await act(async () => { renderer = create(React.createElement(ChatRoomScreen)); });
}
function input() { return renderer.root.findByType(TextInput); }
async function type(text) {
  await act(async () => input().props.onChangeText(text));
}

describe('chat submission', () => {
  it('sends once for repeated keyboard submits before and after the state update', async () => {
    const request = deferred();
    sendRoomMessage.mockReturnValue(request.promise);
    await mount();
    await type('  hello  ');
    let submitted;
    await act(async () => {
      const submit = input().props.onSubmitEditing;
      submitted = submit();
      void submit();
    });
    await act(async () => { void input().props.onSubmitEditing(); });
    expect(sendRoomMessage).toHaveBeenCalledTimes(1);
    expect(sendRoomMessage).toHaveBeenCalledWith('room-test', 'hello');
    await act(async () => { request.resolve(null); await submitted; });
    expect(input().props.value).toBe('');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('preserves the next draft when an earlier send finishes', async () => {
    const request = deferred();
    sendRoomMessage.mockReturnValue(request.promise);
    await mount();
    await type('first');
    let submitted;
    await act(async () => { submitted = input().props.onSubmitEditing(); });
    await type('next');
    await act(async () => { request.resolve(null); await submitted; });
    expect(input().props.value).toBe('next');
  });

  it('preserves a newly typed draft even when it matches the submitted text', async () => {
    const request = deferred();
    sendRoomMessage.mockReturnValue(request.promise);
    await mount();
    await type('same');
    let submitted;
    await act(async () => { submitted = input().props.onSubmitEditing(); });
    await type('');
    await type('same');
    await act(async () => { request.resolve(null); await submitted; });
    expect(input().props.value).toBe('same');
  });

  it.each(['returned', 'thrown'])('keeps a failed draft and allows retry after a %s error', async (mode) => {
    const failure = new Error('offline');
    if (mode === 'returned') sendRoomMessage.mockResolvedValueOnce(failure);
    else sendRoomMessage.mockRejectedValueOnce(failure);
    sendRoomMessage.mockResolvedValueOnce(null);
    await mount();
    await type('retry me');
    await act(async () => { await input().props.onSubmitEditing(); });
    expect(input().props.value).toBe('retry me');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    await act(async () => { await input().props.onSubmitEditing(); });
    expect(sendRoomMessage).toHaveBeenCalledTimes(2);
    expect(input().props.value).toBe('');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('chat list', () => {
  it('keeps message and date keys stable when earlier history is added', () => {
    const today = message('today');
    const earlier = message('earlier', { createdAt: '2026-10-01T10:00:00Z' });
    const original = toDisplayMessages([today], 'me', new Map());
    const extended = toDisplayMessages([earlier, today], 'me', new Map());
    expect(extended.slice(-2).map((row) => row.key)).toEqual(original.map((row) => row.key));
    expect(new Set(extended.map((row) => row.key)).size).toBe(extended.length);
  });

  it('retains chronological sender grouping before inversion and breaks it at a date', () => {
    const rows = toDisplayMessages([
      message('one'), message('two'),
      message('tomorrow', { createdAt: '2026-10-03T10:00:00Z' }),
    ], 'me', new Map());
    expect(rows.map((row) => row.kind)).toEqual(['date', 'msg', 'msg', 'date', 'msg']);
    expect(rows[1].showTime).toBe(false);
    expect(rows[2].grouped).toBe(true);
    expect(rows[2].showTime).toBe(true);
    expect(rows[4].grouped).toBeUndefined();
  });

  it('starts at the latest message and virtualizes a long conversation', async () => {
    useRoomMessages.mockReturnValue({
      messages: Array.from({ length: 1000 }, (_, i) => message(`message-${i}`)),
      status: 'ready', reload,
    });
    await mount();
    const list = renderer.root.findByType(FlatList);
    expect(list.props.inverted).toBe(true);
    expect(list.props.data[0].key).toBe('message-999');
    const renderedMessages = renderer.root.findAll((node) => node.props.message?.kind === 'msg');
    expect(renderedMessages.length).toBeGreaterThan(0);
    expect(renderedMessages.length).toBeLessThan(100);
    const before = list.props;
    await type('draft');
    const after = renderer.root.findByType(FlatList).props;
    expect(after.data).toBe(before.data);
    expect(after.renderItem).toBe(before.renderItem);
  });

  it('does not force the user back to the latest message while reading history', async () => {
    await mount();
    const list = renderer.root.findByType(FlatList);
    const scroll = jest.spyOn(list.instance, 'scrollToOffset').mockImplementation(() => {});
    const history = { nativeEvent: { contentOffset: { y: 1000 } } };
    list.props.onScrollBeginDrag(history);
    list.props.onScroll(history);
    list.props.onScrollEndDrag(history);
    list.props.onLayout();
    list.props.onContentSizeChange();
    expect(scroll).not.toHaveBeenCalled();
    const latest = { nativeEvent: { contentOffset: { y: 0 } } };
    list.props.onScrollBeginDrag(latest);
    list.props.onScrollEndDrag(latest);
    list.props.onContentSizeChange();
    expect(scroll).toHaveBeenCalledWith({ offset: 0, animated: false });
    scroll.mockRestore();
  });

  it('follows the latest message after native anchor and keyboard layout adjustments', async () => {
    await mount();
    const list = renderer.root.findByType(FlatList);
    const scroll = jest.spyOn(list.instance, 'scrollToOffset').mockImplementation(() => {});
    list.props.onScroll({ nativeEvent: { contentOffset: { y: 250 } } });
    list.props.onLayout();
    list.props.onContentSizeChange();
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(scroll).toHaveBeenLastCalledWith({ offset: 0, animated: false });
    scroll.mockRestore();
  });

  it('preserves history reached by momentum through subsequent layout changes', async () => {
    await mount();
    const list = renderer.root.findByType(FlatList);
    const scroll = jest.spyOn(list.instance, 'scrollToOffset').mockImplementation(() => {});
    list.props.onMomentumScrollBegin();
    list.props.onScroll({ nativeEvent: { contentOffset: { y: 500 } } });
    list.props.onLayout();
    list.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { y: 1000 } } });
    list.props.onLayout();
    list.props.onContentSizeChange();
    expect(scroll).not.toHaveBeenCalled();
    scroll.mockRestore();
  });
});

describe('chat status and stickers', () => {
  it.each([
    ['loading', '메시지를 불러오는 중...'],
    ['error', '메시지를 불러오지 못했어요'],
    ['ready', '아직 대화가 없어요. 먼저 인사해 보세요!'],
  ])('shows the %s state', async (status, label) => {
    useRoomMessages.mockReturnValue({ messages: [], status, reload });
    await mount();
    const matches = renderer.root.findAll((node) => node.props.children === label);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shares the in-flight guard between sticker picks and text submissions', async () => {
    const { sendRoomSticker } = require('../src/lib/rooms');
    const EmoticonPanel = require('../src/screens/chat/EmoticonPanel').default;
    const request = deferred();
    sendRoomSticker.mockReturnValue(request.promise);
    sendRoomMessage.mockResolvedValue(null);
    await mount();
    await type('after sticker');
    const button = renderer.root.findAll((node) =>
      node.props.accessibilityLabel === '이모티콘 선택' && typeof node.props.onPress === 'function')[0];
    await act(async () => button.props.onPress());
    const pick = renderer.root.findByType(EmoticonPanel).props.onPick;
    await act(async () => {
      pick({ id: 'dudu-love' });
      pick({ id: 'dudu-love' });
      void input().props.onSubmitEditing();
    });
    expect(sendRoomSticker).toHaveBeenCalledTimes(1);
    expect(sendRoomMessage).not.toHaveBeenCalled();
    expect(input().props.value).toBe('after sticker');
    await act(async () => { request.resolve(null); await request.promise; });
    await act(async () => { await input().props.onSubmitEditing(); });
    expect(sendRoomMessage).toHaveBeenCalledWith('room-test', 'after sticker');
  });
});
