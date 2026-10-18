import { type BirthInput, toBirthDate } from './birthDate';
import { fetchFoodCatalog, fetchFoodProfile } from './foodProfile';
import { supabase } from './supabase';
import { getConsentAccess, hasConsentAccess } from '../consents/access';
import { consentError, consentErrorMessage, type VisibilityField, type Visibility, type ProfileVisibility } from '../consents/contracts';
import { fetchConsentStatus, getConsentServerMode, parseVisibility, requestS1 } from './consents';

export function normalizePrivacySettings(input: Record<string, unknown> | null | undefined): ProfileVisibility['settings'] {
  const saved = input ?? {};
  const resolve = (key: string, alias?: string): Visibility => {
    const values = [saved[key], ...(alias ? [saved[alias]] : [])].filter(value => value !== undefined);
    return values.length > 0 && values.every(value => value === 'public') ? 'public' : 'private';
  };
  return { birthdate: resolve('birthdate', 'birth'), gender: resolve('gender'), bio: resolve('bio'), bank_account: resolve('bank_account', 'account'), origin: resolve('origin') };
}
const FOOD_KEYS = ['korean', 'meat', 'seafood', 'western', 'chinese', 'japanese'];
const safeTastes = (input: Record<string, unknown>) => Object.fromEntries(Object.entries(input).filter(([key, value]) => FOOD_KEYS.includes(key) && typeof value === 'boolean')) as Record<string, boolean>;
async function isCurrentProfileOwner(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();
    return !error && data.session?.user.id === userId && hasConsentAccess(userId);
  } catch { return false; }
}
function parseFood(value: unknown) {
  const food = value as { schema_version: number; preferences: Record<string, boolean>; revision: string };
  if (!food || food.schema_version !== 1 || !food.preferences || typeof food.preferences !== 'object' || typeof food.revision !== 'string' || !/^(0|[1-9]\d*)$/.test(food.revision)
    || Object.keys(safeTastes(food.preferences)).length !== Object.keys(food.preferences).length) throw consentError();
  return food;
}
async function checkProfileError(error: Error | null): Promise<Error | null> {
  if ((error as { code?: string } | null)?.code === '42501') await fetchConsentStatus();
  return error ? Object.assign(new Error(consentErrorMessage(error)), { code: (error as { code?: string }).code }) : null;
}

/** public_profiles 로도 나가는, 남에게 보여도 되는 부분 */
export type MyProfile = {
  id: string;
  name: string;
  tag: string;
  avatarColor: string;
  avatarUrl: string | null;
};

/** profile_private — 본인 외에는 어떤 역할로도 읽을 수 없다 */
export type MyPrivateProfile = {
  bankName: string | null;
  accountNumber: string | null;
  birthDate: string | null;
  tastes: Record<string, boolean>;
  foodProfileCompleted?: boolean;
  foodProfileAvailable?: boolean;
  personalData: Record<string, unknown>;
  privacySettings: Record<string, string>;
  startLocationName: string | null;
  /** Tmap 검색으로 고른 장소에만 있다. 직접 입력한 주소는 좌표가 없다. */
  startLat: number | null;
  startLng: number | null;
};

export type MyProfileBundle = {
  profile: MyProfile;
  privateProfile: MyPrivateProfile;
};

type ProfileRow = {
  id: string;
  name: string;
  tag: string;
  avatar_color: string;
  avatar_url: string | null;
};

type PrivateRow = {
  tastes?: Record<string, unknown> | null;
  bank_name: string | null;
  account_number: string | null;
  birth_date: string | null;
  personal_data: Record<string, unknown> | null;
  privacy_settings: Record<string, string> | null;
  start_location_name: string | null;
  start_latitude: number | null;
  start_longitude: number | null;
};

/**
 * 두 테이블을 나란히 읽는다.
 *
 * 임베드 대신 별도 질의 두 개를 쓴다. 두 테이블 모두 RLS 가 자기 행만 통과시키므로
 * 필터 없이도 안전하지만, 의도를 드러내려고 id 를 명시한다.
 */
