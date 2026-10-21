import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { roomTimerLabel } from '../../lib/roomFormat';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** S4 uses the server's finite deadline, including the settlement/absolute retention caps. */
export default function RoomTimer({ expiresAt, settled, boundedSettlement = false }: { expiresAt: string; settled: boolean; boundedSettlement?: boolean }) {
  const [label, setLabel] = useState(() => roomTimerLabel(expiresAt, settled, new Date(), boundedSettlement));
  useEffect(() => {
    setLabel(roomTimerLabel(expiresAt, settled, new Date(), boundedSettlement));
    if (!settled && !boundedSettlement) return;
    const timer = setInterval(() => setLabel(roomTimerLabel(expiresAt, settled, new Date(), boundedSettlement)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt, settled, boundedSettlement]);
  return label ? <Text testID="room-expiry-timer" style={styles.timer}>{label}</Text> : null;
}
const styles = StyleSheet.create({ timer: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, color: colors.sub } });
