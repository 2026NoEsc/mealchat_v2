import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { previewText } from '../lib/emoticon';
import { relativeTime } from '../lib/format';
import { roomStatus } from '../lib/roomFormat';
import type { RoomStage, RoomSummary } from '../lib/rooms';
import { formatMeetingTime } from '../lib/meetingTime';
import { unverifiedSettlementLabel } from '../lib/roomSettlementPolicy';
import { v3Colors as colors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';
import RoomTimer from './ui/RoomTimer';
const ROOM_ARTS = [require('../../assets/brand/moa.png'), require('../../assets/brand/ddori.png'), require('../../assets/brand/dudu.png'), require('../../assets/brand/welling2.png')];
// Same room-id assignment as roomCharacterFor; original assets retain Figma's transparent padding.
function roomArt(id: string) { return ROOM_ARTS[Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % ROOM_ARTS.length]; }

// Figma 521:1248 홈은 '약속 확정'을 사용한다. rooms.STAGE_LABEL의 공통 '확정'과 의도적으로 다르다.
export const HOME_STAGE_LABELS: Record<RoomStage, string> = {
  scheduling: '일정 조율 중', place: '식당 정하는 중', confirmed: '약속 확정', settling: '정산 중', done: '정산 완료',
};
// TODO(서버 단계): 메뉴 선택 단계가 RoomStage에 추가되면 '메뉴 정하는 중'으로 표시한다.

function meetingLabel(room: RoomSummary) {
  // TODO(서버 단계): 실제 제출 인원 조회가 제공되면 표시한다. 참가 인원으로 대신하지 않는다.
  const when = formatMeetingTime(room.meetingTime, room.stage, room.confirmedSlot);
  return [when, room.locationName || '장소 미정'].filter(Boolean).join(' · ');
}

/** Figma 521:1275: 48px avatar, 14px padding and a textual stage. */
export default function RoomRow({ room, unreadCount = 0, onPress }: {
  room: RoomSummary; unreadCount?: number; onPress: () => void;
}) {
  const expired = roomStatus(room) === 'expired';
  const settlementLabel = unverifiedSettlementLabel(room.stage, Boolean(room.appointmentConfirmedAt), room.decisionMode === 's4');
  const confirmed = !expired && !settlementLabel && (room.stage === 'confirmed' || room.stage === 'done');
  const active = !expired && (room.stage === 'place' || room.stage === 'settling');
  const label = expired ? '종료' : settlementLabel ?? HOME_STAGE_LABELS[room.stage];
  return <Pressable accessibilityRole="button" accessibilityLabel={room.title + ', ' + label} onPress={onPress}
    style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.avatar}><Image source={roomArt(room.id)} resizeMode="contain" style={styles.image} /></View>
    <View style={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>{room.title}</Text>
        <View style={[styles.chip, confirmed && styles.safe, active && styles.active]}><Text style={[styles.stage, confirmed && styles.safeText, active && styles.activeText]}>{label}</Text></View>
      </View>
      <Text style={styles.meta} numberOfLines={2}>{meetingLabel(room)}</Text>
      {room.decisionMode === 's4' && (room.stage === 'settling' || room.stage === 'done') ?
        <RoomTimer expiresAt={room.expiresAt} settled={room.stage === 'done'} boundedSettlement /> : null}
      <Text style={styles.preview} numberOfLines={1}>{room.lastMessage ? room.lastMessage.senderName + ': ' + previewText(room.lastMessage.text) : '아직 대화가 없어요'}</Text>
    </View>
    <View style={styles.right}>
      {room.lastMessage ? <Text style={styles.time}>{relativeTime(room.lastMessage.createdAt)}</Text> : null}
      {/* TODO(서버 단계): 방별 읽음 정보가 생기면 실제 unreadCount를 연결한다. */}
      {unreadCount > 0 ? <View style={styles.unread}><Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View> : null}
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pressed: { opacity: 0.8 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.mutedBg, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  content: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  title: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 23, color: colors.ink },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.mutedBg },
  stage: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.sub },
  safe: { backgroundColor: colors.safeBg }, safeText: { color: colors.safeText },
  active: { backgroundColor: colors.selectedBg }, activeText: { color: colors.selectedText },
  meta: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  preview: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  right: { alignItems: 'flex-end', gap: 8 },
  time: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18, color: colors.sub },
  unread: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  unreadText: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.onPrimary },
});
