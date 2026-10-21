-- S3 design section 15: read-only, counts only. Run Q0 first; Q3 requires the actual extension schema.
BEGIN TRANSACTION READ ONLY;
SELECT statement_timestamp() AS observed_at,
       current_setting('track_functions') AS track_functions,
       to_regprocedure('public.post_room_system_message(uuid,text)') IS NOT NULL AS r1_exists;
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='rooms'
  AND column_name IN ('stage','created_at','expires_at','settled_at','appointment_confirmed_at')
ORDER BY column_name;
SELECT e.extname, n.nspname AS extension_schema
FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
WHERE e.extname IN ('pg_stat_statements','pg_cron');
SELECT stats_reset FROM pg_stat_database WHERE datname=current_database();
ROLLBACK;

BEGIN TRANSACTION READ ONLY;
WITH observed AS (
  SELECT statement_timestamp() AS at
), room_values AS (
  SELECT r.id, r.code,
         CASE WHEN octet_length(r.code)<=64 AND upper(btrim(r.code)) ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
              THEN upper(btrim(r.code)) END AS normalized_code,
         r.expires_at, r.created_at,
         to_jsonb(r)->>'stage' AS stage,
         (to_jsonb(r)->>'appointment_confirmed_at')::timestamptz AS confirmed_at,
         (to_jsonb(r)->>'settled_at')::timestamptz AS settled_at
  FROM public.rooms r
), code_values AS (
  SELECT v.*, count(*) OVER (PARTITION BY normalized_code) AS normalized_code_count
  FROM room_values v
), anchors AS (
  SELECT v.*, o.at,
    CASE WHEN isfinite(v.created_at) AND v.created_at<=o.at
         THEN v.created_at END AS trusted_created_at,
    CASE WHEN isfinite(v.confirmed_at)
               AND v.confirmed_at BETWEEN v.created_at AND o.at
               AND isfinite(v.created_at)
         THEN v.confirmed_at END AS trusted_confirmed_at,
    CASE WHEN isfinite(v.settled_at) AND v.settled_at<=o.at
               AND v.settled_at>=v.created_at
         THEN v.settled_at END AS trusted_settled_at
  FROM code_values v CROSS JOIN observed o
), caps AS (
  SELECT a.*,
    CASE
      WHEN confirmed_at IS NOT NULL AND trusted_confirmed_at IS NULL THEN NULL
      WHEN trusted_confirmed_at IS NOT NULL THEN trusted_confirmed_at+interval '30 days'
      WHEN trusted_created_at IS NOT NULL THEN trusted_created_at+interval '7 days'
      ELSE NULL
    END AS anchor_cap
  FROM anchors a
), evaluated AS (
  SELECT c.*,
    CASE WHEN anchor_cap IS NULL THEN NULL
         WHEN stage='done' AND trusted_settled_at IS NOT NULL
           THEN least(anchor_cap, trusted_settled_at+interval '24 hours')
         ELSE anchor_cap END AS target_cap,
    EXISTS (
      SELECT 1 FROM public.dutch_pay_bills b
      WHERE b.room_id=c.id AND (
        NOT EXISTS (SELECT 1 FROM public.dutch_pay_members m WHERE m.bill_id=b.id)
        OR EXISTS (SELECT 1 FROM public.dutch_pay_members m
                   WHERE m.bill_id=b.id AND m.is_completed IS NOT TRUE)
      )
    ) AS has_unfinished
  FROM caps c
)
SELECT count(*) AS total_rooms,
       count(*) FILTER (WHERE expires_at<=at) AS already_expired,
       count(*) FILTER (WHERE NOT isfinite(expires_at)) AS nonfinite_expiry,
       count(*) FILTER (WHERE target_cap IS NULL) AS unknown_anchor,
       count(*) FILTER (WHERE stage IN ('settling','done') AND confirmed_at IS NULL)
         AS legacy_settlement_without_confirmation,
       count(*) FILTER (WHERE stage='done' AND trusted_settled_at IS NULL)
         AS done_without_valid_completion_time,
       count(*) FILTER (WHERE target_cap IS NOT NULL AND expires_at>target_cap)
         AS would_shorten,
       count(*) FILTER (WHERE expires_at>at AND target_cap<=at AND expires_at>target_cap)
         AS live_rooms_becoming_expired,
       count(*) FILTER (WHERE has_unfinished AND target_cap IS NOT NULL
                         AND expires_at>target_cap) AS unfinished_rooms_to_shorten,
       count(*) FILTER (WHERE normalized_code IS NULL OR code IS DISTINCT FROM normalized_code)
         AS invalid_code_rooms,
       count(*) FILTER (WHERE normalized_code IS NOT NULL AND normalized_code_count>1)
         AS duplicate_normalized_code_rooms
FROM evaluated;
ROLLBACK;

BEGIN TRANSACTION READ ONLY;
SELECT to_regprocedure('public.post_room_system_message(uuid,text)') IS NOT NULL AS exists,
       has_function_privilege('authenticated',
         to_regprocedure('public.post_room_system_message(uuid,text)'), 'EXECUTE')
         AS authenticated_execute,
       has_function_privilege('anon',
         to_regprocedure('public.post_room_system_message(uuid,text)'), 'EXECUTE')
         AS anon_execute;
SELECT count(*) AS tracked_rows, sum(calls) AS observed_calls
FROM pg_stat_user_functions
WHERE schemaname='public' AND funcname='post_room_system_message';
ROLLBACK;

-- Q3 is a candidate count only. Missing/inaccessible statistics remain UNKNOWN.
BEGIN TRANSACTION READ ONLY;
SELECT coalesce((select n.nspname='extensions' from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_stat_statements'),false) as s3_stats_available \gset
ROLLBACK;
\if :s3_stats_available
BEGIN TRANSACTION READ ONLY;
SELECT kind, count(*) AS statement_shapes, sum(calls) AS observed_calls
FROM (
  SELECT calls,
    CASE
      WHEN query ~* 'post_room_system_message"?[[:space:]]*[(]' THEN 'r1_call_candidate'
      WHEN query ~* 'insert[[:space:]]+into[[:space:]]+("public"[.]|public[.])?"?rooms"?[[:space:](]'
        THEN 'rooms_insert_candidate'
      ELSE NULL
    END AS kind
  FROM extensions.pg_stat_statements
  WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
) s
WHERE kind IS NOT NULL
GROUP BY kind ORDER BY kind;
SELECT n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables WHERE schemaname='public' AND relname='rooms';
ROLLBACK;
\else
SELECT 'UNKNOWN: pg_stat_statements absent or requires verified schema mapping' AS observation;
\endif

BEGIN TRANSACTION READ ONLY;
SELECT has_table_privilege('authenticated','public.rooms','INSERT')
         AS table_insert_grant,
       has_any_column_privilege('authenticated','public.rooms','INSERT')
         AS any_column_insert_grant;
SELECT column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='rooms'
  AND grantee='authenticated' AND privilege_type='INSERT'
ORDER BY column_name;
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE schemaname='public' AND tablename='rooms'
ORDER BY policyname;
ROLLBACK;

