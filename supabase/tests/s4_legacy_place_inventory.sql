-- Read-only aggregate; PostgreSQL 16+, before or after S4. No IDs or user content returned.
begin read only;
with target_rooms as (
 select r.id,r.expires_at from public.rooms r
 where r.stage='place' and r.expires_at>clock_timestamp()
 and to_jsonb(r)->>'meeting_starts_at' is null
), cells as (
 select r.id room_id,p.profile_id,r.expires_at,c.value#>>'{}' slot_key
 from target_rooms r join public.participants p on p.room_id=r.id and p.profile_id is not null
 cross join lateral jsonb_array_elements(case when jsonb_typeof(p.schedule->'slots')='array' then p.schedule->'slots' else '[]'::jsonb end) c(value)
 where jsonb_typeof(c.value)='string'
), parsed as (
 select room_id,profile_id,expires_at,case
 when slot_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-(1[1-9]|20)$' and pg_input_is_valid(left(slot_key,10),'date')
 then (left(slot_key,10)::date+make_interval(hours=>substring(slot_key from 12)::integer)) at time zone 'Asia/Seoul'
 end starts_at from cells
), submitted as (
 select distinct room_id,profile_id from parsed where starts_at>clock_timestamp() and starts_at+interval '1 hour'<=expires_at
), counts as (
 select r.id,count(p.id) eligible_count,count(s.profile_id) submitted_count
 from target_rooms r left join public.participants p on p.room_id=r.id and p.profile_id is not null
 left join submitted s on s.room_id=r.id and s.profile_id=p.profile_id group by r.id
)
select count(*) as active_place_without_selected_time,
 count(*) filter(where submitted_count=0) as place_without_any_valid_availability,
 count(*) filter(where eligible_count>submitted_count) as place_with_unsubmitted_members,
 count(*) filter(where eligible_count=0) as place_without_actual_members,
 -- Include expired rooms too: a preconfirmation open bill needs an explicit migration decision.
 (select count(*) from public.rooms r where r.stage in('scheduling','place') and exists(
  select 1 from public.dutch_pay_bills b where b.room_id=r.id and b.payment_disclosure_closed_at is null
  and (not exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id)
       or exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id and not m.is_completed))
 )) as unconfirmed_rooms_with_open_bill,
 (select count(*) from public.rooms r where r.stage='done' and r.expires_at<=clock_timestamp()
  and to_jsonb(r)->>'appointment_confirmed_at' is not null and exists(
   select 1 from public.dutch_pay_bills b where b.room_id=r.id and b.payment_disclosure_closed_at is null
    and (not exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id)
         or exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id and not m.is_completed))
 )) as expired_owner_confirmed_done_with_open_bill,
 (select count(*) from public.rooms r where not isfinite(r.expires_at)) as rooms_with_nonfinite_expiry
from counts;
rollback;
