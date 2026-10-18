import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { authStyles } from '../../components/ui/AuthLayout';
import BottomSheet from '../../components/ui/BottomSheet';
import { Button, TextButton } from '../../components/ui/Button';
import FailureCard from '../../components/ui/FailureCard';
import { getConsentAccess, registerSensitiveConsentClearer, subscribeConsentAccess } from '../../consents/access';
import { newConsentRequestId, type ConsentManifest, type ConsentStatus, type OptionalSubmission } from '../../consents/contracts';
import { fetchConsentManifest, fetchConsentStatus, setOptionalConsent } from '../../lib/consents';
import { fetchFoodCatalog, fetchFoodProfile, fetchHealthProfile, foodProfileErrorMessage, saveFoodProfile, saveHealthProfile, type FoodCatalog, type FoodPreferences, type FoodProfile, type HealthProfile } from '../../lib/foodProfile';
import { useNavigation } from '../../navigation/NavigationContext';
import LegalDocumentBody from '../settings/LegalDocumentBody';
import { manifestDocument } from '../../legal/manifest';
import FoodProfileForm, { emptyFood, emptyHealth, unansweredHealth, type HealthInput } from './FoodProfileForm';
import { setSignupFoodDraft, takeSignupFoodDraft } from './signupFoodDraft';
import { SIGNUP_FOOD_CATALOG_VERSION, signupFoodOptions } from './signupFoodOptions';
const legacyHealthNotice = '이전 건강정보는 자동으로 옮기지 않아요. 선택 동의를 철회한 뒤 다시 동의하고 입력해 주세요.';

