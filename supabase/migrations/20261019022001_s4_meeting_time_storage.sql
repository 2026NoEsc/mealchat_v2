-- S4 M1: additive preparation only. No legacy data/time inference or capability activation.
begin;
alter table public.rooms
 add column meeting_starts_at timestamptz,
 add column meeting_ends_at timestamptz,
 add column meeting_time_zone text,
 add column s4_revision bigint not null default 0 check(s4_revision>=0),
 add column appointment_confirmed_at timestamptz,
 add column appointment_confirmed_by uuid references public.profiles(id) on delete set null,
 add constraint s4_meeting_interval check(
  (meeting_starts_at is null and meeting_ends_at is null and meeting_time_zone is null) or
  (meeting_starts_at is not null and meeting_ends_at is not null and meeting_time_zone is not null and meeting_time_zone='Asia/Seoul'
   and isfinite(meeting_starts_at) and isfinite(meeting_ends_at) and meeting_starts_at<meeting_ends_at));
create table private.s4_requests(
 actor_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null,
 room_id uuid not null references public.rooms(id) on delete cascade,
 operation text not null check(operation in('submit','select','confirm')),
 payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
 applied_revision bigint not null check(applied_revision>=0),
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,request_id)
);
alter table private.s4_requests enable row level security;
create index s4_requests_room_idx on private.s4_requests(room_id);
revoke all on private.s4_requests from public,anon,authenticated,service_role;
commit;
