import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import { CompleteButton } from '../../components/ui/Button';
import Toggle from '../../components/ui/Toggle';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

type Field = { key: string; label: string; detail: string };

const BASIC: Field[] = [
  { key: 'birth', label: '생년월일', detail: '1111년 11월 11일' },
  { key: 'gender', label: '성별', detail: '남성' },
  { key: 'bio', label: '한마디 멘트', detail: '오늘도 맛있는 하루' },
];

const SENSITIVE: Field[] = [
  { key: 'account', label: '계좌번호', detail: '정산 시에만 공개' },
  { key: 'origin', label: '출발지 주소', detail: '중간 지점 계산에만 사용' },
];

/** Figma 기본 상태 — 한마디 멘트와 계좌번호만 꺼져 있다 */
const INITIAL: Record<string, boolean> = {
  birth: true,
  gender: true,
  bio: false,
  account: false,
  origin: true,
};

/**
 * Figma 프로필/정보 공개 범위 (256:2494) — 220 x 486
 * body x11.5 y82 w197 / 기본 정보 카드 y121 / 민감 정보 카드 y246 /
 * 자물쇠 안내 y341 / 저장 버튼 y358
 */
export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { resetTo } = useNavigation();
  const [shared, setShared] = useState(INITIAL);

  const toggle = (key: string) => setShared((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>정보 공개 범위</Text>
        <Text style={styles.sub}>밥약 메이트에게 보여줄 정보를 선택하세요</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>기본 정보</Text>
          {BASIC.map((field, i) => (
            <Row
              key={field.key}
              field={field}
              divided={i > 0}
              value={shared[field.key]}
              onChange={() => toggle(field.key)}
            />
          ))}
        </View>

        <View style={[styles.card, styles.cardSpacing]}>
          <Text style={[styles.cardTitle, styles.cardTitleDanger]}>민감 정보</Text>
          {SENSITIVE.map((field, i) => (
            <Row
              key={field.key}
              field={field}
              divided={i > 0}
              value={shared[field.key]}
              onChange={() => toggle(field.key)}
            />
          ))}
        </View>

        <View style={styles.notice}>
          <Lock size={s(7)} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.noticeText}>꺼둔 정보는 방장에게도 보이지 않아요</Text>
        </View>

        <CompleteButton label="저장하기" style={styles.cta} onPress={() => resetTo('Profile')} />
      </ScrollView>
    </View>
  );
}

function Row({
  field,
  divided,
  value,
  onChange,
}: {
  field: Field;
  divided: boolean;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <View style={[styles.row, divided && styles.rowDivided]}>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{field.label}</Text>
        <Text style={styles.rowDetail}>{field.detail}</Text>
      </View>
      <Toggle value={value} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  body: {
    paddingHorizontal: s(11.5),
    paddingTop: s(10),
    paddingBottom: s(20),
  },
  title: {
    fontFamily: fontFamily.body,
    fontSize: fs(12),
    lineHeight: fs(16),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  sub: {
    marginTop: s(7),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  card: {
    marginTop: s(7),
    backgroundColor: colors.card,
    borderRadius: s(10),
    paddingHorizontal: s(9),
    paddingTop: s(8),
    paddingBottom: s(4),
  },
  cardSpacing: {
    marginTop: s(7),
  },
  cardTitle: {
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  cardTitleDanger: {
    color: colors.danger,
  },
  row: {
    height: s(30),
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDivided: {
    borderTopWidth: s(0.6),
    borderTopColor: colors.border,
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  rowDetail: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  notice: {
    marginTop: s(8),
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingHorizontal: s(9),
    paddingVertical: s(4),
    borderRadius: s(10),
    backgroundColor: colors.primarySoft,
  },
  noticeText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    fontWeight: weight.semibold,
    color: colors.primary,
  },
  cta: {
    marginTop: s(9),
  },
});
