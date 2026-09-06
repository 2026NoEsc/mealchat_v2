begin;

create extension if not exists pgtap with schema extensions;

select plan(62);

create temporary table test_ids (
  key text primary key,
  id uuid not null
);
grant select, insert, update, delete on table pg_temp.test_ids to authenticated;

create or replace function pg_temp.sqlstate_of(command text)
returns text
language plpgsql
as $$
begin
  execute command;
  return '00000';
exception
  when others then
    return sqlstate;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated',
   'runtime-a@example.invalid', '{}'::jsonb, '{"name":"Runtime A"}'::jsonb, now(), now()),
  ('bbbbbbbb-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated',
   'runtime-b@example.invalid', '{}'::jsonb, '{"name":"Runtime B"}'::jsonb, now(), now()),
  ('cccccccc-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated',
   'runtime-c@example.invalid', '{}'::jsonb, '{"name":"Runtime C"}'::jsonb, now(), now());

insert into public.follows (follower_id, following_id, role)
values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-0000000000b2', 'mate'),
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-0000000000c3', 'mate');

select ok(
  not exists (
    select 1
    from pg_proc function
    join pg_namespace namespace on namespace.oid = function.pronamespace
    where (namespace.nspname, function.proname) in (
      ('public', 'create_room_invitation'),
      ('public', 'accept_room_invitation'),
      ('public', 'decline_room_invitation'),
      ('public', 'join_room_by_code'),
      ('public', 'leave_room'),
      ('public', 'create_room_settlement_v2'),
      ('public', 'set_settlement_completed'),
      ('public', 'add_voting_item'),
      ('public', 'toggle_vote'),
      ('public', 'confirm_room_vote'),
      ('private', 'create_room_settlement_impl')
    )
    and (
      not function.prosecdef
      or not coalesce('search_path=""' = any(function.proconfig), false)
    )
  ),
  'privileged RPCs are SECURITY DEFINER with an empty search_path'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'public.create_room_invitation(uuid,uuid)'::regprocedure,
      'public.accept_room_invitation(uuid)'::regprocedure,
      'public.decline_room_invitation(uuid)'::regprocedure,
      'public.join_room_by_code(text)'::regprocedure,
      'public.leave_room(uuid)'::regprocedure,
      'public.create_room_settlement_v2(uuid,text,integer,text,text,text)'::regprocedure,
      'public.set_settlement_completed(uuid,boolean)'::regprocedure,
      'public.add_voting_item(uuid,text,text)'::regprocedure,
      'public.toggle_vote(uuid,uuid)'::regprocedure,
      'public.confirm_room_vote(uuid,uuid)'::regprocedure
    ]) function_oid
    where not has_function_privilege('authenticated', function_oid, 'EXECUTE')
  ),
  'authenticated can execute only the intended current RPC surface'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'public.create_room_invitation(uuid,uuid)'::regprocedure,
      'public.accept_room_invitation(uuid)'::regprocedure,
      'public.decline_room_invitation(uuid)'::regprocedure,
      'public.create_room_settlement_v2(uuid,text,integer,text,text,text)'::regprocedure,
      'public.set_settlement_completed(uuid,boolean)'::regprocedure,
      'public.confirm_room_vote(uuid,uuid)'::regprocedure
    ]) function_oid
    where has_function_privilege('anon', function_oid, 'EXECUTE')
  ),
  'anon cannot execute authenticated state-changing RPCs'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'public.invite_friend_to_room(uuid,uuid)'::regprocedure,
      'public.create_room_settlement(uuid,text,integer,text,text,text)'::regprocedure,
      'public.post_room_system_message(uuid,text)'::regprocedure
    ]) function_oid
    where has_function_privilege('authenticated', function_oid, 'EXECUTE')
  ),
  'cutover removes stale forced-invite, settlement-v1, and generic-system RPCs'
);

select ok(
  not has_column_privilege(
    'authenticated', 'public.notifications', 'settlement_id', 'INSERT'
  ),
  'clients cannot forge linked settlement notifications'
);

