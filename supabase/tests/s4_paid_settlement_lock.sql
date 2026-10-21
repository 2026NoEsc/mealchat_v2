-- Local synthetic regression: both public wrappers must share the paid-bill boundary.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s4_fixture.sql
insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id) values
 ('24000000-0000-4000-8000-000000000005','S4LOCK5','Synthetic payment lock',current_date+1,clock_timestamp()+interval '4 days','10000001-0000-4000-8000-000000000001');
insert into public.participants(room_id,profile_id,name) values
 ('24000000-0000-4000-8000-000000000001','10000003-0000-4000-8000-000000000003','Synthetic unpaid C'),
 ('24000000-0000-4000-8000-000000000005','10000002-0000-4000-8000-000000000002','Synthetic payer B'),
 ('24000000-0000-4000-8000-000000000005','10000003-0000-4000-8000-000000000003','Synthetic unpaid C');
update public.rooms set stage='confirmed',appointment_confirmed_at=clock_timestamp(),appointment_confirmed_by=owner_id
 where id in('24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000005');
create function pg_temp.payment_error(command text) returns jsonb language plpgsql as $$
begin execute command; return '{}'::jsonb;
exception when others then return jsonb_build_object('code',sqlstate,'message',sqlerrm); end; $$;
grant execute on function pg_temp.payment_error(text) to authenticated;
create temporary table paid_before(k text primary key,bill jsonb,notification jsonb);
grant select on paid_before to authenticated;
select pg_temp.check((select prosecdef and proconfig @> array['search_path=""'] from pg_proc
 where oid='private.create_room_settlement_impl(uuid,text,integer,text,text,text,boolean)'::regprocedure),'paid core keeps SECURITY DEFINER with fixed empty search_path');
select pg_temp.check(not has_function_privilege('authenticated','private.create_room_settlement_impl(uuid,text,integer,text,text,text,boolean)','EXECUTE')
 and not has_function_privilege('service_role','private.create_room_settlement_impl(uuid,text,integer,text,text,text,boolean)','EXECUTE'), 'paid core remains private');

