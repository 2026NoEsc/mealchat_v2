import {
  AVATAR_BUCKET as BUCKET,
  avatarPath,
  avatarPathFromUrl,
  isSupportedAvatarType,
  MAX_AVATAR_BYTES,
} from './avatarPath';
import { supabase } from './supabase';

export { avatarPath, avatarPathFromUrl, isSupportedAvatarType, MAX_AVATAR_BYTES };

/** 공개 버킷이라 서명 없이 바로 쓸 수 있는 주소가 나온다 */
export function avatarPublicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * 사진을 올리고 프로필에 주소를 적는다.
 *
 * 올리기와 프로필 갱신이 따로라 중간에 실패할 수 있다. 그때는 올라간 파일을
 * 지워 고아 파일을 남기지 않는다 — 프로필이 가리키지 않는 사진은 아무도 못 지운다.
 */
export async function uploadAvatar(input: {
  userId: string;
  uri: string;
  mimeType: string;
}): Promise<{ url: string | null; error: Error | null }> {
  if (!isSupportedAvatarType(input.mimeType)) {
    return { url: null, error: new Error('JPG, PNG, WEBP 만 올릴 수 있어요.') };
  }

  let body: ArrayBuffer;
  try {
    const response = await fetch(input.uri);
    body = await response.arrayBuffer();
  } catch {
    return { url: null, error: new Error('사진을 읽지 못했어요.') };
  }

  if (body.byteLength > MAX_AVATAR_BYTES) {
    return { url: null, error: new Error('사진이 너무 커요. 2MB 이하로 올려 주세요.') };
  }

  const path = avatarPath(input.userId, input.mimeType);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: input.mimeType, upsert: false });

  if (uploadError) return { url: null, error: uploadError };

  const url = avatarPublicUrl(path);
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', input.userId);

  if (profileError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { url: null, error: profileError };
  }

  return { url, error: null };
}

/** 사진을 지운다. 프로필에서 주소를 먼저 떼고 파일을 지운다. */
export async function removeAvatar(userId: string, currentUrl: string | null): Promise<Error | null> {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) return error;

  const path = avatarPathFromUrl(currentUrl, userId);
  if (path) await supabase.storage.from(BUCKET).remove([path]);

  return null;
}
