import { type BirthInput, toBirthDate } from './birthDate';
import { supabase } from './supabase';

export type SignupPrivateInput = {
  bank: string | null;
  account: string;
  birth: BirthInput;
  tastes: Record<string, boolean>;
};

/**
 * 가입 화면이 모은 계좌·생년월일·취향을 본인만 볼 수 있는 행에 저장한다.
 *
 * profile_private 행은 가입 트리거가 미리 만들어 두므로 여기서는 update 만 한다.
 * 세션이 있어야 RLS 를 통과하니, 이메일 확인이 필요한 가입에서는 호출하지 않는다.
 */
export async function saveSignupPrivateProfile(
  userId: string,
  input: SignupPrivateInput,
): Promise<Error | null> {
  const { error } = await supabase
    .from('profile_private')
    .update({
      bank_name: input.bank,
      account_number: input.account.trim() || null,
      birth_date: toBirthDate(input.birth),
      tastes: input.tastes,
    })
    .eq('id', userId);

  return error;
}
