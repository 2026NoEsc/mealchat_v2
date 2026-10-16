import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { roomTimerLabel } from '../../lib/roomFormat';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** [결정] 정산 중에는 만료 규칙, 정산 완료 뒤에는 기존 실제 expiresAt 타이머를 복원한다. */
export default function RoomTimer({ expiresAt, settled }: { expiresAt: string; settled: boolean }) {
  const [label, setLabel] = useState(() => roomTimerLabel(expiresAt, settled));
  useEffect(() => {
    setLabel(roomTimerLabel(expiresAt, settled));
    if (!settled) return;
    const timer = setInterval(() => setLabel(roomTimerLabel(expiresAt, settled)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt, settled]);
  return label ? <Text testID="room-expiry-timer" style={styles.timer}>{label}</Text> : null;
}
const styles = StyleSheet.create({ timer: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, color: colors.sub } });
