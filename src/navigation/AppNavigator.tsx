import { StyleSheet, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import ChatHomeScreen from '../screens/chat/ChatHomeScreen';
import ComingSoonScreen from '../screens/ComingSoonScreen';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import ProfileHomeScreen from '../screens/profile/ProfileHomeScreen';
import SignupCalendarScreen from '../screens/signup/SignupCalendarScreen';
import SignupPersonalScreen from '../screens/signup/SignupPersonalScreen';
import SignupStartScreen from '../screens/signup/SignupStartScreen';
import SignupTasteScreen from '../screens/signup/SignupTasteScreen';
import SignupTermsScreen from '../screens/signup/SignupTermsScreen';
import TasteGameScreen from '../screens/taste/TasteGameScreen';
import { colors } from '../theme/tokens';
import { useNavigation } from './NavigationContext';
import { ROUTE_TO_TAB, TAB_ROUTES, type RouteName } from './routes';

export default function AppNavigator() {
  const { current, resetTo } = useNavigation();
  const activeTab = ROUTE_TO_TAB[current.name];

  return (
    <View style={styles.root}>
      <View style={styles.screen}>{renderScreen(current.name)}</View>

      {activeTab ? (
        <BottomNav active={activeTab} onChange={(tab) => resetTo(TAB_ROUTES[tab])} />
      ) : null}
    </View>
  );
}

function renderScreen(name: RouteName) {
  switch (name) {
    case 'Login':
      return <LoginScreen />;
    case 'SignupStart':
      return <SignupStartScreen />;
    case 'SignupPersonal':
      return <SignupPersonalScreen />;
    case 'SignupCalendar':
      return <SignupCalendarScreen />;
    case 'SignupTaste':
      return <SignupTasteScreen />;
    case 'TasteGame':
      return <TasteGameScreen />;
    case 'SignupTerms':
      return <SignupTermsScreen />;
    case 'Home':
      return <HomeScreen />;
    case 'Schedule':
      return <ComingSoonScreen title="일정 조율" />;
    case 'Chat':
      return <ChatHomeScreen />;
    case 'Profile':
      return <ProfileHomeScreen />;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.card,
  },
  screen: {
    flex: 1,
  },
});
