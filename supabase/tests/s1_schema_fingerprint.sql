-- Schema/ACL only; no application values or secrets.
select md5(jsonb_build_object(
 'relations',(select jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relkind,c.relacl,c.relrowsecurity) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')),
 'columns',(select jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attname,a.atttypid,a.attnotnull,a.atthasdef) order by a.attrelid,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and a.attnum>0),
 'functions',(select jsonb_agg(jsonb_build_array(p.oid,pg_get_functiondef(p.oid),p.proacl) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'),
 'constraints',(select jsonb_agg(jsonb_build_array(c.oid,c.conname,pg_get_constraintdef(c.oid)) order by c.oid) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private')),
 'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')),
 'default_acl',(select jsonb_agg(to_jsonb(d) order by d.oid) from pg_default_acl d)
)::text);
