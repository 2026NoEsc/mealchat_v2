-- HELD: separate, explicitly approved start of destructive cleanup AFTER the
-- activated beta/S4 gate is reviewed. Never included by a base migration.
-- SET mealchat.s3.cleanup_approved_activation to the exact activated_at receipt.
begin;
do $$ declare activation timestamptz; approved timestamptz; begin
 select activated_at into activation from private.s3_worker_control where singleton for update;
 approved:=nullif(current_setting('mealchat.s3.cleanup_approved_activation',true),'')::timestamptz;
 if activation is null or approved is distinct from activation
  or to_regprocedure('public.get_s3_capabilities()') is null then
  raise exception 'S3_CLEANUP_ACTIVATION_APPROVAL_REQUIRED';
 end if;
 if (select enabled from private.s3_worker_control where singleton) then raise exception 'S3_CLEANUP_ALREADY_STARTED'; end if;
 update private.s3_worker_control set enabled=true where singleton;
end; $$;
commit;