select ok(
  not has_table_privilege('authenticated', 'public.dutch_pay_bills', 'INSERT')
  and not has_table_privilege('authenticated', 'public.dutch_pay_bills', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.dutch_pay_bills', 'DELETE'),
  'direct settlement bill writes are closed'
);

select ok(
  not has_table_privilege('authenticated', 'public.rooms', 'UPDATE'),
  'direct room updates are closed'
);

select ok(
  not has_table_privilege('authenticated', 'public.participants', 'DELETE'),
  'direct participant deletion is closed'
);

select ok(
  not has_table_privilege('authenticated', 'public.rooms', 'DELETE'),
  'direct room deletion is closed'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'room_id', 'title', 'message', 'bank_name', 'account_number', 'amount'
    ]) column_name
    where has_column_privilege(
      'authenticated', 'public.notifications', column_name, 'INSERT'
    )
  ),
  'cutover removes the legacy notification column grant'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'code', 'title', 'meeting_date', 'expires_at', 'owner_id',
      'is_confirmed', 'confirmed_slot', 'color', 'location_name'
    ]) column_name
    where not has_column_privilege(
      'authenticated', 'public.rooms', column_name, 'INSERT'
    )
  ),
  'room creation retains only the current client columns'
);

select is(
  (select count(*) from public.profiles where id in (
    'aaaaaaaa-0000-0000-0000-0000000000a1',
    'bbbbbbbb-0000-0000-0000-0000000000b2',
    'cccccccc-0000-0000-0000-0000000000c3'
  )),
  3::bigint,
  'local auth users receive profile rows through the production trigger'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  auth.uid(),
  'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid,
  'JWT subject identifies user A'
);

select is(
  pg_temp.sqlstate_of($command$
    insert into public.rooms (
      code, title, meeting_date, expires_at, owner_id,
      is_confirmed, confirmed_slot, color, location_name
    )
    values (
      'RUNTIME01', 'Runtime room', current_date + 1, now() + interval '7 days',
      'aaaaaaaa-0000-0000-0000-0000000000a1',
      false, null, '#23A455', 'Test location'
    )
  $command$),
  '00000',
  'user A can create a room through the narrowed insert contract'
);

insert into pg_temp.test_ids (key, id)
select 'room', id from public.rooms where code = 'RUNTIME01';

select is(
  (select count(*) from public.participants
   where room_id = (select id from pg_temp.test_ids where key = 'room')
     and profile_id = auth.uid()),
  1::bigint,
  'room creation snapshots the owner exactly once'
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.messages (room_id, message) values (%L::uuid, %L)',
    (select id from pg_temp.test_ids where key = 'room'),
    'seed message'
  )),
  '00000',
  'room member can create a normal message through the client contract'
);

insert into pg_temp.test_ids (key, id)
select 'invite_b', public.create_room_invitation(
  (select id from pg_temp.test_ids where key = 'room'),
  'bbbbbbbb-0000-0000-0000-0000000000b2'
);

select is(
  public.create_room_invitation(
    (select id from pg_temp.test_ids where key = 'room'),
    'bbbbbbbb-0000-0000-0000-0000000000b2'
  ),
  (select id from pg_temp.test_ids where key = 'invite_b'),
  'retrying a pending invitation returns the same invitation'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.room_invitations
   where id = (select id from pg_temp.test_ids where key = 'invite_b')),
  1::bigint,
  'user B sees their pending invitation'
);

select is(
  (select count(*) from public.rooms
   where id = (select id from pg_temp.test_ids where key = 'room')),
  0::bigint,
  'user B cannot see the room before accepting'
);

select is(
  (select count(*) from public.participants
   where room_id = (select id from pg_temp.test_ids where key = 'room')),
  0::bigint,
  'user B cannot see participant data before accepting'
);

select is(
  (select count(*) from public.messages
   where room_id = (select id from pg_temp.test_ids where key = 'room')),
  0::bigint,
  'user B cannot see messages before accepting'
);

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.room_invitations
   where id = (select id from pg_temp.test_ids where key = 'invite_b')),
  0::bigint,
  'unrelated user C cannot see B invitation'
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.accept_room_invitation(%L::uuid)',
    (select id from pg_temp.test_ids where key = 'invite_b')
  )),
  '42501',
  'unrelated user C cannot accept B invitation'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.accept_room_invitation(%L::uuid)',
    (select id from pg_temp.test_ids where key = 'invite_b')
  )),
  '42501',
  'inviter A cannot accept B invitation'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  public.accept_room_invitation(
    (select id from pg_temp.test_ids where key = 'invite_b')
  ),
  (select id from pg_temp.test_ids where key = 'room'),
  'invited user B accepts the room invitation'
);

select is(
  public.accept_room_invitation(
    (select id from pg_temp.test_ids where key = 'invite_b')
  ),
  (select id from pg_temp.test_ids where key = 'room'),
  'repeated invitation acceptance is idempotent'
);

