/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories and the untyped renderer use require. */
import React from 'react';
import { Text, TextInput } from 'react-native';

import MemberLeaveDialog, { getLeaveConfirmButtonLabel, getLeaveMessage } from '../src/screens/room/MemberLeaveDialog';
import OwnerTransferCard from '../src/screens/room/OwnerTransferCard';
import OwnerTransferSheet from '../src/screens/room/OwnerTransferSheet';
import DestructiveDialog from '../src/components/ui/DestructiveDialog';
import MateInviteSheet from '../src/components/ui/MateInviteSheet';
import JoinCodeSheet from '../src/components/JoinCodeSheet';
import RoomDetailScreen from '../src/screens/chat/RoomDetailScreen';
import { confirmedLeaveMessage, doneLeaveMessage } from '../src/lib/roomLifecycleController';
import { configureRoomLifecycle, fetchS3Capabilities, invalidateRoomLifecycle, roomLifecycleErrorMessage, type OwnerTransfer } from '../src/lib/roomLifecycle';
import { setConsentAccess } from '../src/consents/access';
import type { RoomParticipant } from '../src/lib/rooms';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), auth: {} } }));
interface ReactTestRenderer {
  root: any;
  toJSON(): any;
  unmount(): void;
  update(element: React.ReactElement): void;
}
const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void> | void;
  create: (element: React.ReactElement) => ReactTestRenderer;
};

jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

let mockS3Capabilities = { mode: 's3', error: null };
jest.mock('../src/lib/roomLifecycle', () => {
  const actual = jest.requireActual('../src/lib/roomLifecycle');
  return {
    ...actual,
    fetchS3Capabilities: jest.fn(async () => mockS3Capabilities),
    registerRoomLifecycleResources: jest.fn(() => () => {}),
  };
});

let mockInviteState = {
  code: '',
  pending: false,
  preview: null as any,
  roomId: null as string | null,
  inviteRetryAt: null as string | null,
  retrySeconds: 0,
  error: null as Error | null,
};
const mockInviteController = {
  setCode: jest.fn((c: string) => { mockInviteState.code = c; mockInviteState.roomId = null; }),
  preview: jest.fn(async () => {}),
  join: jest.fn(async () => {}),
  tick: jest.fn(() => mockInviteState.retrySeconds),
  subscribe: jest.fn((listener: (s: typeof mockInviteState) => void) => {
    listener(mockInviteState);
    return () => {};
  }),
  dispose: jest.fn(),
  getState: () => mockInviteState,
};

jest.mock('../src/lib/roomInviteController', () => ({
  createRoomInviteController: jest.fn(() => mockInviteController),
}));

let mockLifecycleView = {
  state: { revision: '1', can_leave: false, can_close: false, can_transfer: false } as any,
  pending: false,
  error: null as Error | null,
  departed: false,
  canLeave: false,
  canClose: false,
  canTransfer: false,
  reason: null as string | null,
  transferState: null as OwnerTransfer | null,
};

const mockLifecycleController = {
  subscribe: jest.fn((listener: (v: typeof mockLifecycleView) => void) => {
    listener(mockLifecycleView);
    return () => {};
  }),
  refresh: jest.fn(async () => {}),
  leave: jest.fn(async () => {}),
  close: jest.fn(async () => {}),
  requestTransfer: jest.fn(async () => {}),
  respondTransfer: jest.fn(async () => {}),
  cancelTransfer: jest.fn(async () => {}),
  dispose: jest.fn(),
  getState: () => mockLifecycleView,
};
let mockUseRealLifecycle = false;

jest.mock('../src/lib/roomLifecycleController', () => {
  const actual = jest.requireActual('../src/lib/roomLifecycleController');
  return {
    ...actual,
    createRoomLifecycleController: jest.fn((id: string) => mockUseRealLifecycle ? actual.createRoomLifecycleController(id) : mockLifecycleController),
  };
});

let mockRoomData = {
  id: 'r1',
  title: '오늘 저녁팟',
  ownerId: 'u-owner',
  stage: 'confirmed',
  code: 'VF4HLD',
  participants: [
    { id: 'p1', profileId: 'u-owner', name: '방장', avatarColor: '#23A455', avatarUrl: null },
    { id: 'p2', profileId: 'u-mate', name: '메이트', avatarColor: '#23A455', avatarUrl: null },
  ],
  decisionMode: 's4',
  expiresAt: '2026-10-28T00:00:00Z',
  meetingTime: '2026-10-25T19:00:00Z',
  confirmedSlot: '19:00',
  locationName: '서면',
};

const mockReload = jest.fn();
jest.mock('../src/rooms/useMyRooms', () => ({
  useRoom: jest.fn(() => ({
    room: mockRoomData,
    status: 'ready',
    reload: mockReload,
  })),
}));

let mockCurrentUser = { id: 'u-mate' };
jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: jest.fn(() => ({ user: mockCurrentUser })),
}));

const mockNavigate = jest.fn();
const mockResetTo = jest.fn();
const mockGoBack = jest.fn();
let mockRoomId = 'r1';
const allText = (root: any) =>
  root.findAllByType(Text).map((n: any) => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? ''))).join(' ');
jest.mock('../src/navigation/NavigationContext', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    resetTo: mockResetTo,
    goBack: mockGoBack,
    current: { name: 'RoomDetail', params: { roomId: mockRoomId, title: '오늘 저녁팟' } },
  })),
}));

