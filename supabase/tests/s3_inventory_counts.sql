-- Only synthetic rows and count assertions; every mutation rolls back.
begin;
set local s1.tap='off';
\ir s4_fixture.sql
savepoint empty_inventory;
delete from public.rooms;
select pg_temp.check((select count(*)=11 and bool_and(value='0') from jsonb_each_text(private.s3_inventory_counts())),
 'empty inventory preserves all eleven zero-valued keys');
rollback to savepoint empty_inventory;
create temporary table s3_code_inventory_before as select private.s3_inventory_counts() as counts;
select pg_temp.check((select count(*)=11 from jsonb_object_keys(private.s3_inventory_counts()))
 and private.s3_inventory_counts() ?& array['invalid_code_rooms','duplicate_normalized_code_rooms'],
 'inventory includes both code compatibility keys');
insert into public.rooms(code,title,meeting_date,owner_id,expires_at)
select code,'Synthetic inventory code',current_date,'10000001-0000-4000-8000-000000000001'::uuid,clock_timestamp()+interval '7 days'
from (values ('ZYXW32'),('zyxw32'),(' ZYXW32 '),('ZYXO31'),('BAD'),(''),(repeat('A',65)),('ＡBCD23')) sample(code);
select pg_temp.check((private.s3_inventory_counts()->>'total_rooms')::bigint=(counts->>'total_rooms')::bigint+8,
 'inventory counts all synthetic rooms') from s3_code_inventory_before;
select pg_temp.check((private.s3_inventory_counts()->>'invalid_code_rooms')::bigint=(counts->>'invalid_code_rooms')::bigint+7,
 'invalid count includes rejected and noncanonical stored codes') from s3_code_inventory_before;
select pg_temp.check((private.s3_inventory_counts()->>'duplicate_normalized_code_rooms')::bigint=(counts->>'duplicate_normalized_code_rooms')::bigint+3,
 'duplicates count every valid normalized collision row, excluding NULL groups') from s3_code_inventory_before;
update public.rooms set code='WXYZ32' where code='zyxw32';
select pg_temp.check((private.s3_inventory_counts()->>'duplicate_normalized_code_rooms')::bigint=(counts->>'duplicate_normalized_code_rooms')::bigint+2
 and (private.s3_inventory_counts()->>'invalid_code_rooms')::bigint=(counts->>'invalid_code_rooms')::bigint+6,
 'canonicalizing one collision updates both independent counts') from s3_code_inventory_before;
update public.rooms set code='RSTU32' where code=' ZYXW32 ';
select pg_temp.check((private.s3_inventory_counts()->>'duplicate_normalized_code_rooms')::bigint=(counts->>'duplicate_normalized_code_rooms')::bigint
 and (private.s3_inventory_counts()->>'invalid_code_rooms')::bigint=(counts->>'invalid_code_rooms')::bigint+5,
 'separating the final collision removes the entire duplicate group') from s3_code_inventory_before;
select pg_temp.check(bool_and(private.s3_normalize_code(code) is not distinct from
 case when octet_length(code)<=64 and upper(btrim(code)) ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then upper(btrim(code)) end),
 'preparation-free inventory expression matches the runtime normalizer') from public.rooms;
rollback;
