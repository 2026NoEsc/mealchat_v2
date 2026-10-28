import { Moon } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ListRow } from '../../components/ui/ListRow';
import { Switch } from '../../components/ui/Switch';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import SettingsFrame from './SettingsFrame';

/** Phone 564:1875. Preview switches never change notification permission or consent. */
export default function NotificationPreferencesScreen({ preview = false, onDraftChange }: { preview?: boolean; onDraftChange?: (values: boolean[]) => void }) {
  const { navigate } = useNavigation();
  const [values, setValues] = useState([true, true, true, true, false, true, false]);
  const toggle = (index: number, label: string, note?: string) => <View key={label} style={styles.row}>
    <View style={styles.grow}><Text style={styles.title}>{label}</Text>{note ? <Text style={styles.note}>{note}</Text> : null}</View>
    <Switch accessibilityLabel={label} value={values[index]} disabled={(index > 0 && index < 6 && !values[0])} onChange={value => { const next = values.map((item, i) => i === index ? value : item); setValues(next); onDraftChange?.(next); }} />
  </View>;
  return <SettingsFrame title="알림 설정"><ScrollView contentContainerStyle={styles.body}>
    <Text style={styles.note}>{preview ? '디자인 미리보기 · 변경 사항은 저장되지 않아요.' : '이 화면의 임시 설정이에요 · 서버 연결 대기'}</Text>
    <Text style={styles.label}>전체</Text><View style={styles.card}>{toggle(0, '알림 받기', '끄면 아래 알림이 모두 멈춰요')}</View>
    <Text style={styles.label}>밥약</Text><View style={styles.card}>{toggle(1, '채팅 메시지')}{toggle(2, '일정 · 메뉴 · 식당 확정', '투표가 시작되거나 결정되면')}{toggle(3, '정산 요청 · 완료')}{toggle(4, '메이트 소식', '새 메이트가 들어오거나 나가면')}</View>
    <Text style={styles.label}>시간</Text><View style={styles.card}><View style={styles.moon}><Moon size={18} color={colors.sub} />{toggle(5, '방해 금지 시간', '밤 10시 ~ 아침 8시 · 소리 없이 쌓아 둬요')}</View></View>
    <Text style={styles.label}>광고성 정보</Text><View style={styles.card}>{preview ? toggle(6, '마케팅 정보 수신', '예시 상태 · 실제 동의가 아니에요') : <ListRow title="마케팅 정보 수신" value="선택 동의에서 확인" onPress={() => navigate('OptionalConsents')} />}</View>
  </ScrollView></SettingsFrame>;
}
const styles = StyleSheet.create({
  body: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 120, gap: 12 }, card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  label: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.sub }, row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingVertical: 10, gap: 12, flex: 1 }, grow: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 23, color: colors.ink }, note: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18, color: colors.sub }, moon: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
});