describe('S3 방 생명주기 UI 단위 테스트', () => {
  let renderer!: ReactTestRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRealLifecycle = false;
    mockRoomId = 'r1';
    mockRoomData.stage = 'confirmed';
    mockLifecycleController.leave.mockImplementation(async () => {});
    mockS3Capabilities = { mode: 's3', error: null };
    mockCurrentUser = { id: 'u-mate' };
    mockInviteState = {
      code: '',
      pending: false,
      preview: null,
      roomId: null,
      inviteRetryAt: null,
      retrySeconds: 0,
      error: null,
    };
    mockLifecycleView = {
      state: { revision: '1', can_leave: false, can_close: false, can_transfer: false } as any,
      pending: false,
      error: null,
      departed: false,
      canLeave: false,
      canClose: false,
      canTransfer: false,
      reason: null,
      transferState: null,
    };
  });

  afterEach(async () => {
    if (renderer) {
      try {
        await act(async () => {
          renderer?.unmount();
        });
      } catch {}
      renderer = undefined as unknown as ReactTestRenderer;
    }
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('1. MemberLeaveDialog (메이트 나가기 확인 대화상자)', () => {
    it('confirmed 단계에서 정산 제외 안내 문구와 확인 버튼 레이블을 적용한다', () => {
      expect(getLeaveMessage('confirmed')).toBe(confirmedLeaveMessage);
      expect(getLeaveConfirmButtonLabel('confirmed')).toBe('내용을 확인하고 나가기');

      const onConfirm = jest.fn();
      const onClose = jest.fn();
      act(() => {
        renderer = create(
          <MemberLeaveDialog
            visible={true}
            busy={false}
            stage="confirmed"
            roomTitle="오늘 저녁팟"
            onClose={onClose}
            onConfirm={onConfirm}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('오늘 저녁팟에서 나갈까요?');
      expect(textNodes).toContain(confirmedLeaveMessage);
      expect(textNodes).toContain('그대로 있을게요');
      expect(textNodes).toContain('내용을 확인하고 나가기');

      const confirmBtn = renderer.root.findByProps({ accessibilityLabel: '내용을 확인하고 나가기' });
      act(() => { confirmBtn.props.onPress(); });
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('done 단계에서 새 정산 제외 안내 문구를 적용한다', () => {
      expect(getLeaveMessage('done')).toBe(doneLeaveMessage);
      expect(getLeaveConfirmButtonLabel('done')).toBe('나가기');

      act(() => {
        renderer = create(
          <MemberLeaveDialog
            visible={true}
            busy={false}
            stage="done"
            onClose={jest.fn()}
            onConfirm={jest.fn()}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain(doneLeaveMessage);
      expect(textNodes).toContain('나가기');
    });

    it('scheduling 단계에서 일반 나가기 문구를 적용한다', () => {
      act(() => {
        renderer = create(
          <MemberLeaveDialog
            visible={true}
            busy={false}
            stage="scheduling"
            onClose={jest.fn()}
            onConfirm={jest.fn()}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('방에서 나가면 대화 내용과 약속 정보를 더 이상 볼 수 없어요');
    });
  });

  describe('2. DestructiveDialog (방장 방 종료 확인 대화상자)', () => {
    it('모든 사람의 채팅이 사라져요 문구를 명시한다', () => {
      const onConfirm = jest.fn();
      act(() => {
        renderer = create(
          <DestructiveDialog
            visible={true}
            busy={false}
            onClose={jest.fn()}
            onConfirm={onConfirm}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('모든 사람의 채팅이 사라져요');
      expect(textNodes).toContain('정산 내역은 남아 있어요');
    });
  });

  describe('3. OwnerTransferCard (방장 위임 상태 카드)', () => {
    const participants: RoomParticipant[] = [
      { id: 'p1', profileId: 'u-owner', name: '나방장', avatarColor: '#23A455', avatarUrl: null },
      { id: 'p2', profileId: 'u-target', name: '너메이트', avatarColor: '#23A455', avatarUrl: null },
      { id: 'p3', profileId: 'u-third', name: '제3자', avatarColor: '#23A455', avatarUrl: null },
    ];

    it('요청자(방장) 대기 상태에서 대상자 이름과 요청 취소 버튼을 노출한다', async () => {
      const transfer: OwnerTransfer = {
        id: 't-1',
        from_owner_id: 'u-owner',
        target_profile_id: 'u-target',
        leave_after_accept: true,
        status: 'pending',
        expires_at: '2026-10-22T00:00:00Z',
        terminal_reason: null,
      };

      const onCancel = jest.fn(async () => {});
      act(() => {
        renderer = create(
          <OwnerTransferCard
            transfer={transfer}
            myId="u-owner"
            participants={participants}
            onCancel={onCancel}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('방장 넘기기 대기 중');
      expect(textNodes).toContain('너메이트님에게 방장 넘기기를 요청했어요');
      expect(textNodes).toContain('상대방이 수락하면 나는 방에서 나가요');

      const cancelBtn = renderer.root.findByProps({ label: '요청 취소' });
      await act(async () => { cancelBtn.props.onPress(); });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('대상자 대기 상태에서 수락하기 및 거절 버튼을 노출한다', async () => {
      const transfer: OwnerTransfer = {
        id: 't-1',
        from_owner_id: 'u-owner',
        target_profile_id: 'u-target',
        leave_after_accept: false,
        status: 'pending',
        expires_at: '2026-10-22T00:00:00Z',
        terminal_reason: null,
      };

      const onRespond = jest.fn(async () => {});
      act(() => {
        renderer = create(
          <OwnerTransferCard
            transfer={transfer}
            myId="u-target"
            participants={participants}
            onRespond={onRespond}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('방장 넘기기 요청을 받았어요');
      expect(textNodes).toContain('나방장님이 방장 권한을 넘기려 해요');

      const acceptBtn = renderer.root.findByProps({ label: '수락하기' });
      await act(async () => { acceptBtn.props.onPress(); });
      expect(onRespond).toHaveBeenCalledWith(true);

      const declineBtn = renderer.root.findByProps({ label: '거절' });
      await act(async () => { declineBtn.props.onPress(); });
      expect(onRespond).toHaveBeenCalledWith(false);
    });

    it('제3자에게는 위임 상세 및 조작을 노출하지 않는다', () => {
      const transfer: OwnerTransfer = {
        id: 't-1',
        from_owner_id: 'u-owner',
        target_profile_id: 'u-target',
        leave_after_accept: true,
        status: 'pending',
        expires_at: '2026-10-22T00:00:00Z',
        terminal_reason: null,
      };

      act(() => {
        renderer = create(
          <OwnerTransferCard
            transfer={transfer}
            myId="u-third"
            participants={participants}
          />
        );
      });

      expect(renderer.toJSON()).toBeNull();
    });

    it('종료 상태(declined, expired, accepted) 피드백 메시지를 표시한다', () => {
      const transfer: OwnerTransfer = {
        id: 't-1',
        from_owner_id: 'u-owner',
        target_profile_id: 'u-target',
        leave_after_accept: true,
        status: 'declined',
        expires_at: '2026-10-22T00:00:00Z',
        terminal_reason: null,
      };

      act(() => {
        renderer = create(
          <OwnerTransferCard
            transfer={transfer}
            myId="u-owner"
            participants={participants}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('너메이트님이 방장 넘기기를 거절했어요');
    });
  });

  describe('4. OwnerTransferSheet (방장 위임 대상 선택 시트)', () => {
    const participants: RoomParticipant[] = [
      { id: 'p1', profileId: 'u-owner', name: '나방장', avatarColor: '#23A455', avatarUrl: null },
      { id: 'p2', profileId: 'u-mate1', name: '메이트1', avatarColor: '#23A455', avatarUrl: null },
      { id: 'p3', profileId: null, name: '표시행멤버', avatarColor: '#23A455', avatarUrl: null },
    ];

    it('본인 및 profileId가 없는 표시행을 제외하고 실제 메이트만 선택 목록에 표시한다', () => {
      act(() => {
        renderer = create(
          <OwnerTransferSheet
            visible={true}
            roomId="r1"
            myId="u-owner"
            participants={participants}
            onClose={jest.fn()}
            onSubmit={jest.fn(async () => {})}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('메이트1');
      expect(textNodes).not.toContain('표시행멤버');
    });

    it('confirmed 단계에서 방 나가기 체크 시 안내 문구를 표시하고 요청을 전송한다', async () => {
      const onSubmit = jest.fn(async () => {});
      act(() => {
        renderer = create(
          <OwnerTransferSheet
            visible={true}
            roomId="r1"
            stage="confirmed"
            myId="u-owner"
            participants={participants}
            onClose={jest.fn()}
            onSubmit={onSubmit}
          />
        );
      });

      // 메이트1 선택
      const mateRow = renderer.root.findAll((node: any) => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.includes('메이트1'))[0];
      act(() => { mateRow.props.onPress(); });

      // 체크박스 클릭
      const checkbox = renderer.root.findByProps({ accessibilityLabel: '방장을 넘긴 뒤 방 나가기' });
      act(() => { checkbox.props.onPress(); });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain(confirmedLeaveMessage);

      // 요청 보내기
      const submitBtn = renderer.root.findByProps({ label: '요청 보내기' });
      await act(async () => { submitBtn.props.onPress(); });
      expect(onSubmit).toHaveBeenCalledWith('u-mate1', true);
    });

    it('B1: OwnerTransferSheet 요청 실패 시 시트를 닫지 않고 오류를 표시한다', async () => {
      const onSubmit = jest.fn().mockRejectedValue(Object.assign(new Error('S3002'), { code: 'S3002' }));
      const onClose = jest.fn();

      await act(async () => {
        renderer = create(
          <OwnerTransferSheet
            visible={true}
            roomId="r1"
            myId="u-owner"
            participants={[
              { id: 'p1', profileId: 'u-owner', name: '방장', avatarColor: '#23A455', avatarUrl: null },
              { id: 'p2', profileId: 'u-mate1', name: '메이트1', avatarColor: '#23A455', avatarUrl: null },
            ]}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        );
      });

      const mateRow = renderer.root.findAll((node: any) => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.includes('메이트1'))[0];
      act(() => { mateRow.props.onPress(); });

      const submitBtn = renderer.root.findByProps({ label: '요청 보내기' });
      await act(async () => { submitBtn.props.onPress(); });

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      const textNodes = allText(renderer.root);
      expect(textNodes).toContain(roomLifecycleErrorMessage({ code: 'S3002' }));
    });
  });

  describe('5. JoinCodeSheet (6칸 입력, 미리보기, 오류, 5회 잠금)', () => {
    it('6칸 셀 렌더링 및 6자리 완성 시 preview를 호출한다', async () => {
      await act(async () => {
        renderer = create(
          <JoinCodeSheet
            visible={true}
            onClose={jest.fn()}
            onJoined={jest.fn()}
          />
        );
      });

      const input = renderer.root.findByType(TextInput);
      act(() => {
        input.props.onChangeText('ABCDE2');
      });

      expect(mockInviteController.setCode).toHaveBeenCalledWith('ABCDE2');
      expect(mockInviteController.preview).toHaveBeenCalled();
    });

    it('방 미리보기에 제목과 인원만 표시하고 방장/멤버 이름은 절대 표시하지 않는다', async () => {
      mockInviteState = {
        code: 'ABCDE2',
        pending: false,
        preview: {
          contract_version: 1,
          outcome: 'preview',
          preview_id: 'prev-1',
          title: '맛있는 저녁팟',
          member_count: 4,
          can_join: true,
          code_expires_at: '2026-10-28T00:00:00Z',
          preview_expires_at: '2026-10-21T01:00:00Z',
          server_time: '2026-10-21T00:00:00Z',
        },
        roomId: null,
        inviteRetryAt: null,
        retrySeconds: 0,
        error: null,
      };

      await act(async () => {
        renderer = create(
          <JoinCodeSheet
            visible={true}
            onClose={jest.fn()}
            onJoined={jest.fn()}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('맛있는 저녁팟');
      expect(textNodes).toContain('메이트 4명');
      // 방장이나 특정 사용자 이름이 없음을 검증
      expect(textNodes).not.toContain('방장');
      expect(textNodes).not.toContain('나야나');

      // 방에 들어가기 버튼 활성화 확인 및 클릭
      const joinBtn = renderer.root.findByProps({ accessibilityLabel: '방에 들어가기' });
      expect(joinBtn.props.accessibilityState.disabled).toBe(false);

      await act(async () => { joinBtn.props.onPress(); });
      expect(mockInviteController.join).toHaveBeenCalledTimes(1);
    });

    it('오류 상태에서 칸 안에 에러 스타일과 에러 문구를 표시한다', async () => {
      mockInviteState = {
        code: 'ABCDE2',
        pending: false,
        preview: null,
        roomId: null,
        inviteRetryAt: null,
        retrySeconds: 0,
        error: Object.assign(new Error('초대 코드를 확인해 주세요.'), { code: 'INVITE_UNAVAILABLE' }),
      };

      await act(async () => {
        renderer = create(
          <JoinCodeSheet
            visible={true}
            onClose={jest.fn()}
            onJoined={jest.fn()}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('초대 코드를 확인해 주세요');
      expect(textNodes).toContain('초대 코드를 확인해 주세요.');

      const joinBtn = renderer.root.findByProps({ accessibilityLabel: '방에 들어가기' });
      expect(joinBtn.props.accessibilityState.disabled).toBe(true);
    });

    it('5회 잠금 상태에서 남은 시간 카운트다운을 표시하고 입력을 막는다', async () => {
      mockInviteState = {
        code: 'ABCDE2',
        pending: false,
        preview: null,
        roomId: null,
        inviteRetryAt: '2026-10-21T00:15:00Z',
        retrySeconds: 899, // 14분 59초
        error: Object.assign(new Error('초대 코드 확인이 잠겼어요.'), { code: 'INVITE_RATE_LIMITED' }),
      };

      await act(async () => {
        renderer = create(
          <JoinCodeSheet
            visible={true}
            onClose={jest.fn()}
            onJoined={jest.fn()}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('초대 코드 확인이 잠겼어요');
      expect(textNodes).toContain('14분 59초 뒤 다시 시도해 주세요.');

      const input = renderer.root.findByType(TextInput);
      expect(input.props.editable).toBe(false);

      const joinBtn = renderer.root.findByProps({ accessibilityLabel: '방에 들어가기' });
      expect(joinBtn.props.accessibilityState.disabled).toBe(true);
    });

    it('S3 capabilities가 legacy인 경우 기존 단일 TextField 입력으로 안전하게 fallback한다', async () => {
      mockS3Capabilities = { mode: 'legacy', error: null };

      await act(async () => {
        renderer = create(
          <JoinCodeSheet
            visible={true}
            onClose={jest.fn()}
            onJoined={jest.fn()}
          />
        );
      });

      const textField = renderer.root.findByProps({ label: '초대 코드' });
      expect(textField).toBeTruthy();
      expect(renderer.root.findByProps({ label: '입장' })).toBeTruthy();
    });

    it('B4: 매 렌더마다 새 콜백 함수를 넘겨도 onJoined가 1회만 호출된다', async () => {
      const onJoined = jest.fn();
      mockInviteState = {
        code: 'ABCDE2',
        pending: false,
        preview: null,
        roomId: 'room-123',
        inviteRetryAt: null,
        retrySeconds: 0,
        error: null,
      };

      await act(async () => {
        renderer = create(
          <JoinCodeSheet
            visible={true}
            onClose={() => {}}
            onJoined={(id) => onJoined(id)}
          />
        );
      });

      // 강제 리렌더 (매 렌더 새 인라인 함수 전달)
      await act(async () => {
        renderer.update(
          <JoinCodeSheet
            visible={true}
            onClose={() => {}}
            onJoined={(id) => onJoined(id)}
          />
        );
      });

      expect(onJoined).toHaveBeenCalledTimes(1);
      expect(onJoined).toHaveBeenCalledWith('room-123');
    });

    it('B5: capabilities unknown/loading 시 로딩 인디케이터가 표시된다', async () => {
      (fetchS3Capabilities as jest.Mock).mockReturnValueOnce(new Promise(() => {}));

      await act(async () => {
        renderer = create(
          <JoinCodeSheet
            visible={true}
            onClose={jest.fn()}
            onJoined={jest.fn()}
          />
        );
      });

      expect(allText(renderer.root)).toContain('서버 상태를 확인하고 있어요...');
      expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
    });

    it('B5: capabilities 확인 실패 시 재시도 안내 화면이 표시된다', async () => {
      (fetchS3Capabilities as jest.Mock).mockRejectedValueOnce(
        new Error('network error')
      );

      await act(async () => {
        renderer = create(
          <JoinCodeSheet
            visible={true}
            onClose={jest.fn()}
            onJoined={jest.fn()}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('서버 상태를 확인하지 못했어요');
      expect(renderer.root.findByProps({ label: '다시 시도' })).toBeTruthy();
      expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
      await act(async () => { renderer.root.findByProps({ label: '다시 시도' }).props.onPress(); });
      expect(renderer.root.findByType(TextInput)).toBeTruthy();
    });

    it('B4: 성공 뒤 닫고 다시 열어도 이전 방으로 이동하지 않는다', async () => {
      const joined = jest.fn();
      const closed = jest.fn();
      mockInviteState.roomId = 'previous-room';
      const element = (visible: boolean) => <JoinCodeSheet visible={visible} onClose={() => closed()} onJoined={id => joined(id)} />;
      await act(async () => { renderer = create(element(true)); });
      expect(joined).toHaveBeenCalledTimes(1);
      await act(async () => { renderer.update(element(false)); });
      await act(async () => { renderer.update(element(true)); });
      expect(joined).toHaveBeenCalledTimes(1);
      expect(closed).toHaveBeenCalledTimes(1);
      expect(renderer.root.findByType(TextInput).props.value).toBe('');
    });

    it.each(['s3', 'legacy'])('%s 입력은 붙여넣기 전체를 받은 뒤 공백과 하이픈을 정규화한다', async mode => {
      mockS3Capabilities = { mode, error: null };
      await act(async () => { renderer = create(<JoinCodeSheet visible onClose={jest.fn()} onJoined={jest.fn()} />); });
      const input = renderer.root.findByType(TextInput);
      expect(input.props.maxLength).toBeUndefined();
      await act(async () => { input.props.onChangeText(' ab-cd e2zz'); });
      if (mode === 's3') expect(mockInviteController.setCode).toHaveBeenCalledWith('ABCDE2');
      else expect(renderer.root.findByType(TextInput).props.value).toBe('ABCDE2');
    });

    it.each(['PREVIEW_STALE', 'INVITE_RATE_LIMITED'])('%s에서 잠금 종료 후 같은 코드로 다시 확인할 수 있다', async code => {
      mockInviteState = { ...mockInviteState, code: 'ABCDE2', retrySeconds: 0, error: Object.assign(new Error('internal message'), { code }) };
      await act(async () => { renderer = create(<JoinCodeSheet visible onClose={jest.fn()} onJoined={jest.fn()} />); });
      expect(allText(renderer.root)).not.toContain('internal message');
      await act(async () => { renderer.root.findByProps({ label: '다시 확인' }).props.onPress(); });
      expect(mockInviteController.preview).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['INVALID_RESPONSE', '잠시 후 다시 시도해 주세요.'],
      ['NETWORK', '네트워크 연결을 확인해 주세요.'],
    ])('%s 오류에 맞는 안내를 표시한다', async (code, message) => {
      mockInviteState.error = Object.assign(new Error('internal message'), { code });
      await act(async () => { renderer = create(<JoinCodeSheet visible onClose={jest.fn()} onJoined={jest.fn()} />); });
      expect(allText(renderer.root)).toContain(message);
      if (code === 'INVALID_RESPONSE') expect(allText(renderer.root)).not.toContain('네트워크');
    });
  });

  describe('6. MateInviteSheet (메이트 초대 시트)', () => {
    it('B3: S3 환경에서 실제 서버 만료와 OS 공유를 표시한다', async () => {
      mockS3Capabilities = { mode: 's3', error: null };
      await act(async () => {
        renderer = create(
          <MateInviteSheet
            visible={true}
            code="VF4HLD"
            expiresAt="2026-10-22T03:00:00Z"
            onClose={jest.fn()}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain(`초대 코드 · ${new Date('2026-10-22T03:00:00Z').toLocaleString('ko-KR')}까지`);
      expect(textNodes).not.toContain('7일');
      expect(textNodes).toContain('VF4HLD');
      expect(textNodes).toContain('공유하기');

      // D6: 카카오톡, 링크 복사는 노출되지 않음
      expect(textNodes).not.toContain('카카오톡');
      expect(textNodes).not.toContain('링크 복사');
    });

    it('B3: 레거시 환경에서는 7일 문구 없이 초대 코드만 표시한다', async () => {
      mockS3Capabilities = { mode: 'legacy', error: null };
      await act(async () => {
        renderer = create(
          <MateInviteSheet
            visible={true}
            code="VF4HLD"
            onClose={jest.fn()}
          />
        );
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('초대 코드');
      expect(textNodes).not.toContain('7일');
    });
  });

  describe('실제 컨트롤러와 화면의 오류 복구', () => {
    const roomId = '33000000-0000-4000-8000-000000000001';
    const transferId = '44000000-0000-4000-8000-000000000001';
    let rpc: jest.Mock;
    let projection: Record<string, unknown>;
    beforeEach(() => {
      mockUseRealLifecycle = true;
      mockRoomId = roomId;
      setConsentAccess('u-mate', 'accepted');
      projection = {
        contract_version: 1, room_id: roomId, stage: 'confirmed', revision: '1',
        server_time: '2026-10-21T00:00:00Z', expires_at: '2026-10-22T00:00:00Z',
        can_leave: true, can_close: true, can_transfer: true,
        reason: null, transfer: null, invite: null,
      };
      rpc = jest.fn(async (name: string) => ({
        data: name === 'get_s3_capabilities' ? {
          contract_version: 1, member_leave: true, owner_transfer: true,
          invite_preview: true, invite_limits: true, bounded_expiry: true, invite_links: false,
        } : projection, error: null,
      }));
      configureRoomLifecycle({ transport: rpc, storage: { getItem: async () => null, setItem: async () => {} }, backend: 'ui-recovery' });
    });
    const failWriter = (writer: string, code: string) => {
      const normal = rpc.getMockImplementation()!;
      rpc.mockImplementation((name: string, ...args: unknown[]) => name === writer
        ? Promise.resolve({ data: null, error: { code } }) : normal(name, ...args));
    };
    const renderDetail = async () => {
      await act(async () => { renderer = create(<RoomDetailScreen />); });
    };
    const click = async (label: string) => {
      const button = renderer.root.findByProps({ accessibilityLabel: label });
      expect(button.props.disabled).not.toBe(true);
      await act(async () => { await button.props.onPress(); });
    };
    const reads = () => rpc.mock.calls.filter(([name]) => name === 'get_room_lifecycle_v1').length;

    it.each(['S3001', 'S3002', 'S4005'])('나가기 %s 오류 후 확인창과 안내를 유지하고 권한을 복원한다', async code => {
      failWriter('leave_room_member_v1', code);
      await renderDetail();
      await click('방 나가기');
      await click('내용을 확인하고 나가기');
      expect(renderer.root.findByType(MemberLeaveDialog).props).toMatchObject({ visible: true, error: roomLifecycleErrorMessage({ code }) });
      expect(reads()).toBe(2);
      expect(renderer.root.findByProps({ accessibilityLabel: '방 나가기' }).props.disabled).toBe(false);
      expect(allText(renderer.root)).toContain(roomLifecycleErrorMessage({ code }));
      expect(mockResetTo).not.toHaveBeenCalled();
    });

    it('종료 오류 뒤 레거시 삭제로 우회하지 않고 확인창을 유지한다', async () => {
      mockCurrentUser = { id: 'u-owner' };
      failWriter('close_room_v1', 'S3001');
      await renderDetail(); await click('방 없애기'); await click('없애기');
      expect(renderer.root.findByType(DestructiveDialog).props).toMatchObject({ visible: true, error: roomLifecycleErrorMessage({ code: 'S3001' }) });
      expect(reads()).toBe(2);
      expect(mockResetTo).not.toHaveBeenCalled();
    });

    it.each(['leave', 'close'])('%s 실패 후 외부 departed는 이전 작업의 성공 토스트를 만들지 않는다', async action => {
      if (action === 'close') mockCurrentUser = { id: 'u-owner' };
      failWriter(action === 'leave' ? 'leave_room_member_v1' : 'close_room_v1', 'S3001');
      await renderDetail();
      await click(action === 'leave' ? '방 나가기' : '방 없애기');
      await click(action === 'leave' ? '내용을 확인하고 나가기' : '없애기');
      expect(mockResetTo).not.toHaveBeenCalled();
      await act(async () => { invalidateRoomLifecycle(roomId, 'departed'); });
      expect(mockResetTo).toHaveBeenCalledTimes(1);
      expect(mockResetTo).toHaveBeenCalledWith('Home');
    });

    it.each(['request', 'cancel', 'respond'])('위임 %s 성공 뒤 재조회 실패는 성공 처리하고 조회 오류만 안내한다', async action => {
      const owner = '55000000-0000-4000-8000-000000000001';
      const target = '55000000-0000-4000-8000-000000000002';
      mockCurrentUser = { id: action === 'request' ? 'u-owner' : action === 'cancel' ? owner : target };
      if (action !== 'request') projection.transfer = {
        id: transferId, from_owner_id: owner, target_profile_id: target,
        leave_after_accept: false, status: 'pending', expires_at: '2026-10-22T00:00:00Z', terminal_reason: null,
      };
      const normal = rpc.getMockImplementation()!;
      let mutationApplied = false;
      const writer = `${action}_room_owner_transfer_v1`;
      rpc.mockImplementation((name: string, ...args: unknown[]) => {
        if (name === writer) {
          mutationApplied = true;
          return Promise.resolve({ data: { contract_version: 1, outcome: 'applied', applied_revision: '2', transfer_id: transferId }, error: null });
        }
        if (name === 'get_room_lifecycle_v1' && mutationApplied) return Promise.resolve({ data: null, error: { code: 'TIMEOUT' } });
        return normal(name, ...args);
      });
      await renderDetail();
      if (action === 'request') {
        await click('방장 넘기기');
        const sheet = renderer.root.findByType(OwnerTransferSheet);
        const mate = sheet.findAll((node: any) => typeof node.props.onPress === 'function' && node.props.accessibilityLabel?.includes('메이트'))[0];
        await act(async () => { mate.props.onPress(); });
        await click('요청 보내기');
        expect(renderer.root.findByType(OwnerTransferSheet).props.visible).toBe(false);
      } else {
        await click(action === 'cancel' ? '요청 취소' : '수락하기');
        expect(allText(renderer.root.findByType(OwnerTransferCard))).not.toContain(roomLifecycleErrorMessage({ code: 'TIMEOUT' }));
      }
      expect(reads()).toBe(2);
      expect(allText(renderer.root)).toContain('방 상태를 불러오지 못했어요');
      expect(allText(renderer.root)).toContain(roomLifecycleErrorMessage({ code: 'TIMEOUT' }));
      mutationApplied = false;
      await click('다시 시도');
      expect(allText(renderer.root)).not.toContain('방 상태를 불러오지 못했어요');
      expect(rpc.mock.calls.filter(([name]) => name === writer)).toHaveLength(1);
    });

    it('위임 오류 후 선택과 오류를 남기며 성공한 요청만 시트를 닫는다', async () => {
      mockCurrentUser = { id: 'u-owner' };
      failWriter('request_room_owner_transfer_v1', 'S4005');
      await renderDetail(); await click('방장 넘기기');
      const sheet = renderer.root.findByType(OwnerTransferSheet);
      const mate = sheet.findAll((node: any) => typeof node.props.onPress === 'function' && node.props.accessibilityLabel?.includes('메이트'))[0];
      await act(async () => { mate.props.onPress(); });
      await click('요청 보내기');
      expect(renderer.root.findByType(OwnerTransferSheet).props.visible).toBe(true);
      expect(allText(renderer.root.findByType(OwnerTransferSheet))).toContain(roomLifecycleErrorMessage({ code: 'S4005' }));
      expect(reads()).toBe(2);
      const normal = rpc.getMockImplementation()!;
      rpc.mockImplementation((name: string, ...args: unknown[]) => name === 'request_room_owner_transfer_v1'
        ? Promise.resolve({ data: { contract_version: 1, outcome: 'applied', applied_revision: '2', transfer_id: transferId }, error: null }) : normal(name, ...args));
      await click('요청 보내기');
      expect(renderer.root.findByType(OwnerTransferSheet).props.visible).toBe(false);
    });

    it.each(['cancel', 'respond'])('위임 %s 오류를 카드에 남기고 재조회한다', async kind => {
      mockCurrentUser = { id: kind === 'cancel' ? 'u-owner' : 'u-mate' };
      projection.transfer = {
        id: transferId, from_owner_id: null, target_profile_id: null,
        leave_after_accept: false, status: 'pending', expires_at: '2026-10-22T00:00:00Z', terminal_reason: null,
      };
      // 실제 projection parser는 profile UUID를 요구한다.
      const owner = '55000000-0000-4000-8000-000000000001';
      const target = '55000000-0000-4000-8000-000000000002';
      (projection.transfer as any).from_owner_id = owner;
      (projection.transfer as any).target_profile_id = target;
      mockCurrentUser = { id: kind === 'cancel' ? owner : target };
      failWriter(kind === 'cancel' ? 'cancel_room_owner_transfer_v1' : 'respond_room_owner_transfer_v1', 'S4005');
      await renderDetail(); await click(kind === 'cancel' ? '요청 취소' : '수락하기');
      expect(allText(renderer.root.findByType(OwnerTransferCard))).toContain(roomLifecycleErrorMessage({ code: 'S4005' }));
      expect(reads()).toBe(2);
      expect(mockResetTo).not.toHaveBeenCalled();
    });

    it('재조회 실패 시 반복하지 않고 명시 재시도로 복구하며 외부 changed도 재조회한다', async () => {
      failWriter('leave_room_member_v1', 'S4005');
      await renderDetail();
      const normal = rpc.getMockImplementation()!;
      let failRead = true;
      rpc.mockImplementation((name: string, ...args: unknown[]) => name === 'get_room_lifecycle_v1' && failRead
        ? Promise.resolve({ data: null, error: { code: 'TIMEOUT' } }) : normal(name, ...args));
      await click('방 나가기'); await click('내용을 확인하고 나가기');
      expect(reads()).toBe(2);
      await act(async () => { renderer.update(<RoomDetailScreen />); });
      expect(reads()).toBe(2);
      await act(async () => { invalidateRoomLifecycle(roomId, 'changed'); });
      expect(reads()).toBe(3);
      failRead = false;
      await click('다시 시도'); expect(reads()).toBe(4);
      expect(renderer.root.findByProps({ accessibilityLabel: '방 나가기' }).props.disabled).toBe(false);
      expect(allText(renderer.root)).not.toContain('방 상태를 불러오지 못했어요');
      await act(async () => { invalidateRoomLifecycle(roomId, 'changed'); });
      expect(reads()).toBe(5);
    });
  });

  describe('7. RoomDetailScreen (단계별 나가기 버튼 및 레거시 숨김)', () => {
    it('S3 지원 및 canLeave=true일 때 일반 메이트에게 방 나가기 버튼을 노출한다', async () => {
      mockCurrentUser = { id: 'u-mate' };
      mockLifecycleView = {
        state: null,
        pending: false,
        error: null,
        departed: false,
        canLeave: true,
        canClose: false,
        canTransfer: false,
        reason: null,
        transferState: null,
      };

      await act(async () => {
        renderer = create(<RoomDetailScreen />);
      });

      const leaveBtn = renderer.root.findByProps({ accessibilityLabel: '방 나가기' });
      expect(leaveBtn).toBeTruthy();
    });

    it('레거시/미지원(canLeave=false)일 때 메이트에게 방 나가기 버튼을 노출하지 않는다', async () => {
      mockCurrentUser = { id: 'u-mate' };
      mockLifecycleView = {
        state: null,
        pending: false,
        error: null,
        departed: false,
        canLeave: false,
        canClose: false,
        canTransfer: false,
        reason: null,
        transferState: null,
      };

      await act(async () => {
        renderer = create(<RoomDetailScreen />);
      });

      const leaveBtns = renderer.root.findAllByProps({ accessibilityLabel: '방 나가기' });
      expect(leaveBtns).toHaveLength(0);
    });

    it('방장이고 canTransfer=true일 때 방장 넘기기 버튼을 노출한다', async () => {
      mockCurrentUser = { id: 'u-owner' };
      mockLifecycleView = {
        state: null,
        pending: false,
        error: null,
        departed: false,
        canLeave: false,
        canClose: true,
        canTransfer: true,
        reason: null,
        transferState: null,
      };

      await act(async () => {
        renderer = create(<RoomDetailScreen />);
      });

      const transferBtn = renderer.root.findByProps({ accessibilityLabel: '방장 넘기기' });
      expect(transferBtn).toBeTruthy();
    });

    it('B2: 레거시 서버에서 방장 방 없애기 버튼이 활성화(disabled=false)된다', async () => {
      mockS3Capabilities = { mode: 'legacy', error: null };
      mockCurrentUser = { id: 'u-owner' };
      mockRoomData.stage = 'place';
      mockLifecycleView = {
        state: null,
        pending: false,
        error: null,
        departed: false,
        canLeave: false,
        canClose: false,
        canTransfer: false,
        reason: null,
        transferState: null,
      };

      await act(async () => {
        renderer = create(<RoomDetailScreen />);
      });

      const deleteBtn = renderer.root.findByProps({ accessibilityLabel: '방 없애기' });
      expect(deleteBtn.props.disabled).toBe(false);
      expect(deleteBtn.props.accessibilityState.disabled).toBe(false);
    });

    it('B2: 레거시 서버에서 settling 단계이면 방 없애기 버튼이 비활성화(disabled=true)된다', async () => {
      mockS3Capabilities = { mode: 'legacy', error: null };
      mockCurrentUser = { id: 'u-owner' };
      mockRoomData.stage = 'settling';

      await act(async () => {
        renderer = create(<RoomDetailScreen />);
      });

      const deleteBtn = renderer.root.findByProps({ accessibilityLabel: '방 없애기' });
      expect(deleteBtn.props.disabled).toBe(true);
      expect(deleteBtn.props.accessibilityState.disabled).toBe(true);
      mockRoomData.stage = 'confirmed'; // 복원
    });

    it('S3에서는 stage 대신 서버 canClose로 종료 활성화를 결정한다', async () => {
      mockCurrentUser = { id: 'u-owner' };
      mockRoomData.stage = 'settling';
      mockLifecycleView.canClose = true;
      await act(async () => { renderer = create(<RoomDetailScreen />); });
      expect(renderer.root.findByProps({ accessibilityLabel: '방 없애기' }).props.disabled).toBe(false);
    });

    it('capability 조회 오류를 레거시로 처리하지 않고 재시도를 제공한다', async () => {
      mockCurrentUser = { id: 'u-owner' };
      mockS3Capabilities = { mode: 'error', error: null };
      await act(async () => { renderer = create(<RoomDetailScreen />); });
      expect(renderer.root.findByProps({ accessibilityLabel: '방 없애기' }).props.disabled).toBe(true);
      expect(allText(renderer.root)).toContain('서버 상태를 확인하지 못했어요');
      mockS3Capabilities = { mode: 'legacy', error: null };
      await act(async () => { renderer.root.findByProps({ accessibilityLabel: '다시 시도' }).props.onPress(); });
      expect(renderer.root.findByProps({ accessibilityLabel: '방 없애기' }).props.disabled).toBe(false);
    });

    it('B1: lifecycleView.error 가 있을 때 상단에 에러 카드와 재시도 버튼이 노출된다', async () => {
      mockCurrentUser = { id: 'u-owner' };
      mockLifecycleView = {
        state: null,
        pending: false,
        error: Object.assign(new Error('전체 정산이 완료되지 않았어요.'), { code: 'S3001' }),
        departed: false,
        canLeave: false,
        canClose: false,
        canTransfer: false,
        reason: null,
        transferState: null,
      };

      await act(async () => {
        renderer = create(<RoomDetailScreen />);
      });

      const textNodes = allText(renderer.root);
      expect(textNodes).toContain('방 상태를 불러오지 못했어요');
      expect(textNodes).toContain(roomLifecycleErrorMessage({ code: 'S3001' }));

      const retryBtn = renderer.root.findByProps({ accessibilityLabel: '다시 시도' });
      await act(async () => { retryBtn.props.onPress(); });
      expect(mockLifecycleController.refresh).toHaveBeenCalled();
    });

    it('B1: confirmLeave 실패 시 다이얼로그를 닫지 않고 오류를 표시한다', async () => {
      mockCurrentUser = { id: 'u-mate' };
      mockLifecycleView = {
        state: { revision: '1', can_leave: true, can_close: false, can_transfer: false } as any,
        pending: false,
        error: null,
        departed: false,
        canLeave: true,
        canClose: false,
        canTransfer: false,
        reason: null,
        transferState: null,
      };
      mockLifecycleController.leave.mockImplementation(async () => {
        mockLifecycleView.error = Object.assign(new Error('S3001'), { code: 'S3001' });
      });

      await act(async () => {
        renderer = create(<RoomDetailScreen />);
      });

      const leaveBtn = renderer.root.findByProps({ accessibilityLabel: '방 나가기' });
      act(() => { leaveBtn.props.onPress(); });

      const dialog = renderer.root.findByType(MemberLeaveDialog);
      expect(dialog.props.visible).toBe(true);

      const confirmBtn = renderer.root.findByProps({ accessibilityLabel: '내용을 확인하고 나가기' });
      await act(async () => { confirmBtn.props.onPress(); });

      // 실패 후에도 dialog visible 유지 및 error 표시
      expect(renderer.root.findByType(MemberLeaveDialog).props.visible).toBe(true);
      expect(renderer.root.findByType(MemberLeaveDialog).props.error).toBe(roomLifecycleErrorMessage({ code: 'S3001' }));
      expect(mockResetTo).not.toHaveBeenCalled();
    });
  });
});
