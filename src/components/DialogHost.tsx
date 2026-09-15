import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { subscribeDialogs, type DialogRequest } from '../lib/confirm';
import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

/**
 * 웹에서 확인·알림 창을 앱 안에 그린다.
 *
 * confirmAction / notify 가 쌓은 요청을 받아 하나씩 띄운다. 브라우저 기본 창
 * (window.confirm) 은 막혀 있으면 묻지도 않고 "취소" 를 돌려주므로 쓸 수 없다.
 * 네이티브는 Alert.alert 으로 충분해서 여기서는 아무것도 그리지 않는다.
 *
 * 앱 최상단에 한 번만 둔다. 화면 전환과 상관없이 늘 붙어 있어야 한다.
 */
export default function DialogHost() {
  /* 창이 떠 있는 동안 또 요청이 오면 줄을 세운다 — 앞 창을 덮으면 답을 잃는다 */
  const [queue, setQueue] = useState<DialogRequest[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    return subscribeDialogs((request) => setQueue((current) => [...current, request]));
  }, []);

  const current = queue[0];
  if (!current) return null;

  const close = () => setQueue((items) => items.slice(1));
  const confirm = () => {
    close();
    current.onConfirm?.();
  };

  const asks = Boolean(current.confirmLabel);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      {/* 바깥을 눌러도 닫힌다 — 되돌릴 수 없는 동작은 명시적으로 눌러야만 한다 */}
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="닫기">
        {/* 창 안쪽을 누를 때 바깥 닫기로 번지지 않게 막는다 */}
        <Pressable style={styles.card} onPress={() => undefined} accessibilityRole="alert">
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}

          <View style={styles.actions}>
            {asks ? (
              <Pressable
                style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed]}
                onPress={close}
                accessibilityRole="button">
                <Text style={styles.cancelText}>{current.cancelLabel ?? '취소'}</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                current.destructive ? styles.destructive : styles.primary,
                pressed && styles.pressed,
              ]}
              onPress={asks ? confirm : close}
              accessibilityRole="button">
              <Text style={styles.confirmText}>{current.confirmLabel ?? '확인'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(20),
  },
  card: {
    width: '100%',
    maxWidth: s(190),
    borderRadius: s(12),
    backgroundColor: colors.card,
    paddingTop: s(16),
    paddingHorizontal: s(14),
    paddingBottom: s(12),
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fs(10),
    lineHeight: fs(14),
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    marginTop: s(6),
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(11),
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    marginTop: s(14),
    flexDirection: 'row',
    gap: s(6),
  },
  button: {
    flex: 1,
    height: s(28),
    borderRadius: s(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    backgroundColor: colors.surface,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  destructive: {
    backgroundColor: colors.danger,
  },
  pressed: {
    opacity: 0.85,
  },
  cancelText: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(8),
    lineHeight: fs(11),
    color: colors.textSecondary,
  },
  confirmText: {
    fontFamily: fontFamily.bold,
    fontSize: fs(8),
    lineHeight: fs(11),
    color: colors.textOnAccent,
  },
});
