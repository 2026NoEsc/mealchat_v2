import { Crown } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RoomParticipant } from '../../lib/rooms';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import Avatar from '../Avatar';

/** Phone 528:1501: profile imagery is dynamic; owner status requires ownerId. */
export default function RoomMemberRow({
  participant,
  myId,
  ownerId,
  onPress,
}: {
  participant: RoomParticipant;
  myId: string | null;
  ownerId: string | null;
  onPress?: () => void;
}) {
  const mine = Boolean(myId && participant.profileId === myId);
  const owner = Boolean(ownerId && participant.profileId === ownerId);
  const label = participant.name + (owner ? ', 방장' : '') + (mine ? ', 나' : '');

  const content = (
    <>
      <Avatar name={participant.name} url={participant.avatarUrl} seed={participant.profileId ?? participant.id} size={40} radius={20} />
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>{participant.name}</Text>
        {owner ? (
          <View style={styles.owner}>
            <Crown size={12} color={colors.selectedText} />
            <Text style={styles.ownerText}>{mine ? '방장 · 나' : '방장'}</Text>
          </View>
        ) : mine ? (
          <View style={styles.mine}>
            <Text style={styles.mineText}>나</Text>
          </View>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  name: { flexShrink: 1, fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: colors.ink },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.selectedBg },
  ownerText: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.selectedText },
  mine: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10, backgroundColor: colors.mutedBg },
  mineText: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.sub },
  pressed: { opacity: 0.7 },
});
