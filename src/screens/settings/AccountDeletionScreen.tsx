import { Text, View } from 'react-native';
import { AuthTopBar, authStyles } from '../../components/ui/AuthLayout';
import { TextButton } from '../../components/ui/Button';

/** Gate-exempt S2 slot. No deletion API is implemented or simulated in S1. */
export default function AccountDeletionScreen({ onBack }: { onBack: () => void }) {
  return <View style={authStyles.screen}><AuthTopBar title="계정 삭제" onBack={onBack} />
    <View style={{ padding: 20, gap: 16 }}><Text style={authStyles.subtitle}>계정 삭제 기능을 준비하고 있어요. 아직 계정을 삭제하지 않았어요.</Text>
      <TextButton label="돌아가기" onPress={onBack} /></View>
    {/* TODO(S2): 필수 약관 동의 없이도 진입·실행할 수 있는 실제 계정 삭제 handler를 연결한다. */}
  </View>;
}
