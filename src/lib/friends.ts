import { supabase } from './supabase';

export type Friend = {
  id: string;
  profileId: string;
  name: string;
  tag: string;
  avatarColor: string;
  /** baseline 의 role. 지금 만들 수 있는 것은 mate 뿐이다. */
  role: string;
};

type FollowRow = {
  id: string;
  follower_id: string;
  following_id: string;
  role: string;
};

type PublicProfileRow = {
  id: string;
  name: string;
  tag: string;
  avatar_color: string;
};

/**
 * 내가 추가한 친구 목록.
 *
 * follows 는 public_profiles 로 향하는 외래키가 없어서 (profiles 를 가리킨다)
 * 임베드 대신 두 번 읽어 맞춘다. profiles 는 자기 행만 보이므로 이름은
 * 공개용 테이블에서 가져와야 한다.
 */
export async function fetchMyFriends(userId: string): Promise<{
  data: Friend[] | null;
  error: Error | null;
}> {
  const { data: follows, error } = await supabase
    .from('follows')
    .select('id, follower_id, following_id, role')
    .eq('follower_id', userId)
    .returns<FollowRow[]>();

  if (error) return { data: null, error };
  if (!follows?.length) return { data: [], error: null };

  const ids = follows.map((follow) => follow.following_id);
  const { data: profiles, error: profileError } = await supabase
    .from('public_profiles')
    .select('id, name, tag, avatar_color')
    .in('id', ids)
    .returns<PublicProfileRow[]>();

  if (profileError) return { data: null, error: profileError };

  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return {
    data: follows.map((follow) => {
      const profile = byId.get(follow.following_id);
      return {
        id: follow.id,
        profileId: follow.following_id,
        name: profile?.name ?? '알 수 없는 사용자',
        tag: profile?.tag ?? '',
        avatarColor: profile?.avatar_color ?? '#23A455',
        role: follow.role,
      };
    }),
    error: null,
  };
}

/** 태그로 사람을 찾는다. public_profiles 만 보이므로 공개 정보만 나온다. */
export async function searchProfilesByTag(
  keyword: string,
  excludeId: string,
): Promise<{ data: PublicProfileRow[] | null; error: Error | null }> {
  const trimmed = keyword.trim();
  if (!trimmed) return { data: [], error: null };

  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, name, tag, avatar_color')
    .or(`tag.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
    .neq('id', excludeId)
    .limit(20)
    .returns<PublicProfileRow[]>();

  return { data: data ?? null, error };
}

/** 정책이 follower_id 를 본인으로, role 을 mate 로 강제한다. */
export async function addFriend(userId: string, targetId: string): Promise<Error | null> {
  if (userId === targetId) return new Error('자기 자신은 추가할 수 없어요.');

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: userId, following_id: targetId, role: 'mate' });
  return error;
}

export async function removeFriend(followId: string): Promise<Error | null> {
  const { error } = await supabase.from('follows').delete().eq('id', followId);
  return error;
}
