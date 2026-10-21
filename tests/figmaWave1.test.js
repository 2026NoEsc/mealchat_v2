process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';

const React = require('react');
const { act, create } = require('react-test-renderer');
const { Image, StyleSheet, Text } = require('react-native');

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const Context = React.createContext({ top: 24, bottom: 20, left: 0, right: 0 });
  return {
    SafeAreaProvider: ({ children }) => React.createElement(Context.Provider, { value: { top: 32, bottom: 48, left: 0, right: 0 } }, children),
    useSafeAreaInsets: () => React.useContext(Context),
  };
});
jest.mock('../src/theme/insets', () => ({
  useTopInset: () => 24,
  useBottomInset: () => 20,
}));

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));
jest.mock('../src/navigation/NavigationContext', () => ({
  useNavigation: jest.fn(),
}));
jest.mock('../src/rooms/useMyRooms', () => ({
  useRoom: jest.fn(),
}));
jest.mock('../src/lib/profile', () => ({
  fetchVisibleProfile: jest.fn(),
}));
jest.mock('../src/lib/friends', () => ({
  fetchMyFriends: jest.fn(),
  addFriend: jest.fn(),
}));
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { useAuth } = require('../src/auth/AuthProvider');
const { useNavigation } = require('../src/navigation/NavigationContext');
const { useRoom } = require('../src/rooms/useMyRooms');
const { fetchVisibleProfile } = require('../src/lib/profile');
const { fetchMyFriends, addFriend } = require('../src/lib/friends');

const MateProfileSheet = require('../src/components/ui/MateProfileSheet').default;
const RoomDetailScreen = require('../src/screens/chat/RoomDetailScreen').default;
const SignupStartScreen = require('../src/screens/signup/SignupStartScreen').default;
const LoginScreen = require('../src/screens/LoginScreen').default;
const NotificationPanel = require('../src/components/NotificationPanel').default;
const { noticeIcon, noticeKind } = require('../src/components/NotificationPanel');
const { AppHeader } = require('../src/components/ui/AppHeader');
const { AuthTopBar } = require('../src/components/ui/AuthLayout');
const { CalendarDays, Receipt } = require('lucide-react-native');

const h = React.createElement;
let renderer;

async function render(component, props) {
  await act(async () => {
    renderer = create(h(component, props));
  });
  return renderer.root;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer.unmount());
  }
  renderer = undefined;
});