select is(
  (select count(*) from public.participants
   where room_id = (select id from pg_temp.test_ids where key = 'room')
     and profile_id = auth.uid()),
  1::bigint,
  'acceptance creates one participant row for user B'
);

select is(
  (select count(*) from public.rooms
   where id = (select id from pg_temp.test_ids where key = 'room')),
  1::bigint,
  'user B sees the room after accepting'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

insert into pg_temp.test_ids (key, id)
select 'bill', public.create_room_settlement_v2(
  (select id from pg_temp.test_ids where key = 'room'),
  'Runtime dinner', 24000, 'Test bank', '000-000', 'Runtime A'
);

select ok(
  (select id is not null from pg_temp.test_ids where key = 'bill'),
  'settlement v2 creates an active bill'
);

select is(
  public.create_room_settlement_v2(
    (select id from pg_temp.test_ids where key = 'room'),
    'Runtime dinner', 24000, 'Test bank', '000-000', 'Runtime A'
  ),
  (select id from pg_temp.test_ids where key = 'bill'),
  'repeated settlement creation returns the same active bill'
);

select is(
  (select count(*) from public.dutch_pay_bills
   where room_id = (select id from pg_temp.test_ids where key = 'room')),
  1::bigint,
  'only one active settlement exists in the room'
);

select is(
  (select count(*) from public.dutch_pay_members
   where bill_id = (select id from pg_temp.test_ids where key = 'bill')),
  2::bigint,
  'settlement recipients are snapshotted at creation time'
);

select is(
  (select count(*) from public.notifications
   where settlement_id = (select id from pg_temp.test_ids where key = 'bill')),
  1::bigint,
  'settlement creates one linked notification'
);

select is(
  (select count(*) from public.messages
   where room_id = (select id from pg_temp.test_ids where key = 'room')
     and event_key like 'settlement-created:%'),
  1::bigint,
  'settlement v2 creates one fixed system event'
);

insert into pg_temp.test_ids (key, id)
select 'member_b', id
from public.dutch_pay_members
where bill_id = (select id from pg_temp.test_ids where key = 'bill')
  and profile_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.dutch_pay_bills
   where id = (select id from pg_temp.test_ids where key = 'bill')),
  1::bigint,
  'snapshotted recipient B sees the settlement'
);

select is(
  (select count(*) from public.notifications
   where settlement_id = (select id from pg_temp.test_ids where key = 'bill')),
  1::bigint,
  'snapshotted recipient B sees the linked notification'
);

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.dutch_pay_bills
   where id = (select id from pg_temp.test_ids where key = 'bill')),
  0::bigint,
  'unrelated user C cannot see the settlement'
);

select is(
  (select count(*) from public.notifications
   where settlement_id = (select id from pg_temp.test_ids where key = 'bill')),
  0::bigint,
  'unrelated user C cannot see the linked notification'
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.notifications '
    || '(room_id, title, message, bank_name, account_number, amount, settlement_id) '
    || 'values (%L::uuid, %L, %L, %L, %L, 1, %L::uuid)',
    (select id from pg_temp.test_ids where key = 'room'),
    'forged', 'forged', 'forged', 'forged',
    (select id from pg_temp.test_ids where key = 'bill')
  )),
  '42501',
  'unrelated user cannot forge a linked notification'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

insert into pg_temp.test_ids (key, id)
select 'invite_c', public.create_room_invitation(
  (select id from pg_temp.test_ids where key = 'room'),
  'cccccccc-0000-0000-0000-0000000000c3'
);

select ok(
  (select id is not null from pg_temp.test_ids where key = 'invite_c'),
  'user A creates a pending invitation for user C'
);

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  public.accept_room_invitation(
    (select id from pg_temp.test_ids where key = 'invite_c')
  ),
  (select id from pg_temp.test_ids where key = 'room'),
  'user C accepts after the settlement snapshot'
);

