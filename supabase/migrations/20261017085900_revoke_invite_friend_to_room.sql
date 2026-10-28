-- Standalone hotfix: no S1 tables/functions are required. Remote application needs separate approval.
begin;
revoke execute on function public.invite_friend_to_room(uuid,uuid) from public,anon,authenticated;
commit;