describe('1. MateProfileSheet (메이트 프로필 시트: 628-2832, 638-12723)', () => {
  it('renders public fields only, forwards roomId, and hides bank_account even if present in server response', async () => {
    fetchVisibleProfile.mockResolvedValueOnce({
      data: {
        profile: {
          id: 'user-moa',
          name: '모아',
          tag: 'user-moa-tag',
          avatar_color: '#FF9900',
          avatar_url: null,
        },
        relationship: 'room_mate',
        fields: {
          bio: '오늘도 맛있는 하루',
          birthdate: '2000-01-01',
          gender: 'female',
          bank_account: { bank_name: '카카오뱅크', account_number: '3333-01-1234567' },
        },
      },
      error: null,
    });
    fetchMyFriends.mockResolvedValueOnce({ data: [], error: null });

    const root = await render(MateProfileSheet, {
      visible: true,
      profileId: 'user-moa',
      roomId: 'room-abc',
      myId: 'user-self',
      onClose: jest.fn(),
    });

    expect(fetchVisibleProfile).toHaveBeenCalledWith('user-moa', 'room-abc');

    const allTexts = root.findAllByType(Text).map((t) => t.props.children).flat().filter(Boolean);
    const joinedText = allTexts.join(' ');

    // Name & Bio
    expect(joinedText).toContain('모아');
    expect(joinedText).toContain('오늘도 맛있는 하루');

    // Public fields
    expect(joinedText).toContain('생년월일');
    expect(joinedText).toContain('2000년 1월 1일');
    expect(joinedText).toContain('성별');
    expect(joinedText).toContain('여성');

    // Subtitle for mate
    expect(joinedText).toContain('정보 공개 범위는 모아님이 정해요.');

    // Prohibited: bank_account must NEVER be displayed even if present in server response
    expect(joinedText).not.toContain('계좌');
    expect(joinedText).not.toContain('카카오뱅크');
    expect(joinedText).not.toContain('3333-01-1234567');
    expect(joinedText).not.toContain('신고');
    expect(joinedText).not.toContain('차단');
    expect(joinedText).not.toContain('함께 먹은');
    expect(joinedText).not.toContain('학과');
  });

  it('renders "공개 안 함" when fields are omitted by server for room_mate', async () => {
    fetchVisibleProfile.mockResolvedValueOnce({
      data: {
        profile: {
          id: 'user-hidden',
          name: '비공개메이트',
          tag: 'hidden',
          avatar_color: '#444',
          avatar_url: null,
        },
        relationship: 'room_mate',
        fields: {},
      },
      error: null,
    });
    fetchMyFriends.mockResolvedValueOnce({ data: [], error: null });

    const root = await render(MateProfileSheet, {
      visible: true,
      profileId: 'user-hidden',
      myId: 'user-self',
      onClose: jest.fn(),
    });

    const allTexts = root.findAllByType(Text).map((t) => t.props.children).flat().filter(Boolean);
    const joinedText = allTexts.join(' ');

    // Figma requirement: rows exist with "공개 안 함"
    expect(joinedText).toContain('생년월일');
    expect(joinedText).toContain('성별');
    expect(joinedText).toContain('공개 안 함');

    // Forbidden fields
    expect(joinedText).not.toContain('계좌');
    expect(joinedText).not.toContain('신고');
    expect(joinedText).not.toContain('차단');
  });

  it('hides info card entirely when relationship is identity_only', async () => {
    fetchVisibleProfile.mockResolvedValueOnce({
      data: {
        profile: {
          id: 'user-other',
          name: '외부인',
          tag: 'other',
          avatar_color: '#555',
          avatar_url: null,
        },
        relationship: 'identity_only',
        fields: {},
      },
      error: null,
    });
    fetchMyFriends.mockResolvedValueOnce({ data: [], error: null });

    const root = await render(MateProfileSheet, {
      visible: true,
      profileId: 'user-other',
      myId: 'user-self',
      onClose: jest.fn(),
    });

    const allTexts = root.findAllByType(Text).map((t) => t.props.children).flat().filter(Boolean);
    const joinedText = allTexts.join(' ');

    // Name & tag exist
    expect(joinedText).toContain('외부인');
    // Personal info rows should NOT be rendered for identity_only
    expect(joinedText).not.toContain('생년월일');
    expect(joinedText).not.toContain('성별');
    expect(joinedText).not.toContain('계좌');
    expect(joinedText).not.toContain('정보 공개 범위');
  });

  it('shows self profile edit CTA, hides bio and info card, and deletes "다른 메이트에게는 이렇게 보여요." when viewed for self', async () => {
    fetchVisibleProfile.mockResolvedValueOnce({
      data: {
        profile: {
          id: 'user-self',
          name: '나야나',
          tag: 'nayana',
          avatar_color: '#23A455',
          avatar_url: null,
        },
        relationship: 'self',
        fields: {
          bio: '삼겹살이면 어디든',
          birthdate: '1995-05-05',
          gender: 'male',
        },
      },
      error: null,
    });

    const onEditProfile = jest.fn();
    const onClose = jest.fn();

    const root = await render(MateProfileSheet, {
      visible: true,
      profileId: 'user-self',
      myId: 'user-self',
      onClose,
      onEditProfile,
    });

    const allTexts = root.findAllByType(Text).map((t) => t.props.children).flat().filter(Boolean);
    const joinedText = allTexts.join(' ');

    // Self requirement 1: "다른 메이트에게는 이렇게 보여요." deleted
    expect(joinedText).not.toContain('다른 메이트에게는 이렇게 보여요.');
    // Self requirement 2: bio hidden because server returns private values
    expect(joinedText).not.toContain('삼겹살이면 어디든');
    // Self requirement 3: edit CTA present
    expect(joinedText).toContain('내 프로필 수정');

    // Must NOT leak other private values in self view
    expect(joinedText).not.toContain('생년월일');
    expect(joinedText).not.toContain('1995년 5월 5일');
    expect(joinedText).not.toContain('성별');
    expect(joinedText).not.toContain('친구 추가');

    const editBtn = root.findAll((n) => n.props.accessibilityLabel === '내 프로필 수정')[0];
    await act(async () => {
      editBtn.props.onPress();
    });
    expect(onEditProfile).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles friend addition for other mates and switches to "이미 친구" on success', async () => {
    fetchVisibleProfile.mockResolvedValueOnce({
      data: {
        profile: { id: 'user-mate', name: '새친구', tag: 'new', avatar_color: '#FF9900', avatar_url: null },
        relationship: 'room_mate',
        fields: {},
      },
      error: null,
    });
    fetchMyFriends.mockResolvedValueOnce({ data: [], error: null });
    addFriend.mockResolvedValueOnce(null);

    const root = await render(MateProfileSheet, {
      visible: true,
      profileId: 'user-mate',
      myId: 'user-self',
      onClose: jest.fn(),
    });

    const addBtn = root.findAll((n) => n.props.accessibilityLabel === '친구 추가')[0];
    expect(addBtn).toBeDefined();

    await act(async () => {
      addBtn.props.onPress();
    });

    expect(addFriend).toHaveBeenCalledWith('user-self', 'user-mate');
    const friendBtn = root.findAll((n) => n.props.accessibilityLabel === '이미 친구')[0];
    expect(friendBtn).toBeDefined();
  });

  it('switches to "이미 친구" when addFriend returns duplicate code 23505', async () => {
    fetchVisibleProfile.mockResolvedValueOnce({
      data: {
        profile: { id: 'user-dup', name: '중복친구', tag: 'dup', avatar_color: '#FF9900', avatar_url: null },
        relationship: 'room_mate',
        fields: {},
      },
      error: null,
    });
    fetchMyFriends.mockResolvedValueOnce({ data: [], error: null });
    addFriend.mockResolvedValueOnce({ code: '23505', message: 'duplicate key value' });

    const root = await render(MateProfileSheet, {
      visible: true,
      profileId: 'user-dup',
      myId: 'user-self',
      onClose: jest.fn(),
    });

    const addBtn = root.findAll((n) => n.props.accessibilityLabel === '친구 추가')[0];
    await act(async () => {
      addBtn.props.onPress();
    });

    const friendBtn = root.findAll((n) => n.props.accessibilityLabel === '이미 친구')[0];
    expect(friendBtn).toBeDefined();
  });

  it('shows error notice and stays un-friended when addFriend fails with non-23505 error', async () => {
    fetchVisibleProfile.mockResolvedValueOnce({
      data: {
        profile: { id: 'user-fail', name: '실패친구', tag: 'fail', avatar_color: '#FF9900', avatar_url: null },
        relationship: 'room_mate',
        fields: {},
      },
      error: null,
    });
    fetchMyFriends.mockResolvedValueOnce({ data: [], error: null });
    addFriend.mockResolvedValueOnce({ code: '42501', message: 'permission denied' });

    const root = await render(MateProfileSheet, {
      visible: true,
      profileId: 'user-fail',
      myId: 'user-self',
      onClose: jest.fn(),
    });

    const addBtn = root.findAll((n) => n.props.accessibilityLabel === '친구 추가')[0];
    await act(async () => {
      addBtn.props.onPress();
    });

    const allTexts = root.findAllByType(Text).map((t) => t.props.children).flat().filter(Boolean);
    expect(allTexts.join(' ')).toContain('친구를 추가하지 못했어요. 잠시 후 다시 시도해 주세요.');

    const friendBtn = root.findAll((n) => n.props.accessibilityLabel === '이미 친구');
    expect(friendBtn).toHaveLength(0);
  });

  it('shows retry button when friend check fails and recovers upon retry', async () => {
    fetchVisibleProfile.mockResolvedValue({
      data: {
        profile: { id: 'user-retry', name: '재시도친구', tag: 'retry', avatar_color: '#FF9900', avatar_url: null },
        relationship: 'room_mate',
        fields: {},
      },
      error: null,
    });
    // First attempt fails
    fetchMyFriends.mockResolvedValueOnce({ data: null, error: new Error('Network error') });

    const root = await render(MateProfileSheet, {
      visible: true,
      profileId: 'user-retry',
      myId: 'user-self',
      onClose: jest.fn(),
    });

    const allTexts = root.findAllByType(Text).map((t) => t.props.children).flat().filter(Boolean);
    expect(allTexts.join(' ')).toContain('친구 상태를 불러오지 못했어요.');

    const retryFriendBtn = root.findAll((n) => n.props.accessibilityLabel === '친구 상태 다시 확인')[0];
    expect(retryFriendBtn).toBeDefined();

    // Second attempt succeeds
    fetchMyFriends.mockResolvedValueOnce({ data: [], error: null });
    await act(async () => {
      retryFriendBtn.props.onPress();
    });

    const addBtn = root.findAll((n) => n.props.accessibilityLabel === '친구 추가')[0];
    expect(addBtn).toBeDefined();
  });

  it('hides friend button when profileId is null (e.g., deleted mate)', async () => {
    const root = await render(MateProfileSheet, {
      visible: true,
      profileId: null,
      myId: 'user-self',
      onClose: jest.fn(),
    });

    const buttons = root.findAll((n) =>
      n.props.accessibilityLabel === '친구 추가' || n.props.accessibilityLabel === '이미 친구'
    );
    expect(buttons).toHaveLength(0);
  });

  it('shows error card and retry button when fetchVisibleProfile fails', async () => {
    fetchVisibleProfile.mockResolvedValueOnce({
      data: null,
      error: new Error('Network failure'),
    });
    fetchMyFriends.mockResolvedValueOnce({ data: [], error: null });

    const root = await render(MateProfileSheet, {
      visible: true,
      profileId: 'user-err',
      myId: 'user-self',
      onClose: jest.fn(),
    });

    const allTexts = root.findAllByType(Text).map((t) => t.props.children).flat().filter(Boolean);
    expect(allTexts.join(' ')).toContain('프로필 정보를 불러오지 못했어요.');

    const retryBtn = root.findAll((n) => n.props.accessibilityLabel === '다시 시도')[0];
    expect(retryBtn).toBeDefined();
  });
});

