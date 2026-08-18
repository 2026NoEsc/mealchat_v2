-- 프로필 사진 업로드용 Storage 버킷.
--
-- 버킷이 하나도 없어서 아바타는 지금까지 avatar_color 원에 이름 첫 글자였다.
--
-- 공개 버킷으로 둔다. 아바타는 public_profiles 를 통해 이미 다른 사용자에게
-- 보이는 정보이고, 비공개로 두면 목록을 그릴 때마다 사람 수만큼 signed URL 을
-- 발급해야 해서 값에 비해 비용이 크다. 대신 무엇을 올릴 수 있는지 좁게 막는다.
--
-- 경로 규칙: {auth.uid()}/{파일명}
-- 첫 칸이 자기 uid 인 경우만 쓸 수 있으므로 남의 아바타를 덮어쓸 수 없다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  -- 2MB. 프로필 사진에 그 이상은 필요 없고, 큰 파일이 올라오면 목록이 느려진다.
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

/*
 * 읽기는 누구나. 공개 버킷이라 URL 을 아는 사람은 어차피 받을 수 있고,
 * 정책으로 막으면 앱 안에서만 못 보게 되는 셈이라 의미가 없다.
 */
drop policy if exists avatars_read on storage.objects;
create policy avatars_read
on storage.objects
for select
to public
using (bucket_id = 'avatars');

/*
 * 쓰기는 자기 폴더만. storage.foldername(name) 의 첫 칸이 uid 여야 한다.
 * 이게 없으면 로그인한 아무나 남의 아바타를 갈아 끼울 수 있다.
 */
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

/*
 * profiles.avatar_url 은 이미 UPDATE 가 열려 있고, 바뀌면 트리거가
 * public_profiles 로 동기화한다. 여기서 더 열 것은 없다.
 */
