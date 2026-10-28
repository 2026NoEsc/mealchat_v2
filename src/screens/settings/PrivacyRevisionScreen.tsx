import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, TextButton } from '../../components/ui/Button';
import { authStyles } from '../../components/ui/AuthLayout';
import { privacy } from '../../legal/privacy';
import { privacyNoticeDate, privacyRevisionDocument, privacyRevisionPublication, privacyRevisionSummary } from '../../legal/privacyRevision';
import { v3Colors as colors } from '../../theme/tokens';
import SettingsFrame from './SettingsFrame';
import LegalDocumentBody from './LegalDocumentBody';

/** Local preview only: unfinalized metadata must never be submitted as consent. */
export default function PrivacyRevisionScreen() {
  const [page, setPage] = useState<'summary' | 'draft' | 'previous'>('summary');
  const date = privacyNoticeDate();
  const meta = `개정안 · 시행일 ${date ?? '미정'} · ${privacyRevisionPublication.edition === null ? '판 번호 미정' : `${privacyRevisionPublication.edition}판`}`;
  return <SettingsFrame title={page === 'summary' ? '바뀌는 점 보기' : page === 'previous' ? '개인정보 처리방침 · 1판' : '개인정보 처리방침 · 개정안'}>
    {page === 'summary' ? <ScrollView contentContainerStyle={styles.body}>
      <Text accessibilityRole="header" style={authStyles.title}>개인정보를 이렇게 지켜요</Text>
      <Text style={authStyles.subtitle}>{date ? `${date}부터 적용할 변경 내용을 미리 알려 드려요.` : '시행일은 아직 정해지지 않았어요.'}</Text>
      <View style={styles.summary}>{privacyRevisionSummary.map(text => <Text key={text} style={authStyles.subtitle}>{text}</Text>)}</View>
      <PrimaryButton label="개정안 원문 보기" onPress={() => setPage('draft')} />
      <TextButton label="이전 판 보기 · 1판" onPress={() => setPage('previous')} />
    </ScrollView> : <>
      <TextButton label="변경 요약으로" onPress={() => setPage('summary')} />
      <LegalDocumentBody document={page === 'previous' ? privacy : privacyRevisionDocument()} metadataLabel={page === 'previous' ? undefined : meta} />
    </>}
  </SettingsFrame>;
}
const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40, gap: 18 },
  summary: { padding: 16, gap: 16, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16 },
});
