import { useState } from 'react';
import { localMealExamples } from './localMealExamples';
import { CalendarDays, MapPin, X } from 'lucide-react-native';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { notify } from '../../lib/confirm';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { historyStyles as shared, type MealRecord, RecordMates } from './MealHistoryScreen';

/** Phone 542:1633. No route-provided financial data or simulated persistence. */
export default function MealReceiptScreen({ record }: { record?: MealRecord }) {
  const { goBack, canGoBack, resetTo, current } = useNavigation();
  const insets = useSafeAreaInsets();
  const localRecord = localMealExamples.find(item => item.id === current?.params?.exampleId);
  record = record ?? localRecord;
  const [saved, setSaved] = useState(false);
  return <View style={[styles.screen, { paddingTop: insets.top }]}>
    <View style={styles.header}><View style={styles.close} /><Text style={styles.headerTitle}>영수증</Text><Pressable accessibilityRole="button" accessibilityLabel="영수증 닫기" onPress={() => canGoBack ? goBack() : resetTo('MealHistory')} style={styles.close}><X size={24} color={colors.ink} /></Pressable></View>
    <ScrollView contentContainerStyle={styles.body}>
      {localRecord && <Text style={shared.sub}>로컬 예시 · 실제 내역이 아니에요. 저장·공유는 서버 연결 대기예요.</Text>}<View style={styles.receipt}><View style={styles.head}><Text style={styles.brand}>MEALCHAT RECEIPT</Text><Text style={styles.title}>{record?.title ?? '영수증을 준비하고 있어요'}</Text></View>
        {record ? <>
          <View style={styles.dash} /><View style={styles.row}><CalendarDays size={16} color={colors.sub} /><Text style={shared.caption}>약속 일시</Text><Text style={styles.value}>{record.date.replaceAll('-', '.')} {record.time}</Text></View>
          <View style={styles.row}><MapPin size={16} color={colors.sub} /><Text style={shared.caption}>약속 장소</Text><Text style={styles.value}>{record.place}</Text></View>
          <View style={styles.row}><Text style={[shared.sub, shared.grow]}>함께한 사람</Text><RecordMates mates={record.mates} size={26} /><Text style={styles.value}>{record.mates.length}명</Text></View>
          <Image source={record.photo} style={styles.photo} resizeMode="cover" accessible={false} /><View style={styles.dash} />
          {record.items.map((item, index) => <View key={index} style={styles.row}><Text style={shared.sub}>{item.name}</Text><Text style={shared.caption}>×{item.quantity}</Text><Text style={[styles.value, shared.grow]}>{item.amount.toLocaleString('ko-KR')}</Text></View>)}
          <View style={styles.dash} /><View style={styles.row}><Text style={[shared.title, shared.grow]}>합계</Text><Text style={styles.total}>{record.amount.toLocaleString('ko-KR')}원</Text></View>
          <View style={[styles.row, styles.each]}><Text style={[styles.brand, shared.grow]}>1인당 · 내 몫</Text><Text style={[shared.title, { color: colors.selectedText }]}>{record.share.toLocaleString('ko-KR')}원</Text></View>
          <Text style={styles.tagline}>함께 먹어서 더 맛있었던 날 · {record.date.replaceAll('-', '.')}</Text>
        </> : <Text style={shared.sub}>기록 보관 서비스가 아직 연결되지 않았어요. 저장된 영수증은 현재 제공되지 않아요.</Text>}
      </View>
      <Image source={require('./assets/receipt-edge.png')} style={styles.edge} resizeMode="stretch" accessible={false} />
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(24, insets.bottom) }]}><Button label={saved ? "저장 준비됨 · 로컬 예시" : "이미지로 저장"} variant="secondary" disabled={!record} style={shared.grow} onPress={() => { setSaved(true); notify('이미지 저장 준비 중', '아직 이미지를 저장하지 않았어요.'); }} /><Button label="메이트에게 공유" disabled={!record} style={shared.grow} onPress={() => notify('영수증 공유 준비 중', '아직 영수증을 공유하지 않았어요.')} /></View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mutedBg }, header: { padding: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }, close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: 17, color: colors.ink },
  body: { paddingTop: 4, paddingHorizontal: 24, paddingBottom: 24 }, receipt: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, gap: 14, backgroundColor: colors.surface },
  head: { alignItems: 'center', gap: 4 }, brand: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.selectedText }, title: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 32, color: colors.ink, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, value: { flexShrink: 1, marginLeft: 'auto', textAlign: 'right', fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 19, color: colors.ink },
  photo: { width: '100%', height: 150, borderRadius: 12 }, edge: { width: '100%', height: 12 }, dash: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  total: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.ink }, each: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.selectedBg },
  tagline: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18, color: colors.sub, textAlign: 'center' }, footer: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', gap: 8 },
});