export async function fetchMyProfile(userId: string): Promise<{
  data: MyProfileBundle | null;
  error: Error | null;
}> {
  if (!hasConsentAccess(userId)) return { data: null, error: consentError('S1001') };
  const legacy = getConsentServerMode() === 'legacy';
  const [profileResult, privateResult, foodResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, tag, avatar_color, avatar_url')
      .eq('id', userId)
      .maybeSingle<ProfileRow>(),
    supabase
      .from('profile_private')
      .select(`bank_name, account_number, birth_date, personal_data, privacy_settings, start_location_name, start_latitude, start_longitude${legacy ? ', tastes' : ''}`)
      .eq('id', userId)
      .maybeSingle<PrivateRow>(),
    legacy ? Promise.resolve({ data: null, error: null, available: false, completed: false }) : (async () => {
      const catalog = await fetchFoodCatalog();
      if (catalog.data) {
        const food = await fetchFoodProfile();
        return { data: { preferences: {} }, error: food.error, available: true, completed: Boolean(food.data?.completed_at) && food.data?.requires_update === false };
      }
      if ((catalog.error as { code?: string } | null)?.code !== 'S5_UNAVAILABLE') return { data: null, error: catalog.error, available: false, completed: false };
      // Missing/stale v2 schema cache must not invoke the v1 reader against v2 rows.
      return { data: { preferences: {} }, error: null, available: false, completed: false };
    })(),
  ]);

  const error = await checkProfileError(profileResult.error ?? privateResult.error ?? foodResult.error);
  if (error) return { data: null, error };
  if (!hasConsentAccess(userId)) return { data: null, error: consentError('S1001') };

  const profileRow = profileResult.data;
  if (!profileRow || profileRow.id !== userId) {
    // 가입 트리거가 만들어 주므로 정상적으로는 일어나지 않는다
    return { data: null, error: new Error('프로필이 아직 준비되지 않았어요.') };
  }

  const privateRow = privateResult.data;

  return {
    data: {
      profile: {
        id: profileRow.id,
        name: profileRow.name,
        tag: profileRow.tag,
        avatarColor: profileRow.avatar_color,
        avatarUrl: profileRow.avatar_url,
      },
      privateProfile: {
        bankName: privateRow?.bank_name ?? null,
        accountNumber: privateRow?.account_number ?? null,
        birthDate: privateRow?.birth_date ?? null,
        foodProfileCompleted: foodResult.completed,
        foodProfileAvailable: foodResult.available,
        tastes: legacy ? safeTastes(privateRow?.tastes ?? {}) : foodResult.data!.preferences,
        personalData: Object.fromEntries(Object.entries(privateRow?.personal_data ?? {}).filter(([key]) => key === 'gender' || key === 'bio')),
        privacySettings: normalizePrivacySettings(privateRow?.privacy_settings),
        startLocationName: privateRow?.start_location_name ?? null,
        startLat: privateRow?.start_latitude ?? null,
        startLng: privateRow?.start_longitude ?? null,
      },
    },
    error: null,
  };
}

/** 공개되는 이름. 바뀌면 트리거가 public_profiles 로 동기화한다. */
export async function updateMyName(userId: string, name: string): Promise<Error | null> {
  if (!hasConsentAccess(userId)) return consentError('S1001');
  const trimmed = name.trim();
  if (!trimmed) return new Error('닉네임을 입력해 주세요.');

  const { error } = await supabase.from('profiles').update({ name: trimmed }).eq('id', userId);
  return checkProfileError(error);
}

export type PrivateProfilePatch = {
  bank: string | null;
  account: string;
  birth: BirthInput;
  tastes?: Record<string, boolean>;
};

/**
 * 계좌·생년월일·취향을 저장한다.
 *
 * profile_private 행은 가입 트리거가 미리 만들어 두므로 update 만 한다.
 * 세션이 있어야 RLS 를 통과하니 이메일 확인 대기 중에는 호출하지 않는다.
 */
export async function saveMyPrivateProfile(
  userId: string,
  input: PrivateProfilePatch,
): Promise<Error | null> {
  if (!hasConsentAccess(userId) || !(await isCurrentProfileOwner(userId))) return consentError('S1001');
  const patch: Record<string, unknown> = {
    bank_name: input.bank,
    account_number: input.account.trim() || null,
    birth_date: toBirthDate(input.birth),
  };

  const { error } = await supabase.from('profile_private').update(patch).eq('id', userId);
  if (error) return checkProfileError(error);
  return input.tastes ? saveTastes(userId, input.tastes) : null;
}

/** 변경된 성별만 저장한다. 다른 personal_data 키가 동시에 바뀌면 덮어쓰지 않는다. */
export async function saveMyGender(
  userId: string,
  gender: 'male' | 'female' | 'none',
  expectedGender: unknown,
): Promise<Error | null> {
  if (!hasConsentAccess(userId)) return consentError('S1001');
  const { data: row, error: readError } = await supabase
    .from('profile_private')
    .select('personal_data, updated_at')
    .eq('id', userId)
    .single<{ personal_data: Record<string, unknown> | null; updated_at: string }>();
  if (readError) return checkProfileError(readError);
  if (!row) return new Error('프로필을 다시 불러와 주세요.');

  const current = Object.fromEntries(Object.entries(row.personal_data ?? {}).filter(([key]) => key === 'gender' || key === 'bio'));
  if (current.gender !== expectedGender) {
    return new Error('다른 곳에서 성별이 변경됐어요. 다시 열고 저장해 주세요.');
  }
  if (current.gender === gender) return null;
  if (!(await isCurrentProfileOwner(userId))) return consentError('S1001');

  const { data, error } = await supabase
    .from('profile_private')
    .update({ personal_data: { ...current, gender } })
    .eq('id', userId)
    .eq('updated_at', row.updated_at)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) return checkProfileError(error);
  return data ? null : new Error('다른 곳에서 프로필이 변경됐어요. 다시 열고 저장해 주세요.');
}

