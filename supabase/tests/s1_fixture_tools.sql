-- Trusted synthetic fixture helper, session-local only; never installed in public/private.
create function pg_temp.set_health_expiry(u uuid, expiry timestamptz) returns void language plpgsql as $$
declare s public.profile_consent_states%rowtype; e bigint; t timestamptz:=clock_timestamp()-interval '2 years';
 old_sub text:=current_setting('request.jwt.claim.sub',true); old_claims text:=current_setting('request.jwt.claims',true);
begin
 perform 1 from public.profiles where id=u for update;
 select * into s from public.profile_consent_states where profile_id=u and kind='health';
 insert into public.profile_consents(profile_id,kind,version,agreed,agreed_at,document_id,action,source)
 select u,'health',d.version,true,t,d.id,'grant','settings' from public.consent_documents d where d.id=s.document_id returning id into e;
 update public.profile_consent_states set status='granted',latest_event_id=e,granted_event_id=e,granted_at=t,valid_until=greatest(expiry,clock_timestamp()+interval '1 minute') where profile_id=u and kind='health';
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 update public.profile_health_preferences set consent_event_id=e where profile_id=u;
 update public.profile_consent_states set valid_until=expiry where profile_id=u and kind='health';
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
end; $$;
