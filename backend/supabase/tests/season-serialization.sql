\set ON_ERROR_STOP on
-- A publisher for another round must wait on the same season mutex before
-- approval/publication validation; separate seasons need not share a mutex.
create extension if not exists dblink;
insert into public.observations(id,source,source_revision,fixture_id,observed_at,payload) values('48000000-0000-4000-8000-000000000001','synthetic-lock-proof','1','30000000-0000-4000-8000-000000000001',clock_timestamp(),'{}');
insert into public.statistics_revisions(id,observation_id,fixture_id,statistics) values('48000000-0000-4000-8000-000000000002','48000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','[]');
insert into public.scoring_runs(id,round_id,statistics_revision_id,results,player_scores,complete) values('48000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000010','48000000-0000-4000-8000-000000000002','[]','[]',false);
select dblink_connect('season_holder','dbname='||current_database());
select dblink_connect('season_publisher','dbname='||current_database());
select dblink_exec('season_holder','begin');
select * from dblink('season_holder',$q$select pg_advisory_xact_lock(hashtextextended('publish-season:00000000-0000-4000-8000-000000000001',0))::text$q$) as x(locked text);
select dblink_send_query('season_publisher',$q$select private.publish('48000000-0000-4000-8000-000000000003',null)$q$);
select pg_sleep(0.3);
do $$begin if dblink_is_busy('season_publisher')<>1 then raise exception 'Publisher did not wait on season mutex';end if;end$$;
select dblink_exec('season_holder','commit');
create temp table serialized_result as select result from dblink_get_result('season_publisher') as x(result jsonb);
do $$begin if (select result->'error'->>'code' from serialized_result) is distinct from 'APPROVAL_REQUIRED' then raise exception 'Publisher did not continue after season mutex released';end if;end$$;
select dblink_disconnect('season_holder');
select dblink_disconnect('season_publisher');
-- Immutable synthetic records remain until this isolated test database is removed.
