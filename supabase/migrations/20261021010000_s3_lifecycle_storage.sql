-- S3 M1: additive storage only. No capability, expiry rewrite, scheduler or cutover.
begin;
alter table public.rooms
 add column lifecycle_version integer,
 add column base_expires_at timestamptz,
 add column hard_expires_at timestamptz,
 add constraint s3_lifecycle_bounds check (
  lifecycle_version is null or (
   lifecycle_version=1 and base_expires_at is not null and hard_expires_at is not null
   and isfinite(base_expires_at) and isfinite(hard_expires_at)
   and isfinite(expires_at) and expires_at<=hard_expires_at
  )
 );

alter table public.messages
 add column lifecycle_actor_id uuid references public.profiles(id) on delete set null,
 add column lifecycle_event_type text,
 add constraint s3_message_event_type check (lifecycle_event_type is null or lifecycle_event_type in (
  'member_joined','member_left','member_left_confirmed','owner_transfer_pending','owner_transfer_accepted',
  'owner_transfer_declined','owner_transfer_cancelled','owner_transfer_expired'
 ));

-- The current plaintext remains the existing rooms.code projection. This ledger
-- does not add another plaintext copy; digests prevent reuse during room lifetime.
create table private.s3_invite_codes (
 room_id uuid not null references public.rooms(id) on delete cascade,
 generation bigint not null check(generation>0),
 code_digest text not null,
 issued_at timestamptz not null check(isfinite(issued_at)),
 expires_at timestamptz not null check(isfinite(expires_at)),
 retired_at timestamptz,
 primary key(room_id,generation), unique(room_id,code_digest),
 check(expires_at<=issued_at+interval '7 days'),
 check(retired_at is null or isfinite(retired_at))
);
create unique index s3_current_invite_code on private.s3_invite_codes(room_id) where retired_at is null;

create table private.s3_requests (
 actor_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null,
 room_id uuid not null references public.rooms(id) on delete cascade,
 operation text not null, payload_hash text not null,
 applied_revision bigint not null check(applied_revision>=0),
 result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,request_id)
);
create table private.s3_create_tombstones (
 actor_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null, payload_hash text not null,
 -- No room FK: deleting a room must not permit a second create with this ID.
 room_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz,
 primary key(actor_id,request_id)
);
create table private.s3_transfer_requests (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.rooms(id) on delete cascade,
 from_owner_id uuid references public.profiles(id) on delete set null,
 target_profile_id uuid references public.profiles(id) on delete set null,
 leave_after_accept boolean not null,
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled','expired')),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 responded_at timestamptz,
 terminal_reason text check(terminal_reason in ('owner_cancelled','ttl','target_left','owner_unavailable','settlement_started','room_closed')),
 request_id uuid not null,
 check(isfinite(created_at) and isfinite(expires_at) and expires_at<=created_at+interval '24 hours'),
 check(from_owner_id is null or target_profile_id is null or from_owner_id<>target_profile_id),
 check((status='pending' and responded_at is null and terminal_reason is null) or (status<>'pending' and responded_at is not null))
);
create unique index s3_one_pending_transfer on private.s3_transfer_requests(room_id) where status='pending';
create index s3_transfer_expiry on private.s3_transfer_requests(expires_at,room_id) where status='pending';
create table private.s3_invite_previews (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references public.profiles(id) on delete cascade,
 room_id uuid not null references public.rooms(id) on delete cascade,
 generation bigint not null,
 display_revision bigint not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 check(isfinite(created_at) and isfinite(expires_at) and expires_at<=created_at+interval '2 minutes')
);
create table private.s3_invite_limits (
 -- Initial limiter INSERT precedes the room lock. Defer its FK KEY SHARE until
 -- commit, after join has acquired room -> profile, to avoid reversing S4 order.
 actor_id uuid primary key references public.profiles(id) on delete cascade deferrable initially deferred,
 failure_window timestamptz not null, failure_count integer not null default 0 check(failure_count>=0),
 minute_window timestamptz not null, minute_count integer not null default 0 check(minute_count>=0),
 day_window timestamptz not null, day_count integer not null default 0 check(day_count>=0),
 lock_until timestamptz,
 updated_at timestamptz not null
);
create table private.s3_worker_control (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 activated_at timestamptz
);
insert into private.s3_worker_control(singleton) values(true);
create table private.s3_worker_stats (
 worker text primary key check(worker in('rooms','transfers')),
 failure_count bigint not null default 0,
 last_failure_at timestamptz,
 last_failure_sqlstate text check(length(last_failure_sqlstate)=5)
);
alter table private.s3_worker_stats enable row level security;
revoke all on private.s3_worker_stats from public,anon,authenticated,service_role;
create index s3_requests_room on private.s3_requests(room_id);
create index s3_transfer_requests_room on private.s3_transfer_requests(room_id);
create index s3_invite_previews_room on private.s3_invite_previews(room_id);
create index s3_create_tombstones_room on private.s3_create_tombstones(room_id);
create index s3_messages_actor_room_time on public.messages(lifecycle_actor_id,room_id,created_at);

alter table private.s3_invite_codes enable row level security;
alter table private.s3_requests enable row level security;
alter table private.s3_create_tombstones enable row level security;
alter table private.s3_transfer_requests enable row level security;
alter table private.s3_invite_previews enable row level security;
alter table private.s3_invite_limits enable row level security;
alter table private.s3_worker_control enable row level security;
revoke all on private.s3_invite_codes,private.s3_requests,private.s3_create_tombstones,
 private.s3_transfer_requests,private.s3_invite_previews,private.s3_invite_limits,private.s3_worker_control
 from public,anon,authenticated,service_role;
-- Additive storage does not revoke legacy rooms INSERT or R1. D10/D11 are separate.
-- 테이블 단위 grant가 남은 역할(기본 service_role)에는 아래 열 단위 revoke만으로 실효가 없다.
-- 실제 보호는 release의 테이블 단위 권한 회수와 messages RLS의 sender_id 검사다.
revoke insert(lifecycle_version,base_expires_at,hard_expires_at),update(lifecycle_version,base_expires_at,hard_expires_at)
 on public.rooms from public,anon,authenticated,service_role;
revoke insert(lifecycle_actor_id,lifecycle_event_type),update(lifecycle_actor_id,lifecycle_event_type)
 on public.messages from public,anon,authenticated,service_role;
commit;