-- create_room_settlement: creator completion alone must not lock an open bill.
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into s4_data values('lock-v1',to_jsonb(public.create_room_settlement('24000000-0000-4000-8000-000000000001','Initial',6000,'Synthetic A','0000','Synthetic holder A')));
select pg_temp.check(public.create_room_settlement('24000000-0000-4000-8000-000000000001','Before payment',9000,'Synthetic B','1111','Synthetic holder B')=(select (v#>>'{}')::uuid from s4_data where k='lock-v1'),'create_room_settlement allows amount and all account fields before another recipient pays');
select pg_temp.check((select total_amount=9000 and split_count=3 from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1')),'create_room_settlement retains the fixed three-member denominator');
select pg_temp.check(public.get_settlement_payment_details((select (v#>>'{}')::uuid from s4_data where k='lock-v1'))->'payment_details'=jsonb_build_object('bank_name','Synthetic B','account_number','1111','account_holder','Synthetic holder B'),'create_room_settlement persists the new account before payment');
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select public.set_settlement_completed(id,true) from public.dutch_pay_members
 where bill_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1') and profile_id='10000002-0000-4000-8000-000000000002';
select pg_temp.check(public.get_settlement_payment_details((select (v#>>'{}')::uuid from s4_data where k='lock-v1'))->>'status'='open','create_room_settlement remains open after only one non-creator pays');
reset role;
insert into paid_before select 'lock-v1',to_jsonb(b),(select to_jsonb(n) from public.notifications n where settlement_id=b.id)
 from public.dutch_pay_bills b where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1');
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement('24000000-0000-4000-8000-000000000001','Before payment',12000,'Synthetic B','1111','Synthetic holder B')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement rejects amount changes after a different recipient pays');
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement('24000000-0000-4000-8000-000000000001','Before payment',9000,'Synthetic C','1111','Synthetic holder B')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement rejects bank changes after a different recipient pays');
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement('24000000-0000-4000-8000-000000000001','Before payment',9000,'Synthetic B','2222','Synthetic holder B')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement rejects account changes after a different recipient pays');
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement('24000000-0000-4000-8000-000000000001','Before payment',9000,'Synthetic B','1111','Synthetic holder C')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement rejects holder changes after a different recipient pays');
select pg_temp.check(public.create_room_settlement('24000000-0000-4000-8000-000000000001','Before payment',9000,' Synthetic B ',' 1111 ',' Synthetic holder B ')=(select (v#>>'{}')::uuid from s4_data where k='lock-v1'),'create_room_settlement allows normalized same-value retry after payment');
reset role;
select pg_temp.check((select to_jsonb(b)=(select bill from paid_before where k='lock-v1') from public.dutch_pay_bills b where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1')),'create_room_settlement rejected changes and same-value retry preserve the entire bill including event revision');
select pg_temp.check((select to_jsonb(n)=(select notification from paid_before where k='lock-v1') from public.notifications n where settlement_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1')),'create_room_settlement rejected changes and same-value retry preserve linked notification');
-- A trusted historical mismatch must not be repaired into a new share after payment.
update public.dutch_pay_bills set split_count=4 where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1');
set local role authenticated;
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement('24000000-0000-4000-8000-000000000001','Before payment',9000,'Synthetic B','1111','Synthetic holder B')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement rejects implicit denominator repair after payment');
select pg_temp.check((select split_count=4 from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1')),'create_room_settlement leaves rejected denominator unchanged');
reset role;
update public.dutch_pay_bills set split_count=3 where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1');
set local role authenticated;
insert into s4_data select 'lock-v1-before-title',jsonb_build_object('revision',b.event_revision,'messages',(select count(*) from public.messages where room_id=b.room_id)) from public.dutch_pay_bills b where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1');
select pg_temp.check(public.create_room_settlement('24000000-0000-4000-8000-000000000001','Renamed after payment',9000,'Synthetic B','1111','Synthetic holder B')=(select (v#>>'{}')::uuid from s4_data where k='lock-v1'),'create_room_settlement allows a title-only edit because obligation and destination stay fixed');
select pg_temp.check((select title='Renamed after payment' and total_amount=9000 and split_count=3 from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1')),'create_room_settlement title edit preserves monetary terms');
select pg_temp.check(public.get_settlement_payment_details((select (v#>>'{}')::uuid from s4_data where k='lock-v1'))->'payment_details'=jsonb_build_object('bank_name','Synthetic B','account_number','1111','account_holder','Synthetic holder B'),'create_room_settlement title edit preserves account');
select pg_temp.check((select count(*)=1 and max(amount)=3000 from public.notifications where settlement_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1')),'create_room_settlement never duplicates notification or changes per-person amount after payment');
select pg_temp.check((select event_revision=(select (v->>'revision')::bigint+1 from s4_data where k='lock-v1-before-title') from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1')),'create_room_settlement title-only edit increments revision once');
select pg_temp.check((select count(*)=(select (v->>'messages')::bigint from s4_data where k='lock-v1-before-title') from public.messages where room_id='24000000-0000-4000-8000-000000000001'),'create_room_settlement title-only edit sends no payment-change system message');
reset role;
select pg_temp.check((select to_jsonb(n)=(select notification from paid_before where k='lock-v1') from public.notifications n where settlement_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1')),'create_room_settlement title-only edit does not update or reannounce the payment notification');
set local role authenticated;
select pg_temp.check(public.create_room_settlement('24000000-0000-4000-8000-000000000001','Renamed after payment',9000,'Synthetic B','1111','Synthetic holder B')=(select (v#>>'{}')::uuid from s4_data where k='lock-v1'),'create_room_settlement title-only retry stays idempotent');
select pg_temp.check((select event_revision=(select (v->>'revision')::bigint+1 from s4_data where k='lock-v1-before-title') from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1')),'create_room_settlement title-only retry leaves revision unchanged');
-- Sender undo is legal while open. Without a completed non-creator, edits become legal again.
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select public.set_settlement_completed(id,false) from public.dutch_pay_members
 where bill_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1') and profile_id='10000002-0000-4000-8000-000000000002';
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(public.create_room_settlement('24000000-0000-4000-8000-000000000001','After undo',12000,'Synthetic C','2222','Synthetic holder C')=(select (v#>>'{}')::uuid from s4_data where k='lock-v1'),'create_room_settlement allows changes once no non-creator is completed');
reset role;
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.set_settlement_completed(id,true) from public.dutch_pay_members
 where bill_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1') and profile_id='10000002-0000-4000-8000-000000000002';
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement('24000000-0000-4000-8000-000000000001','Proxy change',15000,'Synthetic C','2222','Synthetic holder C')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement locks after creator reports another recipient paid');
reset role;
update public.dutch_pay_members set profile_id=null
 where bill_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v1') and profile_id='10000002-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement('24000000-0000-4000-8000-000000000001','Null-profile change',15000,'Synthetic C','2222','Synthetic holder C')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement NULL-profile completed recipient still locks payment terms');
select pg_temp.check(pg_temp.s4_error($q$select public.create_room_settlement('24000000-0000-4000-8000-000000000004','Unconfirmed',6000,'Synthetic A','0000','Synthetic holder A')$q$)=jsonb_build_object('code','S4008','hint','operation=settlement'),'create_room_settlement preserves S4008 confirmation boundary and hint');
reset role;


-- create_room_settlement_v2: creator completion alone must not lock an open bill.
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into s4_data values('lock-v2',to_jsonb(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Initial',6000,'Synthetic A','0000','Synthetic holder A')));
select pg_temp.check(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Before payment',9000,'Synthetic B','1111','Synthetic holder B')=(select (v#>>'{}')::uuid from s4_data where k='lock-v2'),'create_room_settlement_v2 allows amount and all account fields before another recipient pays');
select pg_temp.check((select total_amount=9000 and split_count=3 from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2')),'create_room_settlement_v2 retains the fixed three-member denominator');
select pg_temp.check(public.get_settlement_payment_details((select (v#>>'{}')::uuid from s4_data where k='lock-v2'))->'payment_details'=jsonb_build_object('bank_name','Synthetic B','account_number','1111','account_holder','Synthetic holder B'),'create_room_settlement_v2 persists the new account before payment');
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select public.set_settlement_completed(id,true) from public.dutch_pay_members
 where bill_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2') and profile_id='10000002-0000-4000-8000-000000000002';
select pg_temp.check(public.get_settlement_payment_details((select (v#>>'{}')::uuid from s4_data where k='lock-v2'))->>'status'='open','create_room_settlement_v2 remains open after only one non-creator pays');
reset role;
insert into paid_before select 'lock-v2',to_jsonb(b),(select to_jsonb(n) from public.notifications n where settlement_id=b.id)
 from public.dutch_pay_bills b where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2');
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Before payment',12000,'Synthetic B','1111','Synthetic holder B')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement_v2 rejects amount changes after a different recipient pays');
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Before payment',9000,'Synthetic C','1111','Synthetic holder B')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement_v2 rejects bank changes after a different recipient pays');
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Before payment',9000,'Synthetic B','2222','Synthetic holder B')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement_v2 rejects account changes after a different recipient pays');
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Before payment',9000,'Synthetic B','1111','Synthetic holder C')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement_v2 rejects holder changes after a different recipient pays');
select pg_temp.check(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Before payment',9000,' Synthetic B ',' 1111 ',' Synthetic holder B ')=(select (v#>>'{}')::uuid from s4_data where k='lock-v2'),'create_room_settlement_v2 allows normalized same-value retry after payment');
reset role;
select pg_temp.check((select to_jsonb(b)=(select bill from paid_before where k='lock-v2') from public.dutch_pay_bills b where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2')),'create_room_settlement_v2 rejected changes and same-value retry preserve the entire bill including event revision');
select pg_temp.check((select to_jsonb(n)=(select notification from paid_before where k='lock-v2') from public.notifications n where settlement_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2')),'create_room_settlement_v2 rejected changes and same-value retry preserve linked notification');
-- A trusted historical mismatch must not be repaired into a new share after payment.
update public.dutch_pay_bills set split_count=4 where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2');
set local role authenticated;
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Before payment',9000,'Synthetic B','1111','Synthetic holder B')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement_v2 rejects implicit denominator repair after payment');
select pg_temp.check((select split_count=4 from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2')),'create_room_settlement_v2 leaves rejected denominator unchanged');
reset role;
update public.dutch_pay_bills set split_count=3 where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2');
set local role authenticated;
insert into s4_data select 'lock-v2-before-title',jsonb_build_object('revision',b.event_revision,'messages',(select count(*) from public.messages where room_id=b.room_id)) from public.dutch_pay_bills b where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2');
select pg_temp.check(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Renamed after payment',9000,'Synthetic B','1111','Synthetic holder B')=(select (v#>>'{}')::uuid from s4_data where k='lock-v2'),'create_room_settlement_v2 allows a title-only edit because obligation and destination stay fixed');
select pg_temp.check((select title='Renamed after payment' and total_amount=9000 and split_count=3 from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2')),'create_room_settlement_v2 title edit preserves monetary terms');
select pg_temp.check(public.get_settlement_payment_details((select (v#>>'{}')::uuid from s4_data where k='lock-v2'))->'payment_details'=jsonb_build_object('bank_name','Synthetic B','account_number','1111','account_holder','Synthetic holder B'),'create_room_settlement_v2 title edit preserves account');
select pg_temp.check((select count(*)=1 and max(amount)=3000 from public.notifications where settlement_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2')),'create_room_settlement_v2 never duplicates notification or changes per-person amount after payment');
select pg_temp.check((select event_revision=(select (v->>'revision')::bigint+1 from s4_data where k='lock-v2-before-title') from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2')),'create_room_settlement_v2 title-only edit increments revision once');
select pg_temp.check((select count(*)=(select (v->>'messages')::bigint from s4_data where k='lock-v2-before-title') from public.messages where room_id='24000000-0000-4000-8000-000000000005'),'create_room_settlement_v2 title-only edit sends no payment-change system message');
reset role;
select pg_temp.check((select to_jsonb(n)=(select notification from paid_before where k='lock-v2') from public.notifications n where settlement_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2')),'create_room_settlement_v2 title-only edit does not update or reannounce the payment notification');
set local role authenticated;
select pg_temp.check(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Renamed after payment',9000,'Synthetic B','1111','Synthetic holder B')=(select (v#>>'{}')::uuid from s4_data where k='lock-v2'),'create_room_settlement_v2 title-only retry stays idempotent');
select pg_temp.check((select event_revision=(select (v->>'revision')::bigint+1 from s4_data where k='lock-v2-before-title') from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2')),'create_room_settlement_v2 title-only retry leaves revision unchanged');
-- Sender undo is legal while open. Without a completed non-creator, edits become legal again.
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select public.set_settlement_completed(id,false) from public.dutch_pay_members
 where bill_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2') and profile_id='10000002-0000-4000-8000-000000000002';
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','After undo',12000,'Synthetic C','2222','Synthetic holder C')=(select (v#>>'{}')::uuid from s4_data where k='lock-v2'),'create_room_settlement_v2 allows changes once no non-creator is completed');
reset role;
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.set_settlement_completed(id,true) from public.dutch_pay_members
 where bill_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2') and profile_id='10000002-0000-4000-8000-000000000002';
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Proxy change',15000,'Synthetic C','2222','Synthetic holder C')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement_v2 locks after creator reports another recipient paid');
reset role;
update public.dutch_pay_members set profile_id=null
 where bill_id=(select (v#>>'{}')::uuid from s4_data where k='lock-v2') and profile_id='10000002-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.check(pg_temp.payment_error($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000005','Null-profile change',15000,'Synthetic C','2222','Synthetic holder C')$q$)=jsonb_build_object('code','42501','message','SETTLEMENT_LOCKED_AFTER_PAYMENT'),'create_room_settlement_v2 NULL-profile completed recipient still locks payment terms');
select pg_temp.check(pg_temp.s4_error($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000004','Unconfirmed',6000,'Synthetic A','0000','Synthetic holder A')$q$)=jsonb_build_object('code','S4008','hint','operation=settlement'),'create_room_settlement_v2 preserves S4008 confirmation boundary and hint');
reset role;

select * from finish();
rollback;
