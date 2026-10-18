begin;
set local s1.tap='off';
\ir s1_fixture.sql
\ir s1_assertions.sql
rollback;
