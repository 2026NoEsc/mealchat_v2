import { supabase } from './supabase';

export type ConsentStatus = {
  version: string | null;
  agreed: boolean;
};

/**
 * 현재 약관 버전과 그 버전에 동의했는지를 서버가 판정해 준다.
 * terms_versions 와 profile_consents 를 클라이언트가 각각 읽어 맞춰 보면
 * 판정 기준이 화면마다 갈리므로 RPC 하나로 묻는다.
 */
export async function fetchConsentStatus(): Promise<{
  data: ConsentStatus | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .rpc('current_terms_consent_status')
    .maybeSingle<{ version: string; agreed: boolean }>();

  if (error) return { data: null, error };
  if (!data) return { data: { version: null, agreed: true }, error: null };

  return { data: { version: data.version, agreed: data.agreed }, error: null };
}

/**
 * 재동의를 기록한다. 버전과 시각은 서버가 정하고,
 * 사용자가 실제로 고르는 마케팅 수신 여부만 보낸다.
 */
export async function recordTermsConsent(marketingOptIn: boolean): Promise<Error | null> {
  const { error } = await supabase.rpc('record_terms_consent', {
    marketing_opt_in: marketingOptIn,
  });
  return error;
}
