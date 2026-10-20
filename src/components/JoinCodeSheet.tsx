import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { notify } from '../lib/confirm';
import { joinRoomByCode } from '../lib/rooms';
import { isRoomMembershipClosed, membershipClosedMessage } from '../lib/roomMembership';
import BottomSheet from './ui/BottomSheet';
import { Button } from './ui/Button';
import TextField from './ui/TextField';

const CODE_LENGTH = 6;

/*
 * join_room_by_code 가 던지는 문구는 영어다. 사람이 읽을 말로 바꾼다.
 * 알려진 문구만 번역하며 서버 원문은 노출하지 않는다.
 */
const JOIN_ERRORS: Record<string, string> = {
  'Invalid invite code': '코드를 다시 확인해 주세요. 없는 초대 코드예요.',
  'This invite has expired': '초대 기간이 지났어요. 새 코드를 받아 주세요.',
  'Authentication is required': '로그인이 풀렸어요. 다시 로그인해 주세요.',
};

/**
 * 초대 코드로 방에 들어가는 시트.
 *
 * 예전에는 채팅 탭 화면(ChatHomeScreen) 안에 입력칸이 있었는데, 탭을 셋으로
 * 줄이면서 그 화면으로 가는 길이 없어졌다. 그 화면은 옛 디자인 그대로라 새 홈에서
 * 그리로 보내면 모습이 갑자기 바뀐다. 그래서 홈 위에 시트로 띄운다.
 */
export default function JoinCodeSheet({
  visible,
  onClose,
  onJoined,
  onMembershipClosed,
}: {
  visible: boolean;
  onClose: () => void;
  /** 들어간 방으로 이어 준다 */
  onJoined: (roomId: string) => void;
  onMembershipClosed?: () => void;
}) {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const ready = code.length === CODE_LENGTH && !joining;

  const close = () => {
    setCode('');
    onClose();
  };

  const join = async () => {
    if (!ready) return;
    setJoining(true);
    try {
      const { roomId, error } = await joinRoomByCode(code);
      if (error) {
        if (isRoomMembershipClosed(error)) { close(); onMembershipClosed?.(); notify('입장할 수 없어요', membershipClosedMessage); return; }
        // RPC 가 잘못된 코드·만료를 구분해서 던진다
        notify('입장할 수 없어요', JOIN_ERRORS[error.message] ?? '초대 코드를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setCode('');
      onClose();
      if (roomId) onJoined(roomId);
    } catch {
      notify('입장할 수 없어요', '초대 코드를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setJoining(false);
    }
  };

  // TODO(서버 단계): 6칸 입력·방 미리보기·만료 기준·시도 제한은 서버 계약과 함께 적용한다.
  return <BottomSheet visible={visible} title="초대 코드 입력" subtitle="메이트에게 받은 6자리 코드를 넣어 주세요" onClose={close}>
    <View style={styles.body}>
      <TextField label="초대 코드" value={code} onChangeText={(text) => setCode(text.replace(/\s/g, '').toUpperCase())}
        placeholder="예: ABC123" autoCapitalize="characters" autoCorrect={false} autoFocus maxLength={CODE_LENGTH}
        returnKeyType="go" editable={!joining} onSubmitEditing={() => void join()} />
      <Button label="입장" loading={joining} disabled={!ready} onPress={() => void join()} />
    </View>
  </BottomSheet>;
}
const styles = StyleSheet.create({ body: { gap: 16 } });