describe('2. RoomDetailScreen connections (방 상세정보 연결: 528-1525, 561-1734)', () => {
  const mockRoom = {
    id: 'room-123',
    code: 'VF4HLD',
    title: '오늘 저녁팟',
    stage: 'scheduling',
    decisionMode: 'baseline',
    ownerId: 'user-host',
    meetingTime: '2026-09-25T19:00:00Z',
    confirmedSlot: '9월 25일 (금) 19:00',
    locationName: '서면',
    participants: [
      { id: 'part-1', profileId: 'user-self', name: '나야나', avatarUrl: null, role: 'mate' },
      { id: 'part-2', profileId: 'user-moa', name: '모아', avatarUrl: null, role: 'mate' },
      { id: 'part-3', profileId: 'user-host', name: '방장님', avatarUrl: null, role: 'owner' },
    ],
  };

  let mockNavigate;

  beforeEach(() => {
    mockNavigate = jest.fn();
    useAuth.mockReturnValue({ user: { id: 'user-self' } });
    useNavigation.mockReturnValue({
      goBack: jest.fn(),
      navigate: mockNavigate,
      resetTo: jest.fn(),
      current: { params: { roomId: 'room-123', title: '오늘 저녁팟' } },
    });
    useRoom.mockReturnValue({
      room: mockRoom,
      status: 'ready',
      reload: jest.fn(),
    });
    fetchVisibleProfile.mockResolvedValue({
      data: {
        profile: { id: 'user-moa', name: '모아', tag: 'moa', avatar_color: '#FF9900', avatar_url: null },
        relationship: 'room_mate',
        fields: {},
      },
      error: null,
    });
    fetchMyFriends.mockResolvedValue({ data: [], error: null });
  });

  it('clicking schedule row in scheduling stage navigates to ChatRoom with schedule openSheet and has time in label', async () => {
    const root = await render(RoomDetailScreen, {});
    const scheduleButton = root.findAll((n) => n.props.accessibilityLabel && n.props.accessibilityLabel.startsWith('일정,'))[0];
    expect(scheduleButton).toBeDefined();
    expect(scheduleButton.props.accessibilityLabel).toContain('9월 25일 (금) 19:00');

    await act(async () => {
      scheduleButton.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('ChatRoom', {
      roomId: 'room-123',
      title: '오늘 저녁팟',
      openSheet: 'schedule',
    });
  });

  it('locks schedule row when stage is confirmed, settling, or done', async () => {
    useRoom.mockReturnValue({
      room: { ...mockRoom, stage: 'confirmed' },
      status: 'ready',
      reload: jest.fn(),
    });

    const root = await render(RoomDetailScreen, {});
    const scheduleButton = root.findAll((n) => n.props.accessibilityLabel && n.props.accessibilityLabel.startsWith('일정,'))[0];
    expect(scheduleButton).toBeDefined();
    expect(scheduleButton.props.accessibilityState).toMatchObject({ disabled: true });

    await act(async () => {
      scheduleButton.props.onPress();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('clicking own member row navigates directly to Profile home', async () => {
    const root = await render(RoomDetailScreen, {});
    const myRow = root.findAll((n) => n.props.accessibilityLabel && n.props.accessibilityLabel.includes('나야나'))[0];
    expect(myRow).toBeDefined();

    await act(async () => {
      myRow.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Profile');
  });

  it('clicking another member row opens MateProfileSheet with roomId', async () => {
    const root = await render(RoomDetailScreen, {});
    const moaRow = root.findAll((n) => n.props.accessibilityLabel && n.props.accessibilityLabel.includes('모아'))[0];
    expect(moaRow).toBeDefined();

    await act(async () => {
      moaRow.props.onPress();
    });

    const sheet = root.findAll((n) => n.props.testID === 'mate-profile-sheet')[0];
    expect(sheet).toBeDefined();
  });

  it('clicking invite code card opens MateInviteSheet and has clean accessibility hint without copy guide', async () => {
    const root = await render(RoomDetailScreen, {});
    const inviteBox = root.findAll((n) => n.props.accessibilityLabel && n.props.accessibilityLabel.includes('초대 코드'))[0];
    expect(inviteBox).toBeDefined();
    expect(inviteBox.props.accessibilityHint).toBe('두 번 탭하면 메이트 초대 창을 열어요');
    expect(inviteBox.props.accessibilityHint).not.toContain('오른쪽 버튼으로 코드를 바로 복사');

    await act(async () => {
      inviteBox.props.onPress();
    });

    const inviteTitle = root.findAll((n) => n.props.children === '메이트 초대')[0];
    expect(inviteTitle).toBeDefined();
  });

  it('hides mate invite button and shows settling notice when cannot invite', async () => {
    useRoom.mockReturnValue({
      room: { ...mockRoom, stage: 'settling' },
      status: 'ready',
      reload: jest.fn(),
    });

    const root = await render(RoomDetailScreen, {});
    const inviteBtns = root.findAll((n) => n.props.accessibilityLabel === '메이트 초대');
    expect(inviteBtns).toHaveLength(0);

    const allTexts = root.findAllByType(Text).map((t) => t.props.children).flat().filter(Boolean);
    expect(allTexts.join(' ')).toContain('정산이 시작되어 메이트를 더 초대할 수 없어요.');
  });

  it('allows owner to see and trigger "방 없애기" dialog', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-host' } }); // owner
    useRoom.mockReturnValue({
      room: mockRoom,
      status: 'ready',
      reload: jest.fn(),
    });

    const root = await render(RoomDetailScreen, {});
    const deleteButton = root.findAll((n) => n.props.accessibilityLabel === '방 없애기')[0];
    expect(deleteButton).toBeDefined();

    await act(async () => {
      deleteButton.props.onPress();
    });

    const dialogTitle = root.findAll((n) => n.props.children === '방을 없앨까요?')[0];
    expect(dialogTitle).toBeDefined();
  });
});

describe('3. Visual updates: SignupStartScreen & AppHeader & AuthTopBar', () => {
  it('SignupStartScreen renders accessible={false} illustration and wordmark', async () => {
    useNavigation.mockReturnValue({ navigate: jest.fn() });
    const root = await render(SignupStartScreen, {});

    const images = root.findAllByType(Image);
    const charImg = images.find((img) => img.props.source && StyleSheet.flatten(img.props.style)?.width === 340);
    expect(charImg).toBeDefined();
    expect(charImg.props.accessible).toBe(false);
    expect(StyleSheet.flatten(charImg.props.style)).toMatchObject({ width: 340, height: 190 });

    const wordmarkImg = images.find((img) => img.props.accessibilityLabel === 'MealChat');
    expect(wordmarkImg).toBeDefined();
  });

  it('AppHeader renders #D93025 unread dot and wordmark image', async () => {
    const root = await render(AppHeader, { hasUnread: true, onPressBell: jest.fn() });

    const unreadDot = root.findAll((n) => {
      if (!n.props.style) return false;
      const flat = StyleSheet.flatten(n.props.style);
      return flat && flat.backgroundColor === '#D93025';
    })[0];
    expect(unreadDot).toBeDefined();
    expect(StyleSheet.flatten(unreadDot.props.style)).toMatchObject({
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#D93025',
    });

    const images = root.findAllByType(Image);
    expect(images.length).toBeGreaterThanOrEqual(2); // logo + wordmark image
  });

  it('AuthTopBar defaults to center alignment and respects alignTitle prop, and LoginScreen specifies left', async () => {
    // 1. Default for AuthTopBar without alignTitle is center
    const rootDefault = await render(AuthTopBar, { title: '로그인', onBack: jest.fn() });
    const defaultTitleText = rootDefault.findAllByType(Text)[0];
    expect(StyleSheet.flatten(defaultTitleText.props.style).textAlign).toBe('center');

    // 2. Explicit prop alignTitle="left"
    const rootExplicitLeft = await render(AuthTopBar, { title: '로그인', alignTitle: 'left', onBack: jest.fn() });
    const explicitLeftText = rootExplicitLeft.findAllByType(Text)[0];
    expect(StyleSheet.flatten(explicitLeftText.props.style).textAlign).toBe('left');

    // 3. LoginScreen calls AuthTopBar with alignTitle="left"
    useAuth.mockReturnValue({ signInWithEmail: jest.fn() });
    useNavigation.mockReturnValue({
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: false,
      replace: jest.fn(),
    });
    const rootLoginScreen = await render(LoginScreen, {});
    const loginHeader = rootLoginScreen.findAll((n) => n.props.accessibilityRole === 'header')[0];
    expect(StyleSheet.flatten(loginHeader.props.style).textAlign).toBe('left');
  });
});

describe('4. NotificationPanel icons and footer text (521-1429, 599-2425, 599-2587)', () => {
  it('maps notice kinds and icons using structural signals only (regression: "정산 모임" room title is not classified as settlement)', () => {
    const settlementNotice1 = { id: '1', roomId: 'r1', title: '정산 요청', message: 'N빵 정산', amount: 15000, settlementId: 's1', createdAt: '2026-10-20T10:00:00Z' };
    const settlementNotice2 = { id: '2', roomId: 'r1', title: '밥약 정산 완료', message: '정산이 끝났어요', amount: 0, settlementId: 's2', createdAt: '2026-10-20T10:00:00Z' };

    // Regression test: Even if the title/message contains "정산 모임", if amount <= 0 and settlementId is falsy, it is NOT classified as settlement!
    const roomWithSettlementInTitle = { id: '3', roomId: 'r1', title: '정산 모임 방에서 알림', message: '새 일정이 등록되었어요', amount: 0, createdAt: '2026-10-20T10:00:00Z' };
    const scheduleNotice = { id: '4', roomId: 'r1', title: '일정 확정됐어요!', message: '9월 25일 19:00', amount: 0, createdAt: '2026-10-20T10:00:00Z' };

    // Structural signal: amount > 0 or settlementId
    expect(noticeKind(settlementNotice1)).toBe('정산');
    expect(noticeIcon(settlementNotice1)).toBe(Receipt);

    expect(noticeKind(settlementNotice2)).toBe('정산');
    expect(noticeIcon(settlementNotice2)).toBe(Receipt);

    // Regression test: must be '일정', NOT '정산'
    expect(noticeKind(roomWithSettlementInTitle)).toBe('일정');
    expect(noticeIcon(roomWithSettlementInTitle)).toBe(CalendarDays);

    expect(noticeKind(scheduleNotice)).toBe('일정');
    expect(noticeIcon(scheduleNotice)).toBe(CalendarDays);
  });

  it('renders "최근 알림을 보여드려요" footer text in NotificationPanel without false "30일" statement', async () => {
    const root = await render(NotificationPanel, {
      notices: [],
      allRead: true,
      onClose: jest.fn(),
    });

    const allTexts = root.findAllByType(Text).map((t) => t.props.children).flat().filter(Boolean);
    const joined = allTexts.join(' ');
    expect(joined).toContain('최근 알림을 보여드려요');
    expect(joined).not.toContain('30일');
  });
});
