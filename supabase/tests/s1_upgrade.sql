-- Run only BEFORE M1, in the disposable S1-A database. No real-user data.
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) values
('81000001-0000-4000-8000-000000000001','authenticated','authenticated','s1-upgrade-a@example.invalid','{"name":"Synthetic upgrade A","marketing_opt_in":true}',clock_timestamp(),clock_timestamp()),
('81000002-0000-4000-8000-000000000002','authenticated','authenticated','s1-upgrade-b@example.invalid','{"name":"Synthetic upgrade B","marketing_opt_in":true}',clock_timestamp(),clock_timestamp());
update public.profile_private set privacy_settings='{"birth":"public","birthdate":"private","account":"public","gender":"invalid","bio":"public","unknown":"public"}',
personal_data='{"gender":"female","bio":"Synthetic bio","allergies":["synthetic"],"unclassified_business_key":"synthetic"}',tastes='{"korean":true,"meat":false,"allergy":true,"unknown":true}' where id='81000001-0000-4000-8000-000000000001';
update public.profile_consents set agreed_at='2024-02-29T01:02:03Z' where kind='marketing' and profile_id in ('81000001-0000-4000-8000-000000000001','81000002-0000-4000-8000-000000000002');
insert into public.profile_consents(profile_id,kind,version,agreed,agreed_at) values('81000001-0000-4000-8000-000000000001','marketing','2026-08-17',false,'2024-02-29T01:02:03Z');
insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id) values('82000001-0000-4000-8000-000000000001','S1UPGRADE','Synthetic upgrade',current_date+1,clock_timestamp()+interval '1 day','81000001-0000-4000-8000-000000000001');
insert into public.participants(room_id,profile_id,name,personal_data,start_location_name,start_latitude,start_longitude) values('82000001-0000-4000-8000-000000000001','81000002-0000-4000-8000-000000000002','Synthetic B','{"gender":"male"}','Synthetic location',37,127);
insert into public.dutch_pay_bills(id,room_id,creator_id,title,total_amount,split_count,bank_name,account_number,account_holder) values
('83000001-0000-4000-8000-000000000001','82000001-0000-4000-8000-000000000001','81000001-0000-4000-8000-000000000001','Synthetic open',2000,2,'Synthetic','0000','Synthetic'),
('83000002-0000-4000-8000-000000000002','82000001-0000-4000-8000-000000000001','81000001-0000-4000-8000-000000000001','Synthetic complete',2000,2,'Synthetic','0000','Synthetic');
insert into public.dutch_pay_members(bill_id,profile_id,name,is_completed) values
('83000001-0000-4000-8000-000000000001','81000001-0000-4000-8000-000000000001','Synthetic A',true),
('83000001-0000-4000-8000-000000000001','81000002-0000-4000-8000-000000000002','Synthetic B',false),
('83000002-0000-4000-8000-000000000002','81000001-0000-4000-8000-000000000001','Synthetic A',true),
('83000002-0000-4000-8000-000000000002','81000002-0000-4000-8000-000000000002','Synthetic B',true);
insert into public.notifications(room_id,settlement_id,title,message,bank_name,account_number,amount) values('82000001-0000-4000-8000-000000000001','83000001-0000-4000-8000-000000000001','Synthetic','Synthetic','Synthetic','0000',1000);