select is(
  (select count(*) from public.participants
   where room_id = (select id from pg_temp.test_ids where key = 'room')),
  3::bigint,
  'the room has three active participants'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

insert into pg_temp.test_ids (key, id)
select 'menu_option', public.add_voting_item(
  (select id from pg_temp.test_ids where key = 'room'),
  'menu', 'Runtime menu'
);

select ok(
  (select id is not null from pg_temp.test_ids where key = 'menu_option'),
  'user A adds a menu voting option'
);

select is(
  public.toggle_vote(
    (select id from pg_temp.test_ids where key = 'room'),
    (select id from pg_temp.test_ids where key = 'menu_option')
  ),
  true,
  'user A casts the first vote'
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.confirm_room_vote(%L::uuid, %L::uuid)',
    (select id from pg_temp.test_ids where key = 'room'),
    (select id from pg_temp.test_ids where key = 'menu_option')
  )),
  '22023',
  'one of three votes cannot confirm a strict majority'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  public.toggle_vote(
    (select id from pg_temp.test_ids where key = 'room'),
    (select id from pg_temp.test_ids where key = 'menu_option')
  ),
  true,
  'user B casts the second vote'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.confirm_room_vote(%L::uuid, %L::uuid)',
    (select id from pg_temp.test_ids where key = 'room'),
    (select id from pg_temp.test_ids where key = 'menu_option')
  )),
  '00000',
  'two of three votes confirm the server-computed leader'
);

select is(
  (select confirmed_menu_item_id from public.rooms
   where id = (select id from pg_temp.test_ids where key = 'room')),
  (select id from pg_temp.test_ids where key = 'menu_option'),
  'room stores the finalized menu item id'
);

select is(
  (select count(*) from public.messages
   where room_id = (select id from pg_temp.test_ids where key = 'room')
     and event_key like 'vote-confirmed:%:menu:%'),
  1::bigint,
  'vote confirmation creates one fixed system event'
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.confirm_room_vote(%L::uuid, %L::uuid)',
    (select id from pg_temp.test_ids where key = 'room'),
    (select id from pg_temp.test_ids where key = 'menu_option')
  )),
  '00000',
  'repeating the same vote confirmation is idempotent'
);

select is(
  (select count(*) from public.messages
   where room_id = (select id from pg_temp.test_ids where key = 'room')
     and event_key like 'vote-confirmed:%:menu:%'),
  1::bigint,
  'repeated vote confirmation does not duplicate the system event'
);

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.dutch_pay_bills
   where id = (select id from pg_temp.test_ids where key = 'bill')),
  0::bigint,
  'late-joining user C cannot see the earlier settlement'
);

select is(
  (select count(*) from public.notifications
   where settlement_id = (select id from pg_temp.test_ids where key = 'bill')),
  0::bigint,
  'late-joining user C cannot see the earlier linked notification'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  public.leave_room((select id from pg_temp.test_ids where key = 'room')),
  'left',
  'user B leaves through the serialized RPC'
);

select is(
  (select count(*) from public.dutch_pay_bills
   where id = (select id from pg_temp.test_ids where key = 'bill')),
  1::bigint,
  'recipient B still sees the settlement after leaving the room'
);

select is(
  (select count(*) from public.notifications
   where settlement_id = (select id from pg_temp.test_ids where key = 'bill')),
  1::bigint,
  'recipient B still sees the linked notification after leaving the room'
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.set_settlement_completed(%L::uuid, true)',
    (select id from pg_temp.test_ids where key = 'member_b')
  )),
  '00000',
  'recipient B can complete their snapshotted settlement after leaving'
);

select is(
  (select is_completed from public.dutch_pay_members
   where id = (select id from pg_temp.test_ids where key = 'member_b')),
  true,
  'recipient completion state is persisted'
);

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.set_settlement_completed(%L::uuid, false)',
    (select id from pg_temp.test_ids where key = 'member_b')
  )),
  '42501',
  'late joiner C cannot change B settlement completion'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.dutch_pay_bills '
    || '(room_id, creator_id, title, total_amount, split_count) '
    || 'values (%L::uuid, %L::uuid, %L, 1, 1)',
    (select id from pg_temp.test_ids where key = 'room'),
    auth.uid(),
    'forged bill'
  )),
  '42501',
  'authenticated user cannot bypass settlement RPC with a direct bill insert'
);

select is(
  pg_temp.sqlstate_of(format(
    'update public.rooms set confirmed_menu = %L where id = %L::uuid',
    'forged menu',
    (select id from pg_temp.test_ids where key = 'room')
  )),
  '42501',
  'authenticated user cannot directly overwrite server-owned room state'
);

select is(
  pg_temp.sqlstate_of(format(
    'delete from public.participants where room_id = %L::uuid and profile_id = %L::uuid',
    (select id from pg_temp.test_ids where key = 'room'),
    auth.uid()
  )),
  '42501',
  'authenticated user cannot bypass leave_room with a direct participant delete'
);

reset role;

select * from finish();
rollback;
