begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s4_fixture.sql
select pg_temp.check(to_regprocedure('public.update_settlement_amount(uuid,integer)') is not null,'retired amount function remains installed');
select pg_temp.check(not has_function_privilege('authenticated','public.update_settlement_amount(uuid,integer)','EXECUTE'),'authenticated cannot execute the retired amount function');
select pg_temp.check(not has_function_privilege('anon','public.update_settlement_amount(uuid,integer)','EXECUTE'),'anon cannot execute the retired amount function');
select pg_temp.check(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.update_settlement_amount(uuid,integer)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC has no retired amount EXECUTE grant');
select pg_temp.check((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='private.s1_bill_revision()'::regprocedure)
 and not has_function_privilege('authenticated','private.s1_bill_revision()','EXECUTE')
 and not has_function_privilege('service_role','private.s1_bill_revision()','EXECUTE'),'bill revision trigger keeps fixed search_path and private execution');
-- Trusted legacy preconfirmation bill: its creator must not reach the retired bypass.
insert into public.dutch_pay_bills(id,room_id,creator_id,title,total_amount,split_count)
values('99000000-0000-4000-8000-000000000040','24000000-0000-4000-8000-000000000001','10000001-0000-4000-8000-000000000001','Legacy unconfirmed',1000,2);
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.update_settlement_amount('99000000-0000-4000-8000-000000000040',999999)$q$)='42501','legacy scheduling creator cannot change amount through retired RPC');
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.update_settlement_amount('99000000-0000-4000-8000-000000000040',999999)$q$)='42501','another member cannot invoke retired amount RPC');
reset role;
set local role anon;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.update_settlement_amount('99000000-0000-4000-8000-000000000040',999999)$q$)='42501','anon invocation fails before function execution');
reset role;
update public.rooms set stage='place' where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.update_settlement_amount('99000000-0000-4000-8000-000000000040',999999)$q$)='42501','legacy place creator cannot invoke retired amount RPC');
reset role;
update public.rooms set expires_at=clock_timestamp()-interval '1 second' where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.update_settlement_amount('99000000-0000-4000-8000-000000000040',999999)$q$)='42501','expired room cannot use retired amount RPC');
reset role;
select pg_temp.check((select total_amount=1000 and event_revision=0 from public.dutch_pay_bills where id='99000000-0000-4000-8000-000000000040'),'rejected calls preserve amount and revision');
-- Real v2 solo creation immediately closes the bill: reproduce the reported second bypass.
update public.rooms set stage='confirmed',appointment_confirmed_at=clock_timestamp(),appointment_confirmed_by=owner_id where id='24000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.as_user('10000003-0000-4000-8000-000000000003');
insert into s4_data values('closed-amount-bill',to_jsonb(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000002','Solo closed',1000,'Synthetic','0000','C')));
reset role;
create temporary table closed_amount_before as select to_jsonb(b) value from public.dutch_pay_bills b where id=(select (v#>>'{}')::uuid from s4_data where k='closed-amount-bill');
select pg_temp.check((select total_amount=1000 and payment_disclosure_closed_at is not null from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='closed-amount-bill'))
 and (select stage='done' from public.rooms where id='24000000-0000-4000-8000-000000000002'),'solo v2 settlement closes with its original amount');
set local role authenticated;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.update_settlement_amount((select (v#>>'{}')::uuid from s4_data where k='closed-amount-bill'),999999)$q$)='42501','solo creator cannot edit closed bill through retired RPC');
reset role;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.update_settlement_amount((select (v#>>'{}')::uuid from s4_data where k='closed-amount-bill'),999999)$q$)='S1005','trigger also blocks the retained function when executed by a privileged role');
select pg_temp.check(pg_temp.sqlstate_of($q$update public.dutch_pay_bills set total_amount=999999 where id=(select (v#>>'{}')::uuid from s4_data where k='closed-amount-bill')$q$)='S1005','trigger rejects a privileged closed-bill amount change');
select pg_temp.check(pg_temp.sqlstate_of($q$update public.dutch_pay_bills set total_amount=null where id=(select (v#>>'{}')::uuid from s4_data where k='closed-amount-bill')$q$)='S1005','closed amount comparison is NULL-safe');
select pg_temp.check(pg_temp.sqlstate_of($q$update public.dutch_pay_bills set total_amount=1000 where id=(select (v#>>'{}')::uuid from s4_data where k='closed-amount-bill')$q$)='00000','same closed amount is a permitted no-op');
set local role authenticated;
insert into s4_data values('new-amount-bill',to_jsonb(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000002','Next solo',2000,'Synthetic','1111','C')));
select pg_temp.check((select v from s4_data where k='new-amount-bill')<>(select v from s4_data where k='closed-amount-bill'),'normal re-settlement creates a new bill with a new amount');
reset role;
select pg_temp.check((select to_jsonb(b)=(select value from closed_amount_before) from public.dutch_pay_bills b where id=(select (v#>>'{}')::uuid from s4_data where k='closed-amount-bill')),'rejected edits, no-op and re-settlement preserve the original closed bill exactly');
-- Existing guarded creation/update path may still update an open legacy active settlement.
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(public.create_room_settlement_v2('20000000-0000-4000-8000-000000000001','Open update',7000,'Synthetic','2222','A')=(select v from pg_temp.s1_ids where k='bill'),'guarded v2 update still reuses its open active bill');
reset role;
select pg_temp.check((select total_amount=7000 and payment_disclosure_closed_at is null from public.dutch_pay_bills where id=(select v from pg_temp.s1_ids where k='bill')),'closed-bill trigger permits normal open-bill amount changes');
-- Normal room/account cleanup must still detach history without modifying its amount.
set local role authenticated;
select pg_temp.as_user('10000003-0000-4000-8000-000000000003');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.leave_room('24000000-0000-4000-8000-000000000002')$q$)='00000','owner may delete a completed room through normal leave RPC');
reset role;
select pg_temp.check((select room_id is null and total_amount=1000 from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='closed-amount-bill')),'room deletion detaches closed bill without altering amount');
select pg_temp.check(pg_temp.sqlstate_of($q$delete from public.profiles where id='10000003-0000-4000-8000-000000000003'$q$)='00000','profile cleanup remains compatible with closed-bill amount protection');
select pg_temp.check((select creator_id is null and room_id is null and total_amount=1000 and payment_disclosure_closed_at is not null from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='closed-amount-bill')),'closed amount and disclosure remain final after room/profile FK cleanup');
select * from finish();
rollback;