/** 가입 마지막 단계에서 쓰는 이름. 인자 형태가 같아 그대로 위임한다. */
export const saveSignupPrivateProfile = saveMyPrivateProfile;

export async function fetchProfileVisibility() {
  if (getConsentServerMode() === 'legacy') return { data: null, error: consentError('S1_UNAVAILABLE') };
  if (!hasConsentAccess(getConsentAccess().userId)) return { data: null, error: consentError('S1001') };
  return requestS1('get_my_profile_visibility', {}, parseVisibility);
}
export async function setProfileVisibility(field: VisibilityField, visibility: Visibility, expectedRevision: string) {
  if (getConsentServerMode() === 'legacy') return { data: null, error: consentError('S1_UNAVAILABLE') };
  const userId = getConsentAccess().userId;
  if (!userId || !hasConsentAccess(userId) || !(await isCurrentProfileOwner(userId))) return { data: null, error: consentError('S1001') };
  return requestS1('set_profile_visibility', { p_field: field, p_visibility: visibility, p_expected_revision: expectedRevision }, parseVisibility);
}

/** Projection contract for phase 4 consumers. Never return origin, health or a raw private JSON. */
export async function fetchVisibleProfile(profileId: string, roomId: string | null = null) {
  if (!hasConsentAccess(getConsentAccess().userId)) return { data: null, error: consentError('S1001') };
  return requestS1('get_visible_profile', { p_profile_id: profileId, p_room_id: roomId }, value => {
    const result = value as { profile: { id: string; name: string; tag: string; avatar_color: string; avatar_url: string | null }; relationship: 'self' | 'room_mate' | 'identity_only'; fields: Record<string, unknown> };
    if (!result?.profile || result.profile.id !== profileId || !['self', 'room_mate', 'identity_only'].includes(result.relationship) || !result.fields || Array.isArray(result.fields)
      || ![result.profile.id, result.profile.name, result.profile.tag, result.profile.avatar_color].every(field => typeof field === 'string')
      || !(result.profile.avatar_url === null || typeof result.profile.avatar_url === 'string')
      || Object.keys(result.fields).some(key => !['birthdate', 'gender', 'bio', 'bank_account'].includes(key))
      || (result.relationship === 'identity_only' && Object.keys(result.fields).length > 0)) throw consentError();
    return result;
  });
}

/** Old bulk JSON writes are intentionally rejected; use field/revision RPCs. */
export async function savePrivacySettings(
  userId: string,
  settings: Record<string, string>,
): Promise<Error | null> {
  void userId; void settings;
  return consentError('S1008');
}

/**
 * 출발지.
 *
 * 좌표는 Tmap 검색에서 고른 장소에만 있다. 직접 입력한 문자열은 좌표를 만들 수
 * 없으므로 null 로 지운다 — 이름만 바뀌었는데 예전 좌표가 남아 있으면 중간 지점
 * 계산이 엉뚱한 곳을 가리킨다.
 */
export async function saveStartLocation(
  userId: string,
  locationName: string,
  coords?: { lat: number; lng: number } | null,
): Promise<Error | null> {
  if (!hasConsentAccess(userId)) return consentError('S1001');
  const { error } = await supabase
    .from('profile_private')
    .update({
      start_location_name: locationName.trim() || null,
      start_latitude: coords?.lat ?? null,
      start_longitude: coords?.lng ?? null,
    })
    .eq('id', userId);
  return checkProfileError(error);
}

/** 취향 게임 결과 */
export async function saveTastes(
  userId: string,
  tastes: Record<string, boolean>,
): Promise<Error | null> {
  if (!hasConsentAccess(userId)) return consentError('S1001');
  if (Object.keys(safeTastes(tastes)).length !== Object.keys(tastes).length) return consentError('22023');
  if (getConsentServerMode() === 'legacy') {
    const { error } = await supabase.from('profile_private').update({ tastes: safeTastes(tastes) }).eq('id', userId);
    return checkProfileError(error);
  }
  const current = await requestS1('get_my_food_preferences', {}, parseFood);
  if (current.error || !current.data) return current.error ?? consentError();
  // Food RPCs infer the owner from Auth; never reuse A's revision in B's session.
  if (!(await isCurrentProfileOwner(userId))) return consentError('S1001');
  return (await requestS1('save_my_food_preferences', { p_preferences: tastes, p_expected_revision: current.data.revision }, parseFood)).error;
}
