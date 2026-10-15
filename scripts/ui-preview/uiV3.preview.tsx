/**
 * Manual visual fixture. Run from the repository root in PowerShell:
 * $env:EXPO_NO_DOTENV='1'; $env:EXPO_OFFLINE='1'; $env:EXPO_OVERRIDE_METRO_CONFIG='scripts/ui-preview/metro.config.cjs'
 * node node_modules/expo/bin/cli start --localhost --port 8095
 * In a second terminal: node scripts/ui-preview/uiV3.browser.cjs
 * The preview resolver blocks the production Supabase client; no .env is loaded.
 */
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { AppRegistry, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';

import BottomNav from '../../src/components/BottomNav';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { Button } from '../../src/components/ui/Button';
import { Checkbox } from '../../src/components/ui/Checkbox';
import { Chip } from '../../src/components/ui/Chip';
import { ListRow } from '../../src/components/ui/ListRow';
import { Radio } from '../../src/components/ui/Radio';
import { Switch } from '../../src/components/ui/Switch';
import TextField from '../../src/components/ui/TextField';
import { v3Colors } from '../../src/theme/tokens';
import NotificationPanel from '../../src/components/NotificationPanel';
import { SignupDraftProvider, useSignupDraft } from '../../src/auth/SignupDraftProvider';
import { NavigationProvider } from '../../src/navigation/NavigationContext';
import SignupPersonalScreen from '../../src/screens/signup/SignupPersonalScreen';

function SignupFixture() {
  const { updateDraft } = useSignupDraft();
  useEffect(() => {
    updateDraft({ nickname: '밀챗', email: 'mealchat@example.test', bank: '카카오페이', account: '000000000', birth: { year: '2000', month: '1', day: '1' } });
  }, [updateDraft]);
  return <SignupPersonalScreen />;
}

function NotificationsFixture() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: 24 }}><AppHeader hasUnread onPressBell={() => setOpen(true)} /></View>
      <Text style={styles.title}>알림 패널 미리보기</Text>
      {open ? <NotificationPanel notices={[]} allRead onClose={() => setOpen(false)} /> : null}
    </View>
  );
}

function Preview() {
  const [fontsLoaded, fontError] = useFonts({
    'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'),
    'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'),
    'Dot42Sans-SemiBold': require('../../assets/fonts/42dotSans-SemiBold.ttf'),
    'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf'),
    'Dot42Sans-ExtraBold': require('../../assets/fonts/42dotSans-ExtraBold.ttf'),
    'IosevkaCharon-Bold': require('../../assets/fonts/IosevkaCharon-Bold.ttf'),
  });
  const [selected, setSelected] = useState(true);
  const [value, setValue] = useState('밀챗');
  const [pressCount, setPressCount] = useState(0);
  const params = new URLSearchParams(globalThis.location?.search);
  const states = params.get('states') === '1';
  const scene = params.get('scene');
  if (!fontsLoaded && !fontError) return <Text>폰트 불러오는 중</Text>;
  if (scene === 'signup' || scene === 'notifications') {
    return (
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets: { top: scene === 'notifications' ? 24 : 0, bottom: 0, left: 0, right: 0 } }}>
        <SafeAreaInsetsContext.Provider value={{ top: scene === 'notifications' ? 24 : 0, bottom: 0, left: 0, right: 0 }}>
          {scene === 'notifications' ? <NotificationsFixture /> : (
            <NavigationProvider initialRoute="SignupPersonal"><SignupDraftProvider><SignupFixture /></SignupDraftProvider></NavigationProvider>
          )}
        </SafeAreaInsetsContext.Provider>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}>
      <View style={styles.screen}>
        <AppHeader hasUnread onPressBell={() => setSelected(!selected)} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{states ? '입력 · 버튼 상태' : '공용 컴포넌트'}</Text>
          <Button label="주 버튼" />
          <Button label="보조 버튼" variant="secondary" />
          {states ? (
            <>
              <Button label="비활성 버튼" disabled onPress={() => setPressCount((count) => count + 1)} />
              <Button label="저장 중" loading onPress={() => setPressCount((count) => count + 1)} />
              <Text testID="inactive-press-count" style={{ display: 'none' }}>{pressCount}</Text>
              <TextField label="오류 상태" value={value} onChangeText={setValue} error="이미 사용 중인 닉네임입니다" helper="두 글자 이상" />
              <TextField label="읽기 전용" value="mealchat@example.com" editable={false} />
            </>
          ) : (
            <>
              <Button label="텍스트 버튼" variant="text" />
              <TextField label="닉네임" value={value} onChangeText={setValue} helper="두 글자 이상 입력해 주세요" />
              <View style={styles.chips}>
                <Chip label="한식" selected={selected} onChange={setSelected} />
                <Chip label="양식" selected={!selected} onChange={(next) => setSelected(!next)} />
              </View>
              <Radio label="추천 시간" selected={selected} onSelect={() => setSelected(true)} />
              <Checkbox label="알림 받기" checked={selected} onChange={setSelected} />
              <View style={styles.switchRow}>
                <Text>정보 공개</Text>
                <Switch value={selected} onChange={setSelected} accessibilityLabel="정보 공개" />
              </View>
              <ListRow title="닉네임" value="밀챗" onPress={() => setSelected(!selected)} />
            </>
          )}
        </ScrollView>
        <BottomNav active="home" onChange={() => setSelected(!selected)} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v3Colors.bg },
  content: { padding: 16, gap: 12 },
  title: { fontFamily: 'Dot42Sans-Bold', fontSize: 20, lineHeight: 28, color: v3Colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

AppRegistry.registerComponent('V3Preview', () => Preview);
AppRegistry.runApplication('V3Preview', { rootTag: document.getElementById('root') });
