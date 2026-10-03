\set ON_ERROR_STOP on
-- Actual independent PostgreSQL sessions: confirmation starts before deadline,
-- waits on the authoritative entry lock, then must reject after the deadline.
create extension if not exists dblink;
select dblink_connect('holder','dbname='||current_database());
select dblink_connect('confirmer','dbname='||current_database());
select dblink_exec('holder',$q$insert into public.profiles(id) values('49000000-0000-4000-8000-000000000001');insert into public.entries(id,user_id,season_id,display_name) values('49000000-0000-4000-8000-000000000002','49000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Lock proof');insert into public.rounds(id,season_id,number,deadline) values('49000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001',99,clock_timestamp()+interval '2 seconds');$q$);
select dblink_exec('holder','begin');
select * from dblink('holder',$q$select id::text from public.entries where id='49000000-0000-4000-8000-000000000002' for update$q$) as x(id text);
select dblink_send_query('confirmer',$q$with identity as materialized(select set_config('request.jwt.claims','{"sub":"49000000-0000-4000-8000-000000000001","aal":"aal1"}',false)) select public.game_command('confirm_squad','{"requestId":"49000000-0000-4000-8000-000000000004","roundId":"49000000-0000-4000-8000-000000000003","expectedRevision":0,"slots":[]}') from identity$q$);
select pg_sleep(0.2);
do $$begin if dblink_is_busy('confirmer')<>1 then raise exception 'Confirmation did not wait for the entry lock';end if;end$$;
select pg_sleep(3);
select dblink_exec('holder','commit');
create temp table waiting_result as select result from dblink_get_result('confirmer') as x(result jsonb);
do $$begin if (select result->'error'->>'code' from waiting_result) is distinct from 'ROUND_LOCKED' then raise exception 'Waiting confirmation was accepted after deadline';end if;if exists(select 1 from public.squads where round_id='49000000-0000-4000-8000-000000000003') then raise exception 'Waiting confirmation changed squad';end if;end$$;
select dblink_disconnect('holder');
select dblink_disconnect('confirmer');
delete from private.requests where user_id='49000000-0000-4000-8000-000000000001';
delete from private.audits where actor_id='49000000-0000-4000-8000-000000000001';
delete from public.entries where id='49000000-0000-4000-8000-000000000002';
delete from public.profiles where id='49000000-0000-4000-8000-000000000001';
delete from public.rounds where id='49000000-0000-4000-8000-000000000003';
