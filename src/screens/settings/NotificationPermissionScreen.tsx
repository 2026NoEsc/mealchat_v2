import { Bell, Calendar, MessageCircle, Receipt } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthFooter, authStyles } from '../../components/ui/AuthLayout';
import { PrimaryButton, TextButton } from '../../components/ui/Button';
import Toast, { useToast } from '../../components/ui/Toast';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { requestNotificationPermission } from './notificationPermission';

/** Phone 563:2071. Device permission only, with no fabricated push registration. */
export default function NotificationPermissionScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const locked = useRef(false);
  const active = useRef(true);
  const { showToast, toastProps } = useToast();
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!locked.current) onDone();
      return true;
    });
    return () => subscription.remove();
  }, [onDone]);
  const allow = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await requestNotificationPermission();
      if (active.current) onDone();
    } catch { if (active.current) showToast({ message: '알림 권한을 요청하지 못했어요. 잠시 후 다시 시도해 주세요.' }); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  };
  return <View style={[authStyles.screen, { paddingTop: insets.top }]}>
    <ScrollView style={authStyles.scroll} contentContainerStyle={styles.body}>
      <View style={styles.icon}><Bell size={44} color={colors.selectedText} aria-hidden={true} /></View>
      <Text accessibilityRole="header" style={styles.title}>{'약속 소식을 놓치지 않게\n알려 드릴까요?'}</Text>
      <View style={styles.reasons}>
        {[
          { Icon: Calendar, text: '일정이 확정되면' },
          { Icon: Receipt, text: '정산 요청이 오거나 모두 보내면' },
          { Icon: MessageCircle, text: '메이트가 메시지를 보내면' },
        ].map(({ Icon, text }) => <View key={text} style={styles.reason}>
          <Icon size={20} color={colors.selectedText} aria-hidden={true} /><Text style={styles.reasonText}>{text}</Text>
        </View>)}
      </View>
      <Text style={styles.hint}>알림은 휴대폰 설정에서 언제든 바꿀 수 있어요.</Text>
    </ScrollView>
    <View onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}><AuthFooter>
      <PrimaryButton label="알림 받기" loading={busy} onPress={() => void allow()} />
      <TextButton label="나중에" disabled={busy} onPress={() => { if (!locked.current) onDone(); }} />
    </AuthFooter></View>
    <Toast {...toastProps} bottom={footerHeight + 16} />
  </View>;
}

const styles = StyleSheet.create({
  body: { paddingTop: 96, paddingHorizontal: 24, paddingBottom: 24, gap: 20 },
  icon: { width: 96, height: 96, borderRadius: 36, backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 34, color: colors.ink },
  reasons: { padding: 16, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reasonText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 24, color: colors.ink },
  hint: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 20, color: colors.sub },
});
