import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DangerButton } from '../../components/ui/Button';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

const moa = require('../../../assets/brand/moa.png');
const dudu = require('../../../assets/brand/dudu.png');
const ddori = require('../../../assets/brand/ddori.png');
const welling = require('../../../assets/brand/welling2.png');

const INVITE_CODE = 'VF4HLD';

type Member = { name: string; role: '방장' | '메이트'; avatar: ImageSourcePropType };

const MEMBERS: Member[] = [
  { name: '모아(나)', role: '방장', avatar: moa },
  { name: '두두', role: '메이트', avatar: dudu },
  { name: '또리', role: '메이트', avatar: ddori },
  { name: '웰링', role: '메이트', avatar: welling },
];

/**
 * Figma 채팅방/방 상세정보 (159:604) — 220 x 486
 * body x12 y86 w197 / 초대코드 카드 y109 h43 / 약속 장소 카드 y159 h52 /
 * 멤버 카드 y218 h123 / 방 나가기 y348 h28
 */
export default function RoomDetailScreen() {
  const insets = useSafeAreaInsets();
  const { goBack, resetTo, current } = useNavigation();
  const title = (current.params as { title?: string } | undefined)?.title ?? '오늘 점심팟';

  const [copied, setCopied] = useState(false);

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />

      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={s(8)}>
          <ChevronLeft size={s(14)} color={colors.textPrimary} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>방 상세정보</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>초대 코드</Text>
          <View style={styles.codeRow}>
            <Text style={styles.code}>{INVITE_CODE}</Text>
            <Pressable
              style={styles.copyButton}
              onPress={() => setCopied(true)}
              hitSlop={s(6)}>
              <Text style={styles.copyText}>{copied ? '복사됨' : '복사'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, styles.cardSpacing]}>
          <View style={styles.placeHeader}>
            <Text style={styles.placeTitle}>약속 장소</Text>
            <Pressable hitSlop={s(6)}>
              <Text style={styles.changeText}>변경</Text>
            </Pressable>
          </View>
          <Text style={styles.placeName}>조선칼국수 하단점</Text>
          <Text style={styles.placeDetail}>부산 사하구 하단동 • 도보 8분</Text>
        </View>

        <View style={[styles.card, styles.cardSpacing]}>
          <View style={styles.placeHeader}>
            <Text style={styles.placeTitle}>멤버 {MEMBERS.length}명</Text>
            <Pressable hitSlop={s(6)} onPress={() => setCopied(true)}>
              <Text style={styles.changeText}>＋ 초대</Text>
            </Pressable>
          </View>

          {MEMBERS.map((member) => (
            <View key={member.name} style={styles.memberRow}>
              <View style={styles.avatarBox}>
                <Image source={member.avatar} style={styles.avatar} resizeMode="contain" />
              </View>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text
                style={[
                  styles.memberRole,
                  member.role === '방장' && styles.memberRoleOwner,
                ]}>
                {member.role}
              </Text>
            </View>
          ))}
        </View>

        <DangerButton label="방 나가기" style={styles.leave} onPress={() => resetTo('Chat')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  header: {
    height: s(44),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(10),
    gap: s(8),
    backgroundColor: colors.surface,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(9),
    lineHeight: fs(13),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  body: {
    paddingHorizontal: s(12),
    paddingTop: s(12),
    paddingBottom: s(20),
  },
  title: {
    fontFamily: fontFamily.body,
    fontSize: fs(12),
    lineHeight: fs(16),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  card: {
    marginTop: s(7),
    backgroundColor: colors.card,
    borderRadius: s(10),
    paddingHorizontal: s(9),
    paddingVertical: s(8),
  },
  cardSpacing: {
    marginTop: s(7),
  },
  cardLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  codeRow: {
    marginTop: s(4),
    flexDirection: 'row',
    alignItems: 'center',
  },
  code: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(11),
    lineHeight: fs(15),
    fontWeight: weight.extrabold,
    letterSpacing: fs(1),
    color: colors.primary,
  },
  copyButton: {
    paddingHorizontal: s(7),
    paddingVertical: s(3),
    borderRadius: s(6),
    backgroundColor: colors.primarySoft,
  },
  copyText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.bold,
    color: colors.primary,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeTitle: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  changeText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.semibold,
    color: colors.primary,
  },
  placeName: {
    marginTop: s(6),
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  placeDetail: {
    marginTop: s(2),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  memberRow: {
    marginTop: s(7),
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: s(16),
    height: s(16),
    borderRadius: s(5),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: s(11),
    height: s(12),
  },
  memberName: {
    flex: 1,
    marginLeft: s(6),
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },
  memberRole: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  memberRoleOwner: {
    fontWeight: weight.bold,
    color: colors.primary,
  },
  leave: {
    marginTop: s(12),
  },
});
