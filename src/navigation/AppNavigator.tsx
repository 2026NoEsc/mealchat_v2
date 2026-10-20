import { StyleSheet, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import ChatHomeScreen from '../screens/chat/ChatHomeScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import RoomDetailScreen from '../screens/chat/RoomDetailScreen';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import FriendsScreen from '../screens/profile/FriendsScreen';
import OriginScreen from '../screens/profile/OriginScreen';
import PrivacyScreen from '../screens/profile/PrivacyScreen';
import ProfileEditScreen from '../screens/profile/ProfileEditScreen';
import PasswordChangeScreen from '../screens/profile/PasswordChangeScreen';
import ProfileHomeScreen from '../screens/profile/ProfileHomeScreen';
import ScheduleConfirmedScreen from '../screens/schedule/ScheduleConfirmedScreen';
import SettlementsScreen from '../screens/settlement/SettlementsScreen';
import SettlementDetailScreen from '../screens/settlement/SettlementDetailScreen';
import ScheduleDetailScreen from '../screens/schedule/ScheduleDetailScreen';
import ScheduleHomeScreen from '../screens/schedule/ScheduleHomeScreen';
import ScheduleTimeScreen from '../screens/schedule/ScheduleTimeScreen';
import SignupCalendarScreen from '../screens/signup/SignupCalendarScreen';
import SignupPersonalScreen from '../screens/signup/SignupPersonalScreen';
import SignupStartScreen from '../screens/signup/SignupStartScreen';
import SignupTasteScreen from '../screens/signup/SignupTasteScreen';
import SignupTermsScreen from '../screens/signup/SignupTermsScreen';
import FoodProfileScreen from '../screens/food/FoodProfileScreen';
import FoodProfilePrompt from '../screens/food/FoodProfilePrompt';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ServiceTermsScreen from '../screens/settings/ServiceTermsScreen';
import PrivacyPolicyScreen from '../screens/settings/PrivacyPolicyScreen';
import AppInfoScreen from '../screens/settings/AppInfoScreen';
import OptionalConsentsScreen from '../screens/settings/OptionalConsentsScreen';
import PrivacyRevisionScreen from '../screens/settings/PrivacyRevisionScreen';
import AccountDeletionScreen from '../screens/settings/AccountDeletionScreen';
import { colors } from '../theme/tokens';
import { useNavigation } from './NavigationContext';
import { ROUTE_TO_TAB, TAB_ROUTES, type RouteName } from './routes';

export default function AppNavigator() {
  const { current, resetTo } = useNavigation();
  const activeTab = ROUTE_TO_TAB[current.name];

  return (
    <View style={styles.root}>
      <View style={styles.screen}>{renderScreen(current.name)}</View>

      <FoodProfilePrompt />
      {activeTab ? (
        <BottomNav active={activeTab} onChange={(tab) => resetTo(TAB_ROUTES[tab])} />
      ) : null}
    </View>
  );
}

function renderScreen(name: RouteName) {
  switch (name) {
    case 'Settings':
      return <SettingsScreen />;
    case 'OptionalConsents':
      return <OptionalConsentsScreen />;
    case 'AccountDeletion':
      return <AccountDeletionRoute />;
    case 'ServiceTerms':
      return <ServiceTermsScreen />;
    case 'PrivacyPolicy':
      return <PrivacyPolicyScreen />;
    case 'PrivacyRevision':
      return <PrivacyRevisionScreen />;
    case 'AppInfo':
      return <AppInfoScreen />;
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
    case 'FoodProfile':
      return <FoodProfileScreen />;
    case 'SignupTerms':
      return <SignupTermsScreen />;
    case 'Home':
      return <HomeScreen />;
    case 'Schedule':
      return <ScheduleHomeScreen />;
    case 'ScheduleDetail':
      return <ScheduleDetailScreen />;
    case 'ScheduleTime':
      return <ScheduleTimeScreen />;
    case 'ScheduleConfirmed':
      return <ScheduleConfirmedScreen />;
    case 'Settlements':
      return <SettlementsScreen />;
    case 'SettlementDetail':
      return <SettlementDetailScreen />;
    case 'Chat':
      return <ChatHomeScreen />;
    case 'ChatRoom':
      return <ChatRoomScreen />;
    case 'RoomDetail':
      return <RoomDetailScreen />;
    case 'Profile':
      return <ProfileHomeScreen />;
    case 'Friends':
      return <FriendsScreen />;
    case 'Privacy':
      return <PrivacyScreen />;
    case 'Origin':
      return <OriginScreen />;
    case 'ProfileEdit':
      return <ProfileEditScreen />;
    case 'PasswordChange':
      return <PasswordChangeScreen />;
  }
}

function AccountDeletionRoute() {
  const { goBack } = useNavigation();
  return <AccountDeletionScreen onBack={goBack} />;
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
