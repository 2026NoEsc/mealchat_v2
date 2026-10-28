-- S3 M4: disabled operational workers. No scheduling, deletion or activation here.
begin;
do $$ begin
 if exists(select 1 from pg_roles where rolname='mealchat_s3_worker') then
  -- Roles survive a database reset. Reuse only the exact unprivileged identity.
  if exists(select 1 from pg_roles where rolname='mealchat_s3_worker' and
   (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls or rolinherit))
   or exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname='mealchat_s3_worker'))
   then raise exception 'S3_WORKER_ROLE_UNSAFE'; end if;
 else
 create role mealchat_s3_worker nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
 end if;
end; $$;
alter role mealchat_s3_worker nologin;
create function private.cleanup_expired_rooms_v1() returns integer language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare r uuid; x public.rooms%rowtype; n integer:=0; failures bigint:=0; last_state text; begin
 if not (select enabled from private.s3_worker_control where singleton) then return 0; end if;
 -- Candidate scan has no row lock. Advisory always precedes FOR UPDATE.
 for r in select id from public.rooms where expires_at<=clock_timestamp() order by expires_at,id limit 100 loop
  begin
  if not pg_try_advisory_xact_lock(hashtextextended(r::text,0)) then continue; end if;
  select * into x from public.rooms where id=r for update;
  if not found or x.expires_at>clock_timestamp() then continue; end if;
  perform private.s3_expire_transfers(r,'room_closed');
  delete from public.rooms where id=r; n:=n+1;
  exception when others then failures:=failures+1; last_state:=sqlstate;
  end;
 end loop;
 if failures>0 then
  insert into private.s3_worker_stats(worker,failure_count,last_failure_at,last_failure_sqlstate)
   values('rooms',failures,clock_timestamp(),last_state)
   on conflict(worker) do update set failure_count=private.s3_worker_stats.failure_count+excluded.failure_count,
    last_failure_at=excluded.last_failure_at,last_failure_sqlstate=excluded.last_failure_sqlstate;
 end if;
 return n;
end; $$;
create function private.expire_owner_transfers_v1() returns integer language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare r uuid; x public.rooms%rowtype; n integer:=0; room_n integer; failures bigint:=0; last_state text; begin
 if not (select enabled from private.s3_worker_control where singleton) then return 0; end if;
 for r in select room_id from private.s3_transfer_requests where status='pending'
  and (expires_at<=clock_timestamp() or from_owner_id is null or target_profile_id is null)
  group by room_id order by room_id limit 100 loop
  begin
  if not pg_try_advisory_xact_lock(hashtextextended(r::text,0)) then continue; end if;
  select * into x from public.rooms where id=r for update;
  if not found or x.expires_at<=clock_timestamp() then continue; end if;
  room_n:=private.s3_expire_transfers(r,'ttl');
  if exists(select 1 from private.s3_transfer_requests where room_id=r and status='pending' and (from_owner_id is null or target_profile_id is null))
   then room_n:=room_n+private.s3_expire_transfers(r,'owner_unavailable'); end if;
  n:=n+room_n;
  exception when others then failures:=failures+1; last_state:=sqlstate;
  end;
 end loop;
 if failures>0 then
  insert into private.s3_worker_stats(worker,failure_count,last_failure_at,last_failure_sqlstate)
   values('transfers',failures,clock_timestamp(),last_state)
   on conflict(worker) do update set failure_count=private.s3_worker_stats.failure_count+excluded.failure_count,
    last_failure_at=excluded.last_failure_at,last_failure_sqlstate=excluded.last_failure_sqlstate;
 end if;
 return n;
end; $$;
create function private.purge_s3_ephemeral_v1() returns integer language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare n integer:=0; count_rows integer; begin
 if not (select enabled from private.s3_worker_control where singleton) then return 0; end if;
 -- No room/advisory lock in this transaction. Never call from a room writer.
 delete from private.s3_invite_previews where expires_at<=clock_timestamp(); get diagnostics count_rows=row_count; n:=n+count_rows;
 delete from private.s3_invite_limits where updated_at<=clock_timestamp()-interval '24 hours' and coalesce(lock_until,'-infinity')<=clock_timestamp(); get diagnostics count_rows=row_count; n:=n+count_rows;
 delete from private.s3_create_tombstones where expires_at<=clock_timestamp(); get diagnostics count_rows=row_count; n:=n+count_rows;
 return n;
end; $$;
create function private.s3_create_tombstone_expiry() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update private.s3_create_tombstones set expires_at=clock_timestamp()+interval '24 hours' where room_id=old.id;
 return old;
end; $$;
create trigger s3_create_tombstone_expiry before delete on public.rooms for each row execute function private.s3_create_tombstone_expiry();
revoke all on function private.cleanup_expired_rooms_v1(),private.expire_owner_transfers_v1(),private.purge_s3_ephemeral_v1(),private.s3_create_tombstone_expiry()
 from public,anon,authenticated,service_role;
grant usage on schema private to mealchat_s3_worker;
grant execute on function private.cleanup_expired_rooms_v1(),private.expire_owner_transfers_v1(),private.purge_s3_ephemeral_v1() to mealchat_s3_worker;
-- Hosted cron connects as postgres. This single definer entry runs with the
-- NOLOGIN worker's schema USAGE + three fixed EXECUTE grants, never arbitrary SQL.
create function private.run_s3_job_v1(job text) returns integer language plpgsql security definer set search_path='' set timezone='UTC' as $$
begin
 case job
  when 'rooms' then return private.cleanup_expired_rooms_v1();
  when 'transfers' then return private.expire_owner_transfers_v1();
  when 'purge' then return private.purge_s3_ephemeral_v1();
  else raise exception 'S3_UNKNOWN_JOB' using errcode='22023';
 end case;
end; $$;
-- CREATEROLE/role ADMIN suffices; no superuser or hosted supabase_admin required.
do $$ begin
 if current_setting('server_version_num')::integer>=160000 then
  execute 'grant mealchat_s3_worker to postgres with inherit false, set true';
 else execute 'grant mealchat_s3_worker to postgres'; end if;
end; $$;
grant create on schema private to mealchat_s3_worker;
alter function private.run_s3_job_v1(text) owner to mealchat_s3_worker;
revoke create on schema private from mealchat_s3_worker;
set local role mealchat_s3_worker;
revoke all on function private.run_s3_job_v1(text) from public,anon,authenticated,service_role;
grant execute on function private.run_s3_job_v1(text) to postgres;
reset role;
do $$ begin
 if current_setting('server_version_num')::integer>=160000 then
  execute 'grant mealchat_s3_worker to postgres with inherit false, set false';
 else execute 'revoke mealchat_s3_worker from postgres'; end if;
end; $$;
commit;
