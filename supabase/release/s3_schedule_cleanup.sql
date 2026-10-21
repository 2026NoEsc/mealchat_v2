-- HELD operational file. Requires exact approval before use outside the isolated DB.
-- Gate stays OFF; successful executions are a prerequisite for activation.
-- Install as postgres through cron.schedule (hosted has no superuser access).
-- The fixed command enters a NOLOGIN worker-owned definer, not arbitrary SQL.
begin;
do $$ begin
 if current_user<>'postgres' then raise exception 'S3_SCHEDULER_POSTGRES_REQUIRED'; end if;
 if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'S3_PG_CRON_REQUIRED'; end if;
 if (select enabled from private.s3_worker_control where singleton) then raise exception 'S3_SCHEDULER_INSTALL_REQUIRES_GATE_OFF'; end if;
 if exists(select 1 from cron.job where jobname in('s3-room-expiry-v1','s3-transfer-expiry-v1','s3-ephemeral-purge-v1')) then raise exception 'S3_SCHEDULER_DUPLICATE_REVIEW_REQUIRED'; end if;
end; $$;
select cron.schedule('s3-room-expiry-v1','* * * * *',$job$select private.run_s3_job_v1('rooms');$job$);
select cron.schedule('s3-transfer-expiry-v1','* * * * *',$job$select private.run_s3_job_v1('transfers');$job$);
select cron.schedule('s3-ephemeral-purge-v1','*/5 * * * *',$job$select private.run_s3_job_v1('purge');$job$);
commit;
