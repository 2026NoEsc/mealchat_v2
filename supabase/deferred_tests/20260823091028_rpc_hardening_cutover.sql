-- Manual release gate. Run only after the separately approved
-- deferred_migrations/20260823091028_rpc_hardening_cutover.sql has been applied
-- and the minimum supported client version no longer uses the legacy paths.
begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

select ok(
  not exists (
    select 1
    from unnest(array[
      'public.invite_friend_to_room(uuid,uuid)'::regprocedure,
      'public.create_room_settlement(uuid,text,integer,text,text,text)'::regprocedure,
      'public.post_room_system_message(uuid,text)'::regprocedure
    ]) function_oid
    where has_function_privilege('authenticated', function_oid, 'EXECUTE')
       or has_function_privilege('anon', function_oid, 'EXECUTE')
  ),
  'cutover removes legacy authenticated RPC compatibility'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'room_id', 'title', 'message', 'bank_name', 'account_number', 'amount', 'settlement_id'
    ]) column_name
    where has_column_privilege(
      'authenticated', 'public.notifications', column_name, 'INSERT'
    ) or has_column_privilege(
      'anon', 'public.notifications', column_name, 'INSERT'
    )
  ),
  'cutover removes all direct notification insert grants'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_insert_legacy_member'
  ),
  'cutover removes the legacy notification insert policy'
);

select ok(
  not has_column_privilege(
    'authenticated', 'public.dutch_pay_members', 'is_completed', 'UPDATE'
  )
  and not has_column_privilege(
    'anon', 'public.dutch_pay_members', 'is_completed', 'UPDATE'
  ),
  'cutover requires settlement completion through its authenticated RPC'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'dutch_pay_members'
      and policyname = 'dutch_pay_members_update_own'
  ),
  'cutover removes the direct settlement completion policy'
);

select * from finish();
rollback;
