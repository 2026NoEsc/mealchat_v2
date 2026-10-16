import { Check, Clock3 } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { characterIndexOf } from '../../lib/defaultAvatar';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
const MEMBER_ARTS = [require('../../../assets/brand/moa.png'), require('../../../assets/brand/ddori.png'), require('../../../assets/brand/dudu.png'), require('../../../assets/brand/welling2.png')];

/** Figma 598:2385/2394; row layout matches the settlement-list instances. */
export default function SettleMember({ name, seed, completed, mine = false, layout = 'column', onPress, disabled = false }: {
  name: string; seed: string; completed: boolean; mine?: boolean; layout?: 'row' | 'column'; onPress?: () => void; disabled?: boolean;
}) {
  const row = layout === 'row';
  const actionable = Boolean(onPress) && !disabled;
  const Icon = completed ? Check : Clock3;
  const content = <>
    <View style={[styles.avatar, row && styles.rowAvatar, !row && completed && styles.avatarDone]}><Image source={MEMBER_ARTS[characterIndexOf(seed, MEMBER_ARTS.length)]} style={styles.art} resizeMode="contain" accessible={false} /></View>
    <View style={row ? styles.rowName : undefined}><Text numberOfLines={1} style={[styles.name, row && styles.rowNameText]}>{name}{mine ? ' (나)' : ''}</Text>
      {row && mine && actionable ? <Text style={styles.helper}>{completed ? '다시 누르면 대기' : '눌러서 완료'}</Text> : null}</View>
    <View style={[styles.badge, row && styles.rowBadge, completed ? styles.done : row && styles.rowWait]}>
      <Icon size={row ? 14 : 12} color={completed ? colors.safeText : row ? colors.sub : colors.selectedText} />
      <Text style={[styles.state, row && styles.rowState, completed ? styles.doneText : row && styles.rowWaitText]}>{completed ? '완료' : '대기'}</Text>
    </View>
    {!row && actionable ? <Text style={styles.helper}>{completed ? '다시 누르면 대기' : '눌러서 완료'}</Text> : null}
  </>;
  const style = [styles.member, row && styles.row];
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={name + (mine ? ' (나)' : '') + ', ' + (completed ? '완료' : '대기')}
    accessibilityHint={actionable ? completed ? '누르면 대기로 변경' : '누르면 완료로 변경' : undefined}
    accessibilityState={{ disabled: !actionable }} disabled={!actionable} onPress={onPress} style={style}>{content}</Pressable>
    : <View style={style}>{content}</View>;
}
const styles = StyleSheet.create({
  member: { minHeight: v3Layout.minTouchTarget, gap: 4, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 6, alignSelf: 'stretch' },
  avatar: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.mutedBg },
  rowAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 0 },
  art: { width: '100%', height: '100%' },
  avatarDone: { borderColor: colors.safeText },
  name: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19, color: colors.ink },
  rowName: { flex: 1 }, rowNameText: { fontSize: 15, lineHeight: 22 },
  badge: { backgroundColor: colors.selectedBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, flexDirection: 'row', gap: 3, alignItems: 'center' },
  rowBadge: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, gap: 4 },
  rowWait: { backgroundColor: colors.mutedBg },
  done: { backgroundColor: colors.safeBg },
  state: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.selectedText },
  rowState: { fontSize: 13, lineHeight: 19 },
  rowWaitText: { color: colors.sub },
  doneText: { color: colors.safeText },
  helper: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 16, color: colors.sub },
});