const signupCatalog: FoodCatalog = {
  contract_version: 2, catalog_version: SIGNUP_FOOD_CATALOG_VERSION,
  food_groups: ['cuisine', 'preferred_ingredient', 'food_form', 'spice'].map(group_code => ({ group_code, selection: group_code === 'spice' ? 'single' : 'multiple', min: group_code === 'cuisine' ? 1 : 0, max: 12, sentinel: group_code === 'cuisine' ? 'any' : null, options: signupFoodOptions.filter(o => o.group === group_code).map(o => ({ ...o, enabled: true })) })), health_groups: [],
  capabilities: { food_v2: true, health_storage_v2: true, health_filter: false, automatic_midpoint: false, recommendation_purposes: ['places'] },
};
/** Phone 495:1026 / 495:1163 / 495:1248 / 495:1325; authenticated editor shares the signup layout. */
export default function FoodProfileScreen({ signup = false }: { signup?: boolean }) {
  const { user } = useAuth(); const userId = user?.id ?? null;
  const { current, navigate, goBack } = useNavigation();
  const editing = !signup && current.params?.onboarding !== true;
  const access = useSyncExternalStore(subscribeConsentAccess, getConsentAccess, getConsentAccess);
  const [catalog, setCatalog] = useState<FoodCatalog | null>(signup ? signupCatalog : null);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [profile, setProfile] = useState<FoodProfile | null>(null);
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [food, setFood] = useState<FoodPreferences>(emptyFood); const [health, setHealth] = useState<HealthInput>(emptyHealth);
  const [step, setStep] = useState<1 | 2>(1); const [expanded, setExpanded] = useState('allergy');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(!signup), [error, setError] = useState('');
  const [healthConsent, setHealthConsent] = useState<{ manifest: ConsentManifest; status: ConsentStatus } | null>(null);
  const [legal, setLegal] = useState(false);
  const epoch = useRef(0), healthEpoch = useRef(0);
  const owner = useRef(userId); owner.current = userId;
  const active = useRef(true), locked = useRef(false), consentRequest = useRef<OptionalSubmission | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const isCurrent = useCallback((expected = epoch.current) => active.current && expected === epoch.current && owner.current === userId && (signup || (getConsentAccess().userId === userId && getConsentAccess().state === 'accepted')), [signup, userId]);
  const reload = useCallback(async () => {
    if (signup) return;
    const token = ++epoch.current; locked.current = false; setBusy(false);
    setLoading(true); setCatalog(null); setProfile(null); setHealthProfile(null); setHealth(emptyHealth()); setFood(emptyFood()); setHealthConsent(null); setStep(1); setError('');
    const [c, f] = await Promise.all([fetchFoodCatalog(), fetchFoodProfile()]);
    if (!isCurrent(token)) return;
    if (!c.data || !f.data) setError(foodProfileErrorMessage(c.error ?? f.error));
    else { setLoadedOwner(userId); setCatalog(c.data); setProfile(f.data); const draft = takeSignupFoodDraft(userId!); if (f.data.requires_update || f.data.catalog_version !== c.data.catalog_version) { setFood(emptyFood()); setError('선택 항목이 바뀌었어요. 음식 취향을 다시 골라 저장해 주세요. 이전 값은 자동으로 옮기지 않아요.'); }
      else { const compatibleDraft = c.data.catalog_version === SIGNUP_FOOD_CATALOG_VERSION ? draft : null; setFood('cuisines' in f.data.preferences ? f.data.preferences as FoodPreferences : compatibleDraft ?? emptyFood()); if (draft && !compatibleDraft) setError('가입 후 선택 항목이 바뀌었어요. 이전 선택은 옮기지 않고 다시 골라 주세요.'); } }
    setLoading(false);
  }, [signup, isCurrent, userId]);
  useEffect(() => { void reload(); }, [reload, access]);
  useEffect(() => registerSensitiveConsentClearer(() => { healthEpoch.current++; setHealth(emptyHealth()); setHealthProfile(null); setHealthConsent(null); setStep(1); }), []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { epoch.current++; locked.current = false; setBusy(false); setHealth(emptyHealth()); setHealthProfile(null); setHealthConsent(null); setStep(1); }
      else if (!signup) void reload();
    });
    return () => subscription.remove();
  }, [signup, reload]);
  useEffect(() => {
    if (!healthProfile) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const left = Date.parse(healthProfile.valid_until) - Date.now();
      if (left <= 0) { setHealth(emptyHealth()); setHealthProfile(null); setStep(1); setError('건강정보 동의가 만료됐어요. 다시 확인해 주세요.'); }
      else timer = setTimeout(check, Math.min(left, 2147483647));
    };
    check(); return () => clearTimeout(timer);
  }, [healthProfile]);
  const finish = () => { setHealth(emptyHealth()); setHealthProfile(null); setHealthConsent(null); goBack(); };
  const run = useCallback(async (task: (token: number) => Promise<void>) => {
    if (locked.current) return; const token = epoch.current; locked.current = true; setBusy(true); setError('');
    try { await task(token); } catch (e) { if (isCurrent(token)) setError(foodProfileErrorMessage(e)); }
    finally { if (epoch.current === token) locked.current = false; if (isCurrent(token)) setBusy(false); }
  }, [isCurrent]);
  const openHealth = useCallback(async (token: number) => {
    const healthToken = healthEpoch.current;
    const result = await fetchHealthProfile(); if (!isCurrent(token) || healthToken !== healthEpoch.current) return;
    if (!result.data) { setHealth(emptyHealth()); setHealthProfile(null); setError((result.error as {code?:string}|null)?.code === 'S1008' ? legacyHealthNotice : foodProfileErrorMessage(result.error)); return; }
    if (Date.parse(result.data.valid_until) <= Date.now()) { setError('건강정보 동의가 만료됐어요. 다시 확인해 주세요.'); return; }
    if (result.data.requires_update || result.data.catalog_version !== catalog?.catalog_version) { setHealthProfile(result.data); setHealth(emptyHealth()); setError('건강정보 선택 항목이 바뀌었어요. 다시 선택하고 저장하면 이전 값을 대체해요.'); setStep(2); return; }
    // GET marks schema 2 + completed_at as complete. Required STEP2 answers are
    // checked before saving, so normalized empty required fields mean explicit none.
    const complete = result.data.status === 'complete' && Boolean(result.data.completed_at);
    setHealthProfile(result.data); setHealth({
      allergy_codes: complete && !result.data.allergy_codes.length ? ['none'] : result.data.allergy_codes,
      avoided_food_codes: complete && !result.data.avoided_food_codes.length ? ['none'] : result.data.avoided_food_codes,
      diet_type_code: complete ? result.data.diet_type_code ?? 'none' : result.data.diet_type_code,
      additional_avoid_codes: complete && !result.data.additional_avoid_codes.length ? ['none'] : result.data.additional_avoid_codes,
    }); setStep(2);
  }, [isCurrent, catalog?.catalog_version]);
  const prepareHealth = useCallback(async (token: number) => {
    const [m, s] = await Promise.all([fetchConsentManifest(), fetchConsentStatus()]); if (!isCurrent(token)) return;
    if (!m.data || !s.data) { setError('건강정보 동의를 확인하지 못했어요. STEP 1은 저장됐어요.'); return; }
    if (s.data.health.status === 'granted' && Date.parse(s.data.health.valid_until!) > Date.parse(s.data.server_time)) await openHealth(token);
    else { consentRequest.current = null; setHealthConsent({ manifest: m.data, status: s.data }); }
  }, [isCurrent, openHealth]);
  const resumed = useRef<string | null>(null);
  useEffect(() => {
    if (signup || loading || !profile || !catalog || !userId || current.params?.resumeHealth !== true || resumed.current === userId) return;
    resumed.current = userId; void run(prepareHealth);
  }, [signup, loading, profile, catalog, userId, current.params?.resumeHealth, run, prepareHealth]);
  const next = () => void run(async token => {
    if (step === 1) {
      if (!food.cuisines.length) { setError('음식 종류를 고르거나 건너뛰어 주세요.'); return; }
      if (signup) { setSignupFoodDraft(food); navigate('SignupTerms'); return; }
      if (!catalog || !profile) return;
      const saved = await saveFoodProfile(catalog.catalog_version, food, profile.revision); if (!isCurrent(token)) return;
      if (!saved.data) { setError(foodProfileErrorMessage(saved.error)); return; } setProfile(saved.data);
      if (editing) finish(); else await prepareHealth(token);
    } else if (catalog && healthProfile) {
      if (unansweredHealth(health).length) { setError('아직 고르지 않은 항목이 있어요. 없음도 직접 골라 주세요.'); return; }
      const saved = await saveHealthProfile(catalog.catalog_version, health, healthProfile.revision, healthProfile.consent_revision); if (!isCurrent(token)) return;
      if (saved.error) { setHealth(emptyHealth()); setHealthProfile(null); setStep(1); setError((saved.error as {code?:string}|null)?.code === 'S1008' ? legacyHealthNotice : foodProfileErrorMessage(saved.error)); return; } finish();
    }
  });
  const consent = (grant: boolean) => void run(async token => {
    if (!healthConsent) return;
    const document = healthConsent.manifest.documents.health;
    if (!consentRequest.current || consentRequest.current.p_action !== (grant ? 'grant' : 'decline')) consentRequest.current = { p_request_id: newConsentRequestId(), p_kind: 'health', p_action: grant ? 'grant' : 'decline', p_document_version: document.version, p_content_hash: document.content_hash, p_expected_revision: healthConsent.status.health.revision, p_source: 'food_step2' };
    const result = await setOptionalConsent(consentRequest.current); if (!isCurrent(token)) return;
    if (result.error || !result.data) { setHealthConsent(null); setError(foodProfileErrorMessage(result.error)); return; }
    setHealthConsent(null); if (grant && result.data.status === 'granted') await openHealth(token); else finish();
  });
  if (!signup && (access.userId !== userId || access.state !== 'accepted')) return <View style={authStyles.screen} />;
  if (!signup && loadedOwner !== userId && catalog && !loading) return <View style={authStyles.screen} />;
  if (!catalog || loading) return <View style={[authStyles.screen, { padding: 20, justifyContent: 'center' }]}>{loading ? <Text style={authStyles.subtitle}>음식 프로필을 불러오고 있어요</Text> : <><FailureCard title="음식 프로필을 불러오지 못했어요" reason={error} onRetry={() => void reload()} /><TextButton label="뒤로" onPress={goBack} /></>}</View>;
  return <>
    <FoodProfileForm step={step} editing={editing} signupProgress={signup} catalog={catalog} food={food} health={health} onFood={setFood} onHealth={setHealth} expanded={expanded} onExpand={setExpanded} onBack={() => step === 2 ? setStep(1) : goBack()} onNext={next} onHealthStep={() => void run(prepareHealth)} onSkip={() => { if (signup) { setSignupFoodDraft(null); navigate('SignupTerms'); } else finish(); }} busy={busy} error={error}>
      {signup ? <Text style={authStyles.helper}>선택 입력이에요. 건강정보는 가입 후 동의를 확인하고 입력할 수 있어요. 가입이 끝나기 전에 앱을 닫으면 선택이 사라질 수 있어요.</Text> : error ? <><TextButton label="최신 상태 다시 불러오기" onPress={() => void reload()} />{error.includes('이전 건강정보') ? <TextButton label="건강정보 선택 동의 관리" onPress={() => navigate('OptionalConsents')} /> : null}</> : null}
    </FoodProfileForm>
    <BottomSheet visible={Boolean(healthConsent)} title="건강정보 수집·이용 동의 (선택)" onClose={() => { if (!busy) finish(); }}>
      <Text style={authStyles.subtitle}>알레르기·기피 음식·식단 정보를 본인 프로필에 저장해요. 공동 추천에는 사용하지 않아요. 동의일부터 1년 보관하며 거절·철회하면 바로 파기해요. 동의하지 않아도 기본 서비스를 이용할 수 있어요.</Text>
      <TextButton label={legal ? '원문 접기' : '건강정보 동의 원문 보기'} onPress={() => setLegal(v => !v)} />
      {legal ? healthConsent ? <LegalDocumentBody document={manifestDocument(healthConsent.manifest, 'health')} /> : null : null}
      <Button label="동의하고 입력하기" loading={busy} disabled={busy} onPress={() => consent(true)} /><Button label="동의하지 않고 계속" variant="secondary" disabled={busy} onPress={() => consent(false)} />
    </BottomSheet>
  </>;
}
