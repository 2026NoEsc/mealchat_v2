import { CalendarPlus, ChevronRight, Plus, Receipt, Ticket } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeaderConnected from '../components/ui/AppHeaderConnected';
import { Button } from '../components/ui/Button';
import FailureCard from '../components/ui/FailureCard';
import Toast, { useToast } from '../components/ui/Toast';
import JoinCodeSheet from '../components/JoinCodeSheet';
import RoomRow from '../components/RoomRow';
import { hasFinalConsonant } from '../lib/particle';
import { useNavigation } from '../navigation/NavigationContext';
import { useMyProfile } from '../profile/useMyProfile';
import { useMyRooms, useMySettlements } from '../rooms/useMyRooms';
import { useTopInset } from '../theme/insets';
import { v3Layout } from '../theme/scale';
import { v3Colors as colors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

const banner = require('../../assets/ad/banner-1.png');
const mascot = require('../../assets/brand/moa.png');

/** Figma 521:1248 / 559:1805 / 563:2123; tab space is owned by AppNavigator. */
export default function HomeScreen() {
  const { navigate, current, replace } = useNavigation();
  const { showToast, toastProps } = useToast();
  const deletedRoomId = current?.params?.deletedRoomId;
  const shownDeletion = useRef<string | null>(null);
  useEffect(() => {
    if (typeof deletedRoomId !== 'string' || !deletedRoomId || shownDeletion.current === deletedRoomId) return;
    shownDeletion.current = deletedRoomId;
    const roomTitle = typeof current.params?.deletedRoomTitle === 'string' && current.params.deletedRoomTitle.trim() ? current.params.deletedRoomTitle.trim() : '방';
    showToast({ message: roomTitle + (hasFinalConsonant(roomTitle) === false ? '를' : '을') + ' 없앴어요' });
    const next = { ...current.params };
    delete next.deletedRoomId;
    delete next.deletedRoomTitle;
    replace('Home', next);
  }, [deletedRoomId, current?.params, replace, showToast]);
  const topInset = useTopInset();
  const insets = useSafeAreaInsets();
  const { bundle } = useMyProfile();
  const { rooms, status, reload } = useMyRooms();
  const settlements = useMySettlements();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuShown, setMenuShown] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const pendingMenuAction = useRef<(() => void) | null>(null);
  const finishMenuDismiss = () => { const action = pendingMenuAction.current; pendingMenuAction.current = null; action?.(); };
  useEffect(() => { if (!menuShown && Platform.OS !== 'ios') finishMenuDismiss(); }, [menuShown]);
  const menu = useRef(new Animated.Value(0)).current;
  const toggleMenu = (next: boolean) => { setMenuOpen(next); if (next) setMenuShown(true); };
  useEffect(() => {
    if (!menuShown) return;
    // Start after the Modal mounts: detaching the old FAB otherwise stops its shared value.
    const animation = Animated.timing(menu, { toValue: menuOpen ? 1 : 0, duration: 160, useNativeDriver: false });
    animation.start(({ finished }) => { if (finished && !menuOpen) setMenuShown(false); });
    return () => animation.stop();
  }, [menu, menuOpen, menuShown]);
  const pick = (action: () => void) => { pendingMenuAction.current = action; toggleMenu(false); };
  const name = bundle?.profile.name;
  const openSettlements = settlements.filter((settlement) => !settlement.settled);
  const empty = status === 'ready' && rooms.length === 0;
  // TODO(서버 단계): 메이트 나가기 지원 후 실제 성공 이벤트에 '방에서 나왔어요' 토스트를 연결한다.
  // TODO(서버 단계): 영구 오프라인 캐시와 연결 상태가 필요하다. 현재 훅이 보존한 직전 목록만 표시한다.
  const fab = <Pressable style={[styles.fab, menuShown && { bottom: 20 + v3Layout.bottomNavHeight + insets.bottom }]} accessibilityRole="button" accessibilityLabel={menuOpen ? '메뉴 닫기' : '새 밥약 또는 초대 코드'} accessibilityState={{ expanded: menuOpen }} onPress={() => toggleMenu(!menuOpen)}>
      <Animated.View style={{ transform: [{ rotate: menu.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}><Plus size={26} color={colors.onPrimary} /></Animated.View>
    </Pressable>;
  return <View style={styles.screen}>
    <View style={{ height: topInset }} /><AppHeaderConnected />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.greetingBox}>
        <Text style={styles.greeting} numberOfLines={1}>{name ? '안녕하세요, ' + name + '님!' : '안녕하세요!'}</Text>
        <Text style={styles.sub}>오늘은 누구랑 먹을까요?</Text>
      </View>
      <Image source={banner} style={styles.banner} resizeMode="cover" accessibilityLabel="밥약 안내 배너" />
      {openSettlements.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={'미완료 정산 ' + openSettlements.length + '건 보기'} onPress={() => navigate('Settlements')} style={styles.nudge}>
        <Receipt size={20} color={colors.selectedText} /><Text style={styles.nudgeTitle}>미완료 정산 {openSettlements.length}건</Text>
        <Text style={styles.nudgeAction}>보기</Text><ChevronRight size={18} color={colors.selectedText} />
      </Pressable> : null}
      {status === 'loading' && rooms.length === 0 ? <Text style={styles.loading} accessibilityLiveRegion="polite">밥약을 불러오는 중...</Text> : null}
      {status === 'error' ? <FailureCard title="밥약을 불러오지 못했어요" onRetry={reload} /> : null}
      {empty ? <View style={styles.empty}>
        <Image source={mascot} style={styles.mascot} resizeMode="contain" />
        <Text style={styles.emptyTitle}>아직 잡힌 밥약이 없어요.</Text>
        <Text style={styles.emptySub}>새 밥약을 만들거나, 메이트에게 받은 초대 코드를 넣어 보세요.</Text>
        <Button label="새 밥약 만들기" onPress={() => navigate('ScheduleDetail')} style={styles.full} />
        <Button label="초대 코드 입력" variant="secondary" onPress={() => setJoinOpen(true)} style={styles.full} />
      </View> : null}
      {rooms.length > 0 ? <View style={styles.roomSection}>
        <View style={styles.listHead}><Text style={styles.listTitle}>내 밥약</Text><Text style={styles.count}>{rooms.length}개</Text></View>
        {status === 'error' ? <Text style={styles.sub}>이전에 불러온 밥약이에요.</Text> : null}
        <View style={[styles.list, status === 'error' && styles.stale]} pointerEvents={status === 'error' ? 'none' : 'auto'} accessibilityElementsHidden={status === 'error'} importantForAccessibility={status === 'error' ? 'no-hide-descendants' : 'auto'}>
          {rooms.map((room) => <RoomRow key={room.id} room={room} onPress={() => navigate('ChatRoom', { roomId: room.id, title: room.title, color: room.color })} />)}
        </View>
      </View> : null}
    </ScrollView>
    <Modal transparent visible={menuShown} onDismiss={finishMenuDismiss} animationType="none" onRequestClose={() => toggleMenu(false)}><View style={styles.menuRoot}>
      <Animated.View style={[styles.backdrop, { opacity: menu.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]}><Pressable style={StyleSheet.absoluteFill} onPress={() => toggleMenu(false)} accessibilityRole="button" accessibilityLabel="밥약 메뉴 닫기" /></Animated.View>
      <Animated.View style={[styles.menu, { opacity: menu, bottom: 92 + v3Layout.bottomNavHeight + insets.bottom }]} pointerEvents={menuOpen ? 'auto' : 'none'}>
        <Pressable accessibilityRole="button" accessibilityLabel="초대 코드 입력" onPress={() => pick(() => setJoinOpen(true))} style={styles.bubble}><Text style={styles.bubbleText}>초대 코드 입력</Text><View style={styles.bubbleIcon}><Ticket size={18} color={colors.selectedText} /></View></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="밥약 만들기" onPress={() => pick(() => navigate('ScheduleDetail'))} style={styles.bubble}><Text style={styles.bubbleText}>밥약 만들기</Text><View style={styles.bubbleIcon}><CalendarPlus size={18} color={colors.selectedText} /></View></Pressable>
      </Animated.View>
      {fab}
    </View></Modal>
    {rooms.length > 0 && !menuShown ? fab : null}
    <Toast {...toastProps} bottom={96} />
    <JoinCodeSheet visible={joinOpen} onClose={() => setJoinOpen(false)} onJoined={(roomId) => navigate('ChatRoom', { roomId })} />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 148, gap: 16 },
  greetingBox: { gap: 2 },
  greeting: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 32, color: colors.ink },
  sub: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub },
  banner: { width: '100%', height: 150, borderRadius: 16 },
  nudge: { minHeight: v3Layout.buttonHeight, borderRadius: 14, backgroundColor: colors.selectedBg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 8 },
  nudgeTitle: { flex: 1, fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.selectedText },
  nudgeAction: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.selectedText },
  loading: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub, textAlign: 'center', paddingVertical: 28 },
  roomSection: { gap: 16 },
  listHead: { paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listTitle: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 25, color: colors.ink },
  count: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19, color: colors.sub },
  list: { gap: 16 }, stale: { opacity: 0.45 },
  empty: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 28 },
  mascot: { width: 96, height: 80 },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 25, color: colors.ink, textAlign: 'center' },
  emptySub: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub, textAlign: 'center' },
  full: { alignSelf: 'stretch' },
  menuRoot: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink },
  menu: { position: 'absolute', right: 20, bottom: 92, alignItems: 'flex-end', gap: 12 },
  bubble: { minHeight: 48, paddingLeft: 18, paddingRight: 8, borderRadius: 24, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bubbleText: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  bubbleIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 5 },
});
