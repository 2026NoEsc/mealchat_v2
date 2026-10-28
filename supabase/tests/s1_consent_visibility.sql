begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select extensions.no_plan();
\ir s1_fixture.sql
\ir s1_assertions.sql
select * from extensions.finish();
rollback;
