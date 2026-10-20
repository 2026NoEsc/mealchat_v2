-- Committed synthetic pre-S4 rooms; temporary snapshots survive each migration COMMIT.
\ir s1_fixture.sql
insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id,stage,confirmed_slot,confirmed_menu,confirmed_menu_item_id,is_confirmed,location_name,voting_items)
select ('26000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'UPGRADE'||i,'Synthetic legacy '||i,current_date+1,clock_timestamp()+interval '4 days','10000001-0000-4000-8000-000000000001',
case i when 1 then 'scheduling' when 2 then 'place' when 3 then 'place' when 4 then 'place' when 5 then 'confirmed' when 6 then 'settling' when 7 then 'done' else 'place' end,
case when i=1 then '10월 20일 11시' else '2030-01-01T11:00:00+09:00' end,
case when i in(3,4,5,6,7) then 'Old restaurant' end,
case when i=3 then '96000000-0000-4000-8000-000000000001'::uuid end,i<>2,'Old location is not a restaurant',
'[{"id":"96000000-0000-4000-8000-000000000001","kind":"menu","label":"Old restaurant","created_by":"10000001-0000-4000-8000-000000000001"}]'::jsonb
from generate_series(1,9) i;
update public.participants set voted_items='["96000000-0000-4000-8000-000000000001"]',schedule=jsonb_build_object('slots',jsonb_build_array(to_char((clock_timestamp() at time zone 'Asia/Seoul')::date+1,'YYYY-MM-DD')||'-11','2030-02-30-12')) where room_id::text like '26000000-%';
update public.participants set schedule='{}' where room_id='26000000-0000-4000-8000-000000000008';
update public.participants set schedule=jsonb_build_object('slots',jsonb_build_array('2000-01-01-11'),'submitted_at',clock_timestamp()) where room_id='26000000-0000-4000-8000-000000000009';
insert into public.participants(room_id,profile_id,name) values('26000000-0000-4000-8000-000000000006','10000002-0000-4000-8000-000000000002','Legacy recipient B');
create temporary table s4_upgrade_bill(id uuid);
grant select,insert on s4_upgrade_bill to authenticated;
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into s4_upgrade_bill select public.create_room_settlement_v2('26000000-0000-4000-8000-000000000006','Legacy active bill',2000,'Synthetic','0000','A');
reset role;
-- Extreme legacy inconsistencies survive upgrade without silently legitimizing their bills.
insert into public.dutch_pay_bills(id,room_id,creator_id,title,total_amount,split_count)
select ('99000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('26000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000001-0000-4000-8000-000000000001','Unconfirmed legacy open bill',1000,1 from generate_series(1,2) i;
insert into public.dutch_pay_members(bill_id,profile_id,name,is_completed) values('99000000-0000-4000-8000-000000000001','10000001-0000-4000-8000-000000000001','Synthetic incomplete',false);
update public.rooms set stage=case when id='26000000-0000-4000-8000-000000000001' then 'scheduling' else 'place' end where id in('26000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000002');
create temporary table s4_upgrade_rooms as select id,to_jsonb(r) v from public.rooms r;
create temporary table s4_upgrade_members as select id,to_jsonb(p) v from public.participants p;
create temporary table s4_upgrade_bills as select id,to_jsonb(b) v from public.dutch_pay_bills b;

-- Historical pending and accepted invitations exercise the real final S4 migration backfill.
insert into public.room_invitations(id,room_id,inviter_id,invitee_id,room_title,status,expires_at,responded_at) values
 ('97000000-0000-4000-8000-000000000061','26000000-0000-4000-8000-000000000006','10000001-0000-4000-8000-000000000001','10000004-0000-4000-8000-000000000004','Legacy settling','pending',clock_timestamp()+interval '4 days',null),
 ('97000000-0000-4000-8000-000000000071','26000000-0000-4000-8000-000000000007','10000001-0000-4000-8000-000000000001','10000005-0000-4000-8000-000000000005','Legacy done','pending',clock_timestamp()+interval '4 days',null),
 ('97000000-0000-4000-8000-000000000072','26000000-0000-4000-8000-000000000007','10000001-0000-4000-8000-000000000001','10000008-0000-4000-8000-000000000008','Legacy accepted','accepted',clock_timestamp()+interval '4 days',clock_timestamp()),
 ('97000000-0000-4000-8000-000000000021','26000000-0000-4000-8000-000000000002','10000001-0000-4000-8000-000000000001','10000006-0000-4000-8000-000000000006','Legacy place','pending',clock_timestamp()+interval '4 days',null);
create temporary table s4_upgrade_invitations as select id,to_jsonb(i) value from public.room_invitations i;
