import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Figma 채팅방 하단 시트 공통 셸 (일정 553:408 / 메뉴 553:698 / 정산 553:727).
 * 상단 그랩 핸들 + 타이틀 + 서브타이틀, 본문은 각 시트가 채운다.
 */
export default function BottomSheet({ visible, title, subtitle, onClose, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    /*
     * 화면을 넘지 않게 막아 둔다. 이 값이 없으면 시트가 콘텐츠 높이만큼
     * 자라서 위쪽이 화면 밖으로 밀려 나간다.
     */
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderTopLeftRadius: s(14),
    borderTopRightRadius: s(14),
    paddingHorizontal: s(14),
    paddingTop: s(7),
    paddingBottom: s(16),
  },
  handle: {
    alignSelf: 'center',
    width: s(28),
    height: s(2.5),
    borderRadius: s(2.5),
    backgroundColor: colors.border,
  },
  title: {
    marginTop: s(10),
    fontFamily: fontFamily.extrabold,
    fontSize: fs(11),
    lineHeight: fs(15),
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
});
