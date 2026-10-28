-- Local-only read-only inventory. Counts and types only; never personal values.
select e.key,jsonb_typeof(e.value) as value_type,count(*) as row_count
from public.profile_private p cross join lateral jsonb_each(case when jsonb_typeof(p.personal_data)='object' then p.personal_data else '{}'::jsonb end) e
 group by e.key,jsonb_typeof(e.value) order by e.key,value_type;
select count(*) filter(where jsonb_typeof(personal_data) is distinct from 'object') as non_object_rows,
 count(*) filter(where personal_data ? 'gender' and (jsonb_typeof(personal_data->'gender')<>'string' or personal_data->>'gender' not in ('male','female','none'))) as invalid_gender_rows,
 count(*) filter(where personal_data ? 'bio' and (jsonb_typeof(personal_data->'bio')<>'string' or char_length(personal_data->>'bio')>120)) as invalid_bio_rows,
 count(*) filter(where birth_date is not null and (birth_date<date '1900-01-01' or birth_date>current_date)) as invalid_birth_date_rows
from public.profile_private;
