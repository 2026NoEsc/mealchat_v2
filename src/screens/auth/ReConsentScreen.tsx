import { CheckSquare, Square } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import ScreenHeader from '../../components/ScreenHeader';
import { AccentButton } from '../../components/ui/Button';
import { recordTermsConsent } from '../../lib/consents';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

const TERMS = [
  { key: 'service', label: '서비스 이용약관 동의', required: true },
  { key: 'privacy', label: '개인정보 수집·이용 동의', required: true },
  { key: 'marketing', label: '마케팅 정보 수신 동의 (선택)', required: false },
] as const;

type TermKey = (typeof TERMS)[number]['key'];

/**
 * 동의 기록이 생기기 전에 가입한 사용자에게 현재 약관 동의를 다시 받는다.
 *
 * 기존 사용자는 어떤 버전에 동의했는지 기록이 없어서 일부러 backfill 하지 않았다.
 * 없는 동의를 만들어 두는 것보다 다시 받는 편이 정확하다.
 */
export default function ReConsentScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const [agreed, setAgreed] = useState<Record<TermKey, boolean>>({
    service: false,
    privacy: false,
    marketing: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const allAgreed = TERMS.every((term) => agreed[term.key]);
  const canSubmit = TERMS.filter((term) => term.required).every((term) => agreed[term.key]);

  const toggleAll = () => {
    const next = !allAgreed;
    setAgreed({ service: next, privacy: next, marketing: next });
  };

  const submit = async () => {
    if (!canSubmit) {
      Alert.alert('약관 동의', '필수 약관에 동의해 주세요.');
      return;
    }

    setSubmitting(true);
    const error = await recordTermsConsent(agreed.marketing);
    setSubmitting(false);

    if (error) {
      Alert.alert('저장 실패', error.message);
      return;
    }

    onDone();
  };

  const leave = async () => {
    const error = await signOut();
    if (error) Alert.alert('로그아웃 실패', error.message);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="약관 동의" />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          {'약관이 새로 정리됐어요.\n계속 이용하시려면 아래 항목에 동의해 주세요.'}
        </Text>

        <Pressable style={styles.allRow} onPress={toggleAll}>
          <Check checked={allAgreed} />
          <Text style={styles.allLabel}>전체 동의하기</Text>
        </Pressable>

        <View style={styles.terms}>
          {TERMS.map((term) => (
            <Pressable
              key={term.key}
              style={styles.row}
              onPress={() => setAgreed((prev) => ({ ...prev, [term.key]: !prev[term.key] }))}>
              <Check checked={agreed[term.key]} />
              <Text style={styles.label}>{term.label}</Text>
            </Pressable>
          ))}
        </View>

        <AccentButton
          label={submitting ? '저장 중' : '동의하고 계속하기'}
          style={styles.submit}
          disabled={!canSubmit || submitting}
          onPress={() => void submit()}
        />

        <Pressable style={styles.leaveRow} onPress={() => void leave()} disabled={submitting}>
          <Text style={styles.leave}>나중에 하기 (로그아웃)</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Check({ checked }: { checked: boolean }) {
  return checked ? (
    <CheckSquare size={s(11)} color={colors.primary} strokeWidth={2} />
  ) : (
    <Square size={s(11)} color={colors.textMuted} strokeWidth={2} />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  body: {
    paddingHorizontal: s(18),
    paddingBottom: s(30),
  },
  intro: {
    marginTop: s(26),
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(12),
    color: colors.textPrimary,
  },
  allRow: {
    marginTop: s(20),
    paddingBottom: s(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  allLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  terms: {
    marginTop: s(10),
    gap: s(10),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
  },
  label: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textPrimary,
  },
  submit: {
    marginTop: s(24),
    marginHorizontal: s(-6),
  },
  leaveRow: {
    marginTop: s(10),
    alignItems: 'center',
  },
  leave: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    color: colors.textMuted,
  },
});
