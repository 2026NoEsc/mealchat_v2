import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthTopBar, authStyles } from '../../components/ui/AuthLayout';
import { useNavigation } from '../../navigation/NavigationContext';

/** BottomNav is supplied once by AppNavigator, with the profile tab active. */
export default function SettingsFrame({ title, children }: { title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { goBack, canGoBack, resetTo } = useNavigation();
  return <View style={[authStyles.screen, { paddingTop: insets.top }]}>
    <AuthTopBar title={title} onBack={() => canGoBack ? goBack() : resetTo('Profile')} />
    {children}
  </View>;
}
