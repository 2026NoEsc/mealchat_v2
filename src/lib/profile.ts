import { type BirthInput, toBirthDate } from './birthDate';
import { supabase } from './supabase';

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
  personalData: Record<string, unknown>;
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
  bank_name: string | null;
  account_number: string | null;
  birth_date: string | null;
  tastes: Record<string, boolean> | null;
  personal_data: Record<string, unknown> | null;
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
  const [profileResult, privateResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, tag, avatar_color, avatar_url')
      .eq('id', userId)
      .maybeSingle<ProfileRow>(),
    supabase
      .from('profile_private')
      .select('bank_name, account_number, birth_date, tastes, personal_data')
      .eq('id', userId)
      .maybeSingle<PrivateRow>(),
  ]);

  const error = profileResult.error ?? privateResult.error;
  if (error) return { data: null, error };

  const profileRow = profileResult.data;
  if (!profileRow) {
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
        tastes: privateRow?.tastes ?? {},
        personalData: privateRow?.personal_data ?? {},
      },
    },
    error: null,
  };
}

/** 공개되는 이름. 바뀌면 트리거가 public_profiles 로 동기화한다. */
export async function updateMyName(userId: string, name: string): Promise<Error | null> {
  const trimmed = name.trim();
  if (!trimmed) return new Error('닉네임을 입력해 주세요.');

  const { error } = await supabase.from('profiles').update({ name: trimmed }).eq('id', userId);
  return error;
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
  const patch: Record<string, unknown> = {
    bank_name: input.bank,
    account_number: input.account.trim() || null,
    birth_date: toBirthDate(input.birth),
  };

  if (input.tastes) patch.tastes = input.tastes;

  const { error } = await supabase.from('profile_private').update(patch).eq('id', userId);
  return error;
}

/** 가입 마지막 단계에서 쓰는 이름. 인자 형태가 같아 그대로 위임한다. */
export const saveSignupPrivateProfile = saveMyPrivateProfile;
