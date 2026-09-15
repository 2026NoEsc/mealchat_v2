import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { notify } from '../lib/confirm';
import { joinRoomByCode } from '../lib/rooms';
import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';
import BottomSheet from './BottomSheet';

const CODE_LENGTH = 6;

/*
 * join_room_by_code 가 던지는 문구는 영어다. 사람이 읽을 말로 바꾼다.
 * 모르는 문구는 그대로 보여 준다 — 뭉뚱그린 안내보다 원문이 원인을 찾기 쉽다.
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
}: {
  visible: boolean;
  onClose: () => void;
  /** 들어간 방으로 이어 준다 */
  onJoined: (roomId: string) => void;
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
        // RPC 가 잘못된 코드·만료를 구분해서 던진다
        notify('입장할 수 없어요', JOIN_ERRORS[error.message] ?? error.message);
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

  return (
    <BottomSheet
      visible={visible}
      title="초대 코드 입력"
      subtitle="친구에게 받은 6자리 코드를 넣어 주세요"
      onClose={close}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={code}
          /* 저장된 코드가 대문자라 입력도 맞춰 올린다 — RPC 는 정확히 일치해야 찾는다 */
          onChangeText={(text) => setCode(text.replace(/\s/g, '').toUpperCase())}
          placeholder="예: ABC123"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={CODE_LENGTH}
          returnKeyType="go"
          onSubmitEditing={() => void join()}
        />
        <Pressable
          style={[styles.enter, !ready && styles.enterDisabled]}
          disabled={!ready}
          onPress={() => void join()}
          accessibilityRole="button">
          <Text style={styles.enterText}>{joining ? '입장 중' : '입장'}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

/* 식당 정하기 시트(VotingSheet)의 입력줄과 같은 치수·글꼴을 쓴다 — 시트끼리 모양이 달라 보이지 않게 */
const styles = StyleSheet.create({
  row: {
    marginTop: s(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  input: {
    flex: 1,
    height: s(24),
    borderRadius: s(8),
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: s(9),
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    color: colors.textPrimary,
  },
  enter: {
    height: s(24),
    paddingHorizontal: s(12),
    borderRadius: s(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterDisabled: {
    opacity: 0.4,
  },
  enterText: {
    fontFamily: fontFamily.bold,
    fontSize: fs(7.5),
    color: colors.textOnAccent,
  },
});
