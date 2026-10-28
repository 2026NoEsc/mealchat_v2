/** Local fixture gallery. Deliberately independent of production Auth/data services. */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import BottomNav from '../../components/ui/BottomNav';
import { NavigationProvider, useNavigation } from '../../navigation/NavigationContext';
import NotificationPreferencesScreen from '../settings/NotificationPreferencesScreen';
import { v3Colors as c } from '../../theme/tokens';
import AccountPreview from './AccountPreview';
import CameraPreview from './CameraPreview';
import ChatPreview from './ChatPreview';
import SettlementPreview from './SettlementPreview';
import MenuPreview from './MenuPreview';
import AdditionalPreview from './AdditionalPreview';
import { Copy, ui } from './PreviewUI';

export const remainingScenes = [
  { id: 'notifications', node: '564:1875', label: '프로필 / 알림 설정' },
  { id: 'delete', node: '601:3371', label: '프로필 / 계정 삭제' },
  { id: 'password', node: '601:3416', label: '프로필 / 비밀번호 확인' },
  { id: 'deleted', node: '601:3473', label: '프로필 / 탈퇴 완료 예시' },
  { id: 'camera', node: '589:1867', label: '정산 / 영수증 촬영' },
  { id: 'receipt-result', node: '589:1890', label: '정산 / 영수증 인식 결과' },
  { id: 'camera-denied', node: '683:13311', label: '정산 / 카메라 권한 꺼짐' },
  { id: 'camera-failure', node: '683:13350', label: '정산 / 영수증 인식 실패' },
  { id: 'block', node: '628:2477', label: '채팅방 / 차단 확인' },
  { id: 'reply', node: '628:2259', label: '채팅방 / 답장 쓰기' },
  { id: 'report', node: '562:2142', label: '채팅방 / 신고하기' },
  { id: 'settlement-requester', node: '629:1858', label: '정산 / 더보기 · 요청자' },
  { id: 'settlement-sender', node: '629:1993', label: '정산 / 더보기 · 보내는 사람' },
  { id: 'settlement-cancel', node: '629:2128', label: '정산 / 정산 취소 확인' },
  { id: 'menu-craving', node: '498:1191', label: '과거 메뉴 투표 시안 / 오늘 당기는 음식' },
  { id: 'menu-evaluate', node: '497:1127', label: '과거 메뉴 투표 시안 / 후보 평가' },
  { id: 'menu-result', node: '497:1287', label: '과거 메뉴 투표 시안 / 결과' },
  { id: 'menu-split', node: '497:1369', label: '과거 메뉴 투표 시안 / 의견 갈림' },
  { id: 'menu-confirm', node: '498:1312', label: '과거 메뉴 투표 시안 / 확정 확인' },
  { id: 'menu-change', node: '498:1404', label: '과거 메뉴 투표 시안 / 메뉴 변경 확인' },
  { id: 'menu-loading', node: '683:12744', label: '과거 메뉴 투표 시안 / 후보 고르는 중' },
  { id: 'menu-error', node: '683:12855', label: '과거 메뉴 투표 시안 / 후보 불러오기 실패' },
  { id: 'invite', node: '543:1609', label: '초대 링크 / 웹 랜딩' },
  { id: 'time-failure', node: '683:13139', label: '새 밥약 / 시간 추천 실패' },
  { id: 'location-denied', node: '683:18201', label: '새 밥약 / 위치 권한 꺼짐' },
  { id: 'message-failure', node: '683:13388', label: '채팅방 / 메시지 전송 실패' },
  { id: 'history-saved-lunch', node: '601:3701', label: '밥약 기록 / 팀 점심 이미지 저장됨 예시' },
  { id: 'history-saved-dinner', node: '601:3797', label: '밥약 기록 / 저녁팟 이미지 저장됨 예시' },
  { id: 'reminder-all', node: '629:2362', label: '정산 / 3명 알림 보냄 예시' },
  { id: 'reminder-one', node: '629:2461', label: '정산 / 웰링 알림 보냄 예시' },
] as const;

export default function FigmaRemainingGallery({ initialScene, onExit }: { initialScene?: string; onExit?: () => void }) {
  const [scene, setScene] = useState<string | undefined>(remainingScenes.some(item => item.id === initialScene) ? initialScene : undefined);
  const [note, setNote] = useState('');
  const select = (next?: string) => { setNote(''); setScene(next); };
  const back = () => select();
  const current = remainingScenes.find(item => item.id === scene);
  return <View style={ui.screen}>
    <View style={styles.banner}><Pressable accessibilityRole="button" accessibilityLabel={scene ? '갤러리 목록' : '미리보기 나가기'} onPress={() => scene ? back() : onExit?.()} style={{ minHeight: 44, justifyContent: 'center' }}><Copy bold size={11} style={{ color: c.selectedText }}>디자인 미리보기 · 실제 처리되지 않아요</Copy><Copy sub size={10}>{scene ? `‹ 목록　${current?.node ?? ''} · fixture` : `서버 미지원 화면 ${remainingScenes.length}개 · 로컬 예시`}</Copy></Pressable></View>
    {!scene ? <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}><Copy bold size={22}>화면 미리보기</Copy>{remainingScenes.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => select(item.id)} style={styles.item}><Copy bold size={15}>{item.label}</Copy><Copy sub size={12}>{item.node}</Copy></Pressable>)}</ScrollView> : <View key={scene} style={ui.grow} testID={`figma-${current?.node}`}>
      {scene.startsWith('menu-') ? <MenuPreview scene={scene} onBack={back} onScene={select} notify={setNote} />
        : ['invite', 'time-failure', 'location-denied', 'history-saved-lunch', 'history-saved-dinner'].includes(scene) ? <AdditionalPreview scene={scene} onBack={back} notify={setNote} />
        : scene === 'notifications' ? <NavigationProvider initialRoute="NotificationPreferences"><NotificationPreview onBack={back} /></NavigationProvider>
        : ['delete', 'password', 'deleted'].includes(scene) ? <AccountPreview scene={scene} onBack={back} onScene={select} />
          : scene.startsWith('camera') ? <CameraPreview scene={scene} onBack={back} onScene={select} notify={setNote} />
            : ['reply', 'report', 'block', 'message-failure'].includes(scene) ? <ChatPreview scene={scene} onBack={back} notify={setNote} />
              : <SettlementPreview scene={scene} onBack={back} onScene={select} notify={setNote} />}
    </View>}
    {!!note && <Pressable accessibilityRole="button" accessibilityLabel="예시 안내 닫기" onPress={() => setNote('')} style={styles.note}><Copy size={12} style={{ color: 'white' }}>{note}</Copy></Pressable>}
  </View>;
}
function NotificationPreview({ onBack }: { onBack: () => void }) {
  const { current } = useNavigation();
  useEffect(() => { if (current.name !== 'NotificationPreferences') onBack(); }, [current.name, onBack]);
  return <View style={ui.screen}><NotificationPreferencesScreen preview /><BottomNav active="profile" onChange={onBack} /></View>;
}
const styles = StyleSheet.create({
  banner: { paddingHorizontal: 12, backgroundColor: c.selectedBg, borderBottomWidth: 1, borderColor: c.border },
  item: { backgroundColor: 'white', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: c.border, gap: 4 },
  note: { position: 'absolute', left: 20, right: 20, bottom: 110, backgroundColor: c.ink, padding: 14, borderRadius: 12, minHeight: 44 },
});
