import { useEffect, useState, useSyncExternalStore } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { authStyles } from '../../components/ui/AuthLayout';
import BottomSheet from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { getConsentAccess, subscribeConsentAccess } from '../../consents/access';
import { fetchFoodCatalog, fetchFoodProfile, markFoodPrompt, saveFoodProfile, shouldPromptFood, type FoodProfile } from '../../lib/foodProfile';
import { useNavigation } from '../../navigation/NavigationContext';
import { SIGNUP_FOOD_CATALOG_VERSION } from './signupFoodOptions';
import { clearSignupFoodDraft, peekSignupFoodDraft } from './signupFoodDraft';

/** Server revisions make the one-time invitation and seven-day snooze consistent across devices. */
export default function FoodProfilePrompt() {
  const { user } = useAuth(); const { current, navigate } = useNavigation();
  const access = useSyncExternalStore(subscribeConsentAccess, getConsentAccess, getConsentAccess);
  const [prompt, setPrompt] = useState<{ owner: string; profile: FoodProfile } | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const userId = user?.id ?? null, eligible = current.name === 'Home';
  useEffect(() => {
    let active = true; setPrompt(null);
    if (!eligible || !userId || access.userId !== userId || access.state !== 'accepted') return;
    void (async () => { const result = await fetchFoodProfile(); if (!active || !result.data) return;
      const draft = peekSignupFoodDraft(userId);
      if (draft && !result.data.completed_at) {
        // "다음" on STEP 1 is explicit input, but persistence waits for the real signup id and accepted terms.
        const catalog = await fetchFoodCatalog(); if (!active) return;
        const saved = catalog.data ? await saveFoodProfile(SIGNUP_FOOD_CATALOG_VERSION, draft, result.data.revision) : null;
        if (saved?.data) {
          clearSignupFoodDraft(userId);
          if (active) navigate('FoodProfile', { onboarding: true, resumeHealth: true });
          return;
        }
        if (active) { setError('가입 때 고른 취향을 저장하지 못했어요. 음식 프로필에서 확인해 주세요.'); setPrompt({ owner: userId, profile: result.data }); }
        return;
      }
      if (draft) clearSignupFoodDraft(userId);
      if (!shouldPromptFood(result.data)) return;
      const shown = await markFoodPrompt('shown', result.data.revision); if (active && shown.data) setPrompt({ owner: userId, profile: shown.data });
    })();
    return () => { active = false; };
  }, [eligible, userId, access, navigate]);
  const visible = Boolean(prompt && prompt.owner === userId && access.userId === userId && access.state === 'accepted');
  const later = async () => {
    if (!prompt || busy) return; setBusy(true); setError('');
    const result = await markFoodPrompt('later', prompt.profile.revision);
    if (!result.error) setPrompt(null); else setError('저장하지 못했어요. 다시 시도해 주세요.'); setBusy(false);
  };
  return <BottomSheet visible={visible} title="음식 취향을 알려 주세요" onClose={() => void later()}><Text style={authStyles.subtitle}>좋아하는 음식을 고르면 밥약 식당 추천에 기본으로 써요. 선택 입력이며 프로필에서 언제든 바꿀 수 있어요.</Text>{error ? <Text accessibilityRole="alert" style={authStyles.helper}>{error}</Text> : null}<Button label="음식 프로필 고르기" disabled={busy} onPress={() => { setPrompt(null); navigate('FoodProfile', { onboarding: true }); }} /><Button label="나중에" variant="secondary" loading={busy} onPress={() => void later()} /></BottomSheet>;
}
