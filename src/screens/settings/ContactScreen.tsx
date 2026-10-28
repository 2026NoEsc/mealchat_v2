import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Chip } from '../../components/ui/Chip';
import { notify } from '../../lib/confirm';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ProfileFrame from '../profile/ProfileFrame';

/** Phone 601:3208. No support address or submission service exists locally. */
export default function ContactScreen({ onSubmit }: { onSubmit?: (draft: { category: string; content: string; includeDevice: boolean }) => Promise<void> } = {}) {
  const [category, setCategory] = useState('앱 오류');
  const [content, setContent] = useState('');
  const [includeDevice, setIncludeDevice] = useState(false);
  const [focused, setFocused] = useState(false);
  return <ProfileFrame title="문의하기" footer={<Button label="보내기 · 준비 중" disabled={!content.trim()} onPress={() => { if (onSubmit) void onSubmit({ category, content, includeDevice }).catch(() => notify('문의 전송 실패', '작성한 내용을 유지했어요. 다시 시도해 주세요.')); else notify('문의 전송 준비 중', '문의 접수 서비스와 연락처가 아직 연결되지 않았어요. 작성한 내용은 전송되지 않았어요.'); }} />}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
      <Text style={styles.label}>어떤 문의인가요?</Text><View style={styles.categories}>{['앱 오류', '계정', '정산', '제안', '기타'].map(label => <Chip key={label} label={label} selected={category === label} onChange={() => setCategory(label)} />)}</View>
      <Text style={styles.label}>내용</Text><TextInput accessibilityLabel="문의 내용" multiline maxLength={2000} value={content} onChangeText={setContent} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="문의 내용을 입력해 주세요." placeholderTextColor={colors.sub} style={[styles.input, focused && styles.focused]} textAlignVertical="top" />
      <Checkbox label="기기 정보와 앱 버전을 함께 보내기" checked={includeDevice} onChange={setIncludeDevice} />
      <Text style={styles.note}>문의 전송을 준비하고 있어요. 작성한 내용과 기기 정보는 아직 수집하거나 전송하지 않아요.</Text>
    </ScrollView>
  </ProfileFrame>;
}
const styles = StyleSheet.create({
  body: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 120, gap: 16 }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19, color: colors.sub }, note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  input: { height: 160, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22, color: colors.ink }, focused: { borderWidth: 2, borderColor: colors.primary },
});
