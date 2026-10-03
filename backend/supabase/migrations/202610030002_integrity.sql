begin;
-- Additive integrity upgrade: bind all scoring inputs, durable token-level outbox.
alter table public.fixtures add column expected_player_ids jsonb;
create table private.provider_fixture_mappings(provider text not null,fixture_id uuid not null references public.fixtures,provider_fixture_id text not null,approved boolean not null default false,primary key(provider,fixture_id),unique(provider,provider_fixture_id));
create table private.deadline_authorizations(id uuid primary key default gen_random_uuid(),round_id uuid not null references public.rounds,new_deadline timestamptz not null,reason text not null,authorized_by text not null,consumed_at timestamptz);
alter table public.scoring_runs add column input_manifest jsonb not null default '{}';
alter table public.run_approvals add column input_manifest jsonb not null default '{}';
create table private.push_deliveries(id uuid primary key default gen_random_uuid(),notification_id uuid not null references public.notifications on delete cascade,token text not null,status text not null default 'pending' check(status in ('pending','accepted','delivered','invalid','retry')),ticket_id text,attempts integer not null default 0,next_attempt_at timestamptz not null default clock_timestamp(),unique(notification_id,token));
create index push_deliveries_due_idx on private.push_deliveries(next_attempt_at,id) where status in ('pending','accepted','retry');
create table private.worker_heartbeats(worker_id text primary key,last_seen_at timestamptz not null);
create function private.round_manifest(round uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('rulesVersion','2027-v1','rulesHash',md5(coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'position',p.position,'priceTenths',p.price_tenths,'eligible',p.eligible,'nationId',p.nation_id) order by p.id)::text from public.players p join public.rounds r on r.season_id=p.season_id where r.id=round),'[]')),'fixtures',(select coalesce(jsonb_agg(jsonb_build_object('fixtureId',f.id,'statisticsRevisionId',s.id,'overrideActive',coalesce(s.override_active,false),'expectedPlayerIds',f.expected_player_ids,'disposition',f.disposition,'dispositionApproved',f.disposition_approved) order by f.id),'[]') from public.fixtures f left join lateral(select * from public.statistics_revisions where fixture_id=f.id order by override_active desc,created_at desc,id desc limit 1) s on true where f.round_id=round),'squads',(select coalesce(jsonb_agg(jsonb_build_object('entryId',e.id,'selectionHash',md5(coalesce(s.selection::text,'null')),'locked',s.locked_at is not null) order by e.id),'[]') from public.entries e join public.rounds r on r.season_id=e.season_id left join public.squads s on s.entry_id=e.id and s.round_id=r.id where r.id=round))
$$;
create function private.coverage_error(round uuid,manifest jsonb,scores jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare f public.fixtures;rev public.statistics_revisions;pid text;metric text;stat jsonb;metric_names text[]:=array['tries','tryAssists','conversions','penaltyKicks','dropGoals','metresCarried','cleanBreaks','defendersBeaten','turnoversWon','tackles','missedTackles','yellowCards','redCards','lineoutSteals','scrumPenaltiesWon','penaltiesConceded'];
begin
 if jsonb_array_length(manifest->'fixtures')=0 or manifest<>private.round_manifest(round) then return private.fail('DATA_INCOMPLETE','Input manifest changed or fixture coverage absent');end if;
 for f in select * from public.fixtures where round_id=round loop
 if f.disposition='cancelled' and f.disposition_approved then continue;end if;
 if jsonb_typeof(f.expected_player_ids) is distinct from 'array' or jsonb_array_length(f.expected_player_ids)=0 then return private.fail('DATA_INCOMPLETE','Approved fixture player coverage required',jsonb_build_object('fixtureId',f.id));end if;
 select * into rev from public.statistics_revisions where id=(select (x->>'statisticsRevisionId')::uuid from jsonb_array_elements(manifest->'fixtures') x where x->>'fixtureId'=f.id::text);
 if not found then return private.fail('DATA_INCOMPLETE','Entire fixture statistics missing');end if;
 if (select count(*) from jsonb_array_elements(rev.statistics))<>(select count(distinct x->>'playerId') from jsonb_array_elements(rev.statistics)x) then return private.fail('DATA_INCOMPLETE','Duplicate player fixture rows');end if;
 for pid in select jsonb_array_elements_text(f.expected_player_ids) loop
 select x into stat from jsonb_array_elements(rev.statistics)x where x->>'playerId'=pid and x->>'fixtureId'=f.id::text;
 if stat is null or jsonb_typeof(stat->'participated') is distinct from 'boolean' or (stat->>'participated'='true' and jsonb_typeof(stat->'started') is distinct from 'boolean') then return private.fail('DATA_INCOMPLETE','Player participation missing');end if;
 foreach metric in array metric_names loop if stat->>'participated'='true' and (metric not in ('lineoutSteals','scrumPenaltiesWon','penaltiesConceded') or exists(select 1 from public.players where id=pid::uuid and position in ('prop','hooker','lock','back_row'))) and stat->'metrics'->>metric is null then return private.fail('DATA_INCOMPLETE','Player metric missing',jsonb_build_object('fixtureId',f.id,'playerId',pid,'metric',metric));end if;end loop;
 if not exists(select 1 from jsonb_array_elements(scores)x where x->>'fixtureId'=f.id::text and x->>'playerId'=pid and x->>'scoreHundredths' is not null and jsonb_array_length(coalesce(x->'missingMetrics','[]'))=0) then return private.fail('DATA_INCOMPLETE','Scored player row missing');end if;
 end loop;
 -- Every selected starter/reserve whose nation appears must have explicit participation, never implicit absence.
 if exists(select 1 from public.squads q cross join lateral jsonb_array_elements(q.selection->'slots') sl join public.players p on p.id=(sl->>'playerId')::uuid where q.round_id=round and p.nation_id in(select pp.nation_id from public.players pp where pp.id::text in(select jsonb_array_elements_text(f.expected_player_ids))) and not exists(select 1 from jsonb_array_elements(rev.statistics)x where x->>'playerId'=p.id::text and x->>'fixtureId'=f.id::text)) then return private.fail('DATA_INCOMPLETE','Selected player participation missing');end if;
 end loop;
 return null;
end$$;
create or replace function public.worker_stage_run(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.scheduled_jobs;rid uuid;outcome jsonb;manifest jsonb:=p_input->'inputManifest';round uuid:=(p_input->>'roundId')::uuid;
begin j:=private.fence(p_input);
 if manifest is null then return private.fail('DATA_INCOMPLETE','Exact input manifest required');end if;
 perform 1 from public.rounds where id=round for update;
 if not exists(select 1 from public.statistics_revisions s join public.fixtures f on f.id=s.fixture_id where s.id=(p_input->>'statisticsRevisionId')::uuid and f.round_id=round) then return private.fail('DATA_INCOMPLETE','Anchor revision does not belong to round');end if;
 outcome:=private.coverage_error(round,manifest,p_input->'playerScores');if outcome is not null then return outcome;end if;
 if coalesce((p_input->>'complete')::boolean,false)=false then return private.fail('DATA_INCOMPLETE','Complete run required');end if;
 insert into public.scoring_runs(round_id,statistics_revision_id,results,player_scores,complete,input_manifest) values(round,(p_input->>'statisticsRevisionId')::uuid,p_input->'results',p_input->'playerScores',true,manifest) returning id into rid;return private.ok(jsonb_build_object('runId',rid));exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;

create function private.cancelled_evidence(fixture uuid) returns void language plpgsql set search_path='' as $$declare oid uuid;stats jsonb;begin
 select jsonb_agg(jsonb_build_object('fixtureId',f.id,'playerId',p.id,'position',p.position,'participated',false,'started',null,'metrics','{}'::jsonb) order by p.id) into stats from public.fixtures f join public.rounds r on r.id=f.round_id join public.players p on p.season_id=r.season_id where f.id=fixture;
 insert into public.observations(source,source_revision,fixture_id,observed_at,payload) values('approved-disposition','cancelled-v1',fixture,clock_timestamp(),jsonb_build_object('statistics',coalesce(stats,'[]'::jsonb),'provenance',jsonb_build_object('approvedDisposition','cancelled'))) on conflict do nothing;
 select id into oid from public.observations where source='approved-disposition' and source_revision='cancelled-v1' and fixture_id=fixture;
 insert into public.statistics_revisions(observation_id,fixture_id,statistics,override_active) values(oid,fixture,coalesce(stats,'[]'),true) on conflict do nothing;
 end$$;
create or replace function private.command(operation text,input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; rid uuid; eid uuid; lid uuid; entity uuid; r public.rounds; s public.squads; l public.leagues; selection jsonb; outcome jsonb; now_at timestamptz; fresh boolean; run public.scoring_runs;
begin
 if uid is null then return private.fail('UNAUTHENTICATED','Authentication required'); end if;
 if operation in ('preview_import','commit_import','approve_run','publish_run','correct_run','schedule_job','fixture_disposition','publish_deadline','release_override') and not private.is_admin() then return private.fail('FORBIDDEN','Administrator MFA required'); end if;
 if operation in ('request_export','request_delete') then
 select exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]')) a where a->>'method'<>'token_refresh' and (a->>'timestamp')::numeric >= extract(epoch from clock_timestamp())-300) into fresh;
 if not fresh then return private.fail('FORBIDDEN','Fresh authentication required'); end if; end if;
 if operation='enter_season' then
 sid:=(input->>'seasonId')::uuid; if not exists(select 1 from public.rounds where season_id=sid and deadline>clock_timestamp()) then return private.fail('ROUND_LOCKED','Season entry closed'); end if;
 insert into public.profiles(id) values(uid) on conflict do nothing;
 insert into public.entries(user_id,season_id,display_name) select uid,sid,display_name from public.profiles where id=uid on conflict(user_id,season_id) do nothing;
 select id into eid from public.entries where user_id=uid and season_id=sid; return private.ok(jsonb_build_object('entryId',eid));
 elsif operation='confirm_squad' then
 rid:=(input->>'roundId')::uuid;
 select * into r from public.rounds where id=rid; if not found then return private.fail('NOT_FOUND','Round not found'); end if;
 select id into eid from public.entries where user_id=uid and season_id=r.season_id for update;
 if eid is null then return private.fail('FORBIDDEN','Season entry required'); end if;
 select * into s from public.squads where entry_id=eid and round_id=rid for update;
 now_at:=clock_timestamp(); if now_at>=r.deadline or r.locked_at is not null then return private.fail('ROUND_LOCKED','Round deadline passed'); end if;
 if coalesce(s.revision,0)<>(input->>'expectedRevision')::integer then return private.fail('REVISION_CONFLICT','Squad revision changed'); end if;
 selection:=jsonb_build_object('slots',input->'slots','captainId',input->'captainId','viceCaptainId',input->'viceCaptainId'); outcome:=private.selection_error(r.season_id,selection); if outcome is not null then return outcome; end if;
 insert into public.squads(entry_id,round_id,revision,selection,provenance) values(eid,rid,1,selection,'confirmed') on conflict(entry_id,round_id) do update set revision=public.squads.revision+1,selection=excluded.selection,provenance='confirmed',confirmed_at=now_at returning * into s;
 return private.ok(jsonb_build_object('id',s.id,'entryId',eid,'roundId',rid,'revision',s.revision,'selection',selection,'deadline',r.deadline,'serverTime',now_at,'locked',false,'provenance','confirmed'));
 elsif operation='create_league' then
 sid:=(input->>'seasonId')::uuid; select id into eid from public.entries where user_id=uid and season_id=sid; if eid is null then return private.fail('FORBIDDEN','Season entry required'); end if;
 insert into public.leagues(season_id,name,owner_id,invite_code) values(sid,input->>'name',uid,upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))) returning id into lid;
 insert into public.memberships values(lid,eid); return private.ok(jsonb_build_object('leagueId',lid));
 elsif operation='join_league' then
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0)); if (select count(*) from private.invite_attempts where user_id=uid and attempted_at>clock_timestamp()-interval '1 minute')>=10 then return private.fail('RATE_LIMITED','Invite attempt limit reached'); end if;
 insert into private.invite_attempts(user_id) values(uid);
 select * into l from public.leagues where invite_code=upper(input->>'inviteCode') and not archived for update; if not found then return private.fail('INVALID_INVITE','Invite invalid'); end if;
 select id into eid from public.entries where user_id=uid and season_id=l.season_id; if eid is null then return private.fail('FORBIDDEN','Season entry required'); end if;
 insert into public.memberships values(l.id,eid) on conflict do nothing; return private.ok(jsonb_build_object('leagueId',l.id));
 elsif operation in ('leave_league','rotate_invite','remove_member','transfer_league','archive_league') then
 lid:=(input->>'leagueId')::uuid; select * into l from public.leagues where id=lid for update; if not found then return private.fail('NOT_FOUND','League not found'); end if;
 if operation='leave_league' then if l.owner_id=uid and not l.archived then return private.fail('OWNER_TRANSFER_REQUIRED','Transfer ownership before leaving'); end if; delete from public.memberships m using public.entries e where m.league_id=lid and m.entry_id=e.id and e.user_id=uid;
 else
 if l.owner_id<>uid then return private.fail('FORBIDDEN','League owner required'); end if;
 if operation='rotate_invite' then update public.leagues set invite_code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)) where id=lid;
 elsif operation='archive_league' then update public.leagues set archived=true where id=lid;
 elsif operation='remove_member' then select id into eid from public.entries where user_id=(input->>'userId')::uuid and season_id=l.season_id; if exists(select 1 from public.entries where id=eid and user_id=uid) then return private.fail('OWNER_TRANSFER_REQUIRED','Cannot remove owner'); end if; delete from public.memberships where league_id=lid and entry_id=eid;
 elsif operation='transfer_league' then select e.user_id into entity from public.entries e join public.memberships m on m.entry_id=e.id where m.league_id=lid and e.user_id=(input->>'userId')::uuid; if entity is null then return private.fail('NOT_FOUND','New owner must be a current member'); end if; update public.leagues set owner_id=entity where id=lid; end if; end if;
 return private.ok(jsonb_build_object('leagueId',lid));
 elsif operation='update_profile' then
 insert into public.profiles(id,display_name,reminders) values(uid,coalesce(input->>'displayName','Player'),coalesce((input->>'reminders')::boolean,true)) on conflict(id) do update set display_name=coalesce(input->>'displayName',public.profiles.display_name),reminders=coalesce((input->>'reminders')::boolean,public.profiles.reminders);
 update public.entries set display_name=(select display_name from public.profiles where id=uid) where user_id=uid; return private.ok(jsonb_build_object('updated',true));
 elsif operation='register_push' then insert into private.push_tokens(user_id,token) values(uid,input->>'token') on conflict(token) do update set user_id=uid; return private.ok(jsonb_build_object('registered',true));
 elsif operation='detach_push' then delete from private.push_tokens where user_id=uid and token=input->>'token'; return private.ok(jsonb_build_object('detached',true));
 elsif operation='mark_notification_read' then update public.notifications set read_at=clock_timestamp() where id=(input->>'notificationId')::uuid and user_id=uid; return private.ok(jsonb_build_object('updated',true));
 elsif operation in ('request_export','request_delete') then insert into public.account_operations(user_id,kind) values(uid,operation) returning id into entity; insert into public.scheduled_jobs(kind,payload,due_at,dedupe_key) values(case operation when 'request_export' then 'export_account' else 'delete_account' end,jsonb_build_object('operationId',entity,'userId',uid),clock_timestamp(),entity::text); return private.ok(jsonb_build_object('operationId',entity));
 elsif operation='preview_import' then
 if jsonb_typeof(input->'observation'->'statistics')<>'array' or not exists(select 1 from public.fixtures where id=(input->'observation'->>'fixtureId')::uuid) then return private.fail('VALIDATION_ERROR','Normalized observation required'); end if;
 insert into public.import_batches(actor_id,payload,report) values(uid,input->'observation',jsonb_build_object('valid',true,'source',input->'observation'->>'source','rows',jsonb_array_length(input->'observation'->'statistics'))) returning id into entity; return private.ok(jsonb_build_object('previewId',entity,'valid',true));
 elsif operation='commit_import' then
 select id into entity from public.import_batches where id=(input->>'previewId')::uuid and actor_id=uid and committed_at is null for update; if entity is null then return private.fail('NOT_FOUND','Uncommitted preview required'); end if;
 update public.import_batches set committed_at=clock_timestamp() where id=entity; insert into public.scheduled_jobs(kind,payload,due_at,dedupe_key) select 'ingest_import',jsonb_build_object('observation',payload),clock_timestamp(),entity::text from public.import_batches where id=entity; return private.ok(jsonb_build_object('importId',entity));
 elsif operation='approve_run' then select * into run from public.scoring_runs where id=(input->>'runId')::uuid; if not found or not run.complete or run.input_manifest<>private.round_manifest(run.round_id) then return private.fail('DATA_INCOMPLETE','Complete run required'); end if; insert into public.run_approvals(run_id,statistics_revision_id,actor_id,reason,input_manifest) values(run.id,run.statistics_revision_id,uid,input->>'reason',run.input_manifest) returning id into entity; return private.ok(jsonb_build_object('approvalId',entity));
 elsif operation in ('publish_run','correct_run') then return private.publish((input->>'runId')::uuid,(select id from public.run_approvals where run_id=(input->>'runId')::uuid order by created_at desc limit 1));
 elsif operation='schedule_job' then insert into public.scheduled_jobs(kind,payload,due_at,max_attempts,dedupe_key) values(input->>'kind',coalesce(input->'payload','{}'),(input->>'runAt')::timestamptz,coalesce((input->>'maxAttempts')::integer,1),input->>'idempotencyKey') on conflict(dedupe_key) do nothing returning id into entity; if entity is null then select id into entity from public.scheduled_jobs where dedupe_key=input->>'idempotencyKey' and kind=input->>'kind' and payload=coalesce(input->'payload','{}') and due_at=(input->>'runAt')::timestamptz and max_attempts=(input->>'maxAttempts')::integer; if entity is null then return private.fail('IDEMPOTENCY_CONFLICT','Job key reused with different input');end if;end if; return private.ok(jsonb_build_object('jobId',entity));
 elsif operation='fixture_disposition' then update public.fixtures set disposition=input->>'disposition',disposition_approved=true where id=(input->>'fixtureId')::uuid; if input->>'disposition'='cancelled' then perform private.cancelled_evidence((input->>'fixtureId')::uuid);end if; return private.ok(jsonb_build_object('updated',true));
 elsif operation='publish_deadline' then
 if exists(select 1 from public.rounds where id=(input->>'roundId')::uuid and deadline<>(input->>'deadline')::timestamptz) then select id into entity from private.deadline_authorizations where round_id=(input->>'roundId')::uuid and new_deadline=(input->>'deadline')::timestamptz and consumed_at is null for update; if entity is null then return private.fail('APPROVAL_REQUIRED','Published deadline changes require server-recorded CTO authorization');end if;update private.deadline_authorizations set consumed_at=clock_timestamp() where id=entity;end if;
 update public.rounds set deadline=(input->>'deadline')::timestamptz where id=(input->>'roundId')::uuid and locked_at is null; return private.ok(jsonb_build_object('updated',true));
 elsif operation='release_override' then update public.statistics_revisions set override_active=false where id=(input->>'statisticsRevisionId')::uuid; return private.ok(jsonb_build_object('released',true));
 end if;
 return private.fail('VALIDATION_ERROR','Unsupported operation');
end$$;
create or replace function public.game_command(p_operation text,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); existing private.requests; outcome jsonb;
begin
 if uid is null then return private.fail('UNAUTHENTICATED','Authentication required'); end if;
 if p_operation in ('preview_import','commit_import','approve_run','publish_run','correct_run','schedule_job','fixture_disposition','publish_deadline','release_override') and not private.is_admin() then return private.fail('FORBIDDEN','Administrator MFA required'); end if;
 if p_operation in ('rotate_invite','remove_member','transfer_league','archive_league') and not exists(select 1 from public.leagues where id=(p_input->>'leagueId')::uuid and owner_id=uid) then return private.fail('FORBIDDEN','Current league owner required');end if;
 if p_operation in ('request_export','request_delete') and not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]')) a where a->>'method'<>'token_refresh' and (a->>'timestamp')::numeric>=extract(epoch from clock_timestamp())-300) then return private.fail('FORBIDDEN','Fresh authentication required');end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_operation||(p_input->>'requestId'),0));
 select * into existing from private.requests where user_id=uid and operation=p_operation and request_id=(p_input->>'requestId')::uuid;
 if found then if existing.input<>p_input then return private.fail('IDEMPOTENCY_CONFLICT','Request ID reused with different input'); end if; return existing.outcome; end if;
 outcome:=private.command(p_operation,p_input);
 insert into private.requests values(uid,p_operation,(p_input->>'requestId')::uuid,p_input,outcome);
 insert into private.audits(actor_id,operation,input) values(uid,p_operation,p_input-'token'); return outcome;
exception when invalid_text_representation or not_null_violation or check_violation or foreign_key_violation then return private.fail('VALIDATION_ERROR','Invalid command input');
end$$;
create or replace function private.publish(run_id uuid,approval_id uuid) returns jsonb language plpgsql set search_path='' as $$
declare run public.scoring_runs; approval public.run_approvals; rnd public.rounds; vid uuid;old_version uuid;outcome jsonb;previous_standings uuid;
begin
 select * into run from public.scoring_runs where id=run_id;if not found then return private.fail('NOT_FOUND','Run not found');end if;
 perform pg_advisory_xact_lock(hashtextextended('publish-season:'||(select season_id::text from public.rounds where id=run.round_id),0));select * into rnd from public.rounds where id=run.round_id for update;
 select * into approval from public.run_approvals where id=approval_id and run_approvals.run_id=run.id and statistics_revision_id=run.statistics_revision_id;
 if not found or approval.input_manifest<>run.input_manifest then return private.fail('APPROVAL_REQUIRED','Approval must bind exact run and manifest');end if;outcome:=private.coverage_error(run.round_id,run.input_manifest,run.player_scores);if outcome is not null then return outcome;end if;
 if not run.complete or rnd.locked_at is null or exists(select 1 from jsonb_array_elements(run.player_scores) x where x->>'scoreHundredths' is null or jsonb_array_length(coalesce(x->'missingMetrics','[]'))>0) then return private.fail('DATA_INCOMPLETE','Run metrics or snapshots incomplete');end if;
 if not exists(select 1 from public.fixtures where round_id=rnd.id) or exists(select 1 from public.fixtures where round_id=rnd.id and not ((status='final' and full_time is not null and full_time+interval '120 minutes'<=clock_timestamp()) or (disposition in ('cancelled','abandoned','awarded') and disposition_approved))) then return private.fail('DATA_INCOMPLETE','Unresolved fixtures or verification window');end if;
 if exists(select 1 from public.entries e where e.season_id=rnd.season_id and not exists(select 1 from jsonb_array_elements(run.results) x where x->>'entryId'=e.id::text)) or (select count(*) from jsonb_array_elements(run.results))<>(select count(distinct x->>'entryId') from jsonb_array_elements(run.results) x) then return private.fail('DATA_INCOMPLETE','Every entry must have one result');end if;
 if exists(select 1 from jsonb_array_elements(run.results) x left join public.entries e on e.id=(x->>'entryId')::uuid and e.season_id=rnd.season_id where e.id is null) then return private.fail('DATA_INCOMPLETE','Results include invalid entries');end if;
 if exists(select 1 from public.statistics_revisions s where s.fixture_id=(select fixture_id from public.statistics_revisions where id=run.statistics_revision_id) and s.created_at>(select created_at from public.statistics_revisions where id=run.statistics_revision_id) and not exists(select 1 from public.statistics_revisions o where o.fixture_id=s.fixture_id and o.override_active and o.id=run.statistics_revision_id)) then return private.fail('DATA_INCOMPLETE','Scoring input revision superseded');end if;
 select id into vid from public.publications where publications.run_id=run.id and publications.approval_id=approval.id; if found then return private.ok(jsonb_build_object('versionId',vid));end if;
 select p.id into previous_standings from public.publications p join public.rounds r on r.id=p.round_id where r.season_id=rnd.season_id order by p.created_at desc,p.id desc limit 1;old_version:=rnd.active_version_id;insert into public.publications(round_id,run_id,approval_id,replaces_id) values(rnd.id,run.id,approval.id,old_version) returning id into vid;
 -- Build a complete cumulative snapshot using each round's approved active result.
 with active_results as(select x from public.rounds r join public.publications p on p.id=r.active_version_id join public.scoring_runs s on s.id=p.run_id cross join lateral jsonb_array_elements(s.results) x where r.season_id=rnd.season_id and r.id<>rnd.id union all select x from jsonb_array_elements(run.results) x), totals as(select e.id,e.registered_at,coalesce(sum((x->>'scoreHundredths')::bigint),0) score,coalesce(sum((x->>'captainBonusHundredths')::bigint),0) bonus,coalesce(sum((x->>'contributingTries')::bigint),0) tries from public.entries e left join active_results on x->>'entryId'=e.id::text where e.season_id=rnd.season_id group by e.id,e.registered_at)
 insert into public.rankings select vid,id,score,bonus,tries,rank() over(order by score desc,bonus desc,tries desc,registered_at)::integer from totals;
 update public.rounds set active_version_id=vid where id=rnd.id;
 insert into public.notifications(user_id,payload,unique_key) select user_id,jsonb_build_object('kind',case when old_version is null then 'official' else 'correction' end,'versionId',vid,'roundId',rnd.id),vid::text||':'||id::text from public.entries where season_id=rnd.season_id and user_id is not null;
 insert into private.push_deliveries(notification_id,token) select n.id,t.token from public.notifications n join private.push_tokens t on t.user_id=n.user_id join public.entries e on e.user_id=n.user_id and e.season_id=rnd.season_id join public.rankings current on current.version_id=vid and current.entry_id=e.id left join public.rankings previous on previous.version_id=previous_standings and previous.entry_id=e.id where n.payload->>'versionId'=vid::text and (old_version is null or current.score_hundredths is distinct from previous.score_hundredths or exists(select 1 from public.memberships m where m.entry_id=e.id and (select count(*) from public.rankings rk join public.memberships lm on lm.entry_id=rk.entry_id and lm.league_id=m.league_id where rk.version_id=vid and rk.rank<current.rank) is distinct from (select count(*) from public.rankings rk join public.memberships lm on lm.entry_id=rk.entry_id and lm.league_id=m.league_id where rk.version_id=previous_standings and rk.rank<previous.rank)));insert into public.scheduled_jobs(kind,payload,due_at,dedupe_key) values('notify',jsonb_build_object('versionId',vid),clock_timestamp(),'notify:'||vid::text);
 return private.ok(jsonb_build_object('versionId',vid));end$$;
create or replace function public.game_read(p_operation text,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); value jsonb; r public.rounds; ownentry public.entries; s public.squads; league_record public.leagues; version uuid; own integer; lim integer:=least(100,greatest(1,coalesce((p_input->>'limit')::integer,50)));
begin
 if uid is null then return private.fail('UNAUTHENTICATED','Authentication required'); end if;
 if p_operation='seasons' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'entryOpen',exists(select 1 from public.rounds where season_id=seasons.id and deadline>clock_timestamp())) order by year),'[]') into value from public.seasons;
 elsif p_operation='rounds' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'seasonId',season_id,'number',number,'deadline',deadline,'status',case when locked_at is null then 'open' else 'locked' end) order by number),'[]') into value from public.rounds where season_id=(p_input->>'seasonId')::uuid;
 elsif p_operation='players' then select jsonb_build_object('items',coalesce(jsonb_agg(v),'[]'),'nextCursor',case when count(*)=lim then max(v->>'id') end) into value from (select jsonb_build_object('id',id,'seasonId',season_id,'nationId',nation_id,'name',name,'position',position,'priceTenths',price_tenths,'eligible',eligible) v from public.players where season_id=(p_input->>'seasonId')::uuid and (p_input->>'position' is null or position=p_input->>'position') and (p_input->>'nationId' is null or nation_id=(p_input->>'nationId')::uuid) and (p_input->>'search' is null or name ilike '%'||(p_input->>'search')||'%') and (p_input->>'cursor' is null or id>(p_input->>'cursor')::uuid) order by id limit lim) t;
 elsif p_operation='squad' then
 select * into r from public.rounds where id=(p_input->>'roundId')::uuid; if not found then return private.fail('NOT_FOUND','Round not found'); end if;
 select * into ownentry from public.entries where season_id=r.season_id and ((p_input->>'entryId' is null and user_id=uid) or id=(p_input->>'entryId')::uuid); if not found then return private.fail('NOT_FOUND','Entry not found'); end if;
 select * into s from public.squads where entry_id=ownentry.id and round_id=r.id; if ownentry.user_id is distinct from uid and (s.locked_at is null or not private.can_view_squad(ownentry.id,s.locked_at)) then return private.fail('FORBIDDEN','Locked snapshot membership required');end if;
 value:=jsonb_build_object('id',s.id,'entryId',ownentry.id,'roundId',r.id,'revision',coalesce(s.revision,0),'selection',s.selection,'deadline',r.deadline,'serverTime',clock_timestamp(),'locked',r.deadline<=clock_timestamp(),'provenance',s.provenance);
 elsif p_operation='leagues' then select jsonb_build_object('items',coalesce(jsonb_agg(v),'[]'),'nextCursor',case when count(*)=lim then max(v->>'id') end) into value from (select private.league_json(l) v from public.leagues l join public.memberships m on m.league_id=l.id join public.entries e on e.id=m.entry_id where e.user_id=uid and l.season_id=(p_input->>'seasonId')::uuid and (p_input->>'cursor' is null or l.id>(p_input->>'cursor')::uuid) order by l.id limit lim) t;
 elsif p_operation='league' then
 select l2.* into league_record from public.leagues l2 join public.memberships m on m.league_id=l2.id join public.entries e on e.id=m.entry_id where l2.id=(p_input->>'leagueId')::uuid and e.user_id=uid;
 if not found then return private.fail('FORBIDDEN','League membership required'); end if;
 select jsonb_build_object('league',private.league_json(league_record),'members',coalesce(jsonb_agg(jsonb_build_object('userId',e.user_id,'displayName',e.display_name)),'[]')) into value from public.memberships m join public.entries e on e.id=m.entry_id where m.league_id=league_record.id;
 elsif p_operation='standings' then
 if p_input->>'leagueId' is not null and not exists(select 1 from public.memberships m join public.entries e on e.id=m.entry_id where m.league_id=(p_input->>'leagueId')::uuid and e.user_id=uid) then return private.fail('FORBIDDEN','League membership required');end if;
 select p.id into version from public.publications p join public.rounds r on r.id=p.round_id where r.season_id=(p_input->>'seasonId')::uuid order by p.created_at desc,p.id desc limit 1;
 with ranked as(select e.id,e.user_id,e.display_name,e.registered_at,rk.score_hundredths,rk.captain_bonus_hundredths,rk.contributing_tries,rank() over(order by rk.score_hundredths desc,rk.captain_bonus_hundredths desc,rk.contributing_tries desc,e.registered_at)::integer ranking from public.rankings rk join public.entries e on e.id=rk.entry_id where rk.version_id=version and (p_input->>'leagueId' is null or exists(select 1 from public.memberships m where m.league_id=(p_input->>'leagueId')::uuid and m.entry_id=e.id))), page_rows as(select * from ranked where p_input->>'cursor' is null or (ranking,id)>((split_part(p_input->>'cursor',':',1))::integer,(split_part(p_input->>'cursor',':',2))::uuid) order by ranking,id limit lim)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('entryId',id,'displayName',display_name,'rank',ranking,'scoreHundredths',score_hundredths,'captainBonusHundredths',captain_bonus_hundredths,'contributingTries',contributing_tries,'registeredAt',registered_at) order by ranking,id) from page_rows),'[]'),'nextCursor',case when (select count(*) from page_rows)=lim then (select ranking::text||':'||id::text from page_rows order by ranking desc,id desc limit 1) end,'versionId',version,'ownRank',(select ranking from ranked where user_id=uid),'status',case when version is null then 'unpublished' else 'official' end) into value;
 elsif p_operation='match' then
 select jsonb_build_object('fixtureId',f.id,'status',f.status,'snapshot',o.payload,'coverage',jsonb_build_object('complete',false),'observedAt',o.observed_at,'versionId',r.active_version_id) into value from public.fixtures f join public.rounds r on r.id=f.round_id left join lateral(select * from public.observations where fixture_id=f.id order by observed_at desc limit 1) o on true where f.id=(p_input->>'fixtureId')::uuid;
 elsif p_operation='profile' then select jsonb_build_object('id',id,'displayName',display_name,'reminders',reminders) into value from public.profiles where id=uid;
 elsif p_operation='notifications' then select jsonb_build_object('items',coalesce(jsonb_agg(v order by v->>'id'),'[]'),'nextCursor',case when count(*)=lim then max(v->>'id') end) into value from (select jsonb_build_object('id',id,'kind',coalesce(payload->>'kind','notice'),'payload',payload,'readAt',read_at,'createdAt',created_at) v from public.notifications where user_id=uid and (p_input->>'cursor' is null or id>(p_input->>'cursor')::uuid) order by id limit lim) t;
 elsif p_operation='operation' then select jsonb_build_object('id',id,'kind',kind,'status',status,'result',result) into value from public.account_operations where id=(p_input->>'operationId')::uuid and user_id=uid;
 elsif p_operation='admin_state' then if not private.is_admin() then return private.fail('FORBIDDEN','Administrator MFA required'); end if; value:=jsonb_build_object('jobs',(select coalesce(jsonb_agg(to_jsonb(j)),'[]') from (select * from public.scheduled_jobs order by due_at desc limit 100) j),'imports',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from (select * from public.import_batches order by id desc limit 100) i),'runs',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select * from public.scoring_runs order by created_at desc limit 100) r),'coverage','[]'::jsonb);
 else return private.fail('VALIDATION_ERROR','Unsupported operation'); end if;
 if value is null then return private.fail('NOT_FOUND','Resource not found'); end if; return private.ok(value);
exception when invalid_text_representation then return private.fail('VALIDATION_ERROR','Invalid query input'); end$$;
alter table private.push_deliveries add column job_id uuid references public.scheduled_jobs;
alter table private.push_deliveries add column lease_token uuid;
alter table private.push_deliveries add column lease_expires_at timestamptz;
create or replace function public.worker_job_context(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.scheduled_jobs;rid uuid;revision uuid;value jsonb;manifest jsonb;requests jsonb;failed_at timestamptz;
begin j:=private.fence(p_input);rid:=(j.payload->>'roundId')::uuid;
 if j.kind='score_round' then
 manifest:=private.round_manifest(rid);
 select (x->>'statisticsRevisionId')::uuid into revision from jsonb_array_elements(manifest->'fixtures')x where x->>'statisticsRevisionId' is not null order by x->>'fixtureId' limit 1;
 value:=jsonb_build_object('roundId',rid,'statisticsRevisionId',revision,'inputManifest',manifest,'mode','official','statistics',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(manifest->'fixtures')m join public.statistics_revisions s on s.id=(m->>'statisticsRevisionId')::uuid cross join lateral jsonb_array_elements(s.statistics)x),'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'seasonId',p.season_id,'nationId',p.nation_id,'name',p.name,'position',p.position,'priceTenths',p.price_tenths,'eligible',p.eligible)),'[]') from public.players p join public.rounds r on r.season_id=p.season_id where r.id=rid),'entries',(select coalesce(jsonb_agg(jsonb_build_object('entryId',e.id,'selection',s.selection)),'[]') from public.entries e join public.rounds r on r.season_id=e.season_id left join public.squads s on s.entry_id=e.id and s.round_id=r.id and s.locked_at is not null where r.id=rid));
 elsif j.kind in ('halftime','reconcile','recovery') then
 if j.kind='halftime' and exists(select 1 from public.observations o where o.fixture_id=(j.payload->>'fixtureId')::uuid and (o.payload->'provenance'->>'label'='Halftime update' or o.payload->'provenance'->>'status' in ('Half time','halftime'))) then return private.ok('{"skip":true}');end if;
 if j.kind='recovery' then
 select min(due_at) into failed_at from public.scheduled_jobs where kind='reconcile' and payload->>'roundId'=rid::text and status='failed';
 if failed_at is null or (clock_timestamp() at time zone 'Europe/Dublin')::date <> ((failed_at at time zone 'Europe/Dublin')::date+1) or (clock_timestamp() at time zone 'Europe/Dublin')::time<'09:00'::time or exists(select 1 from public.rounds where id=rid and active_version_id is not null) then return private.ok('{"skip":true}');end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('fixtureId',f.id,'providerFixtureId',m.provider_fixture_id) order by f.id),'[]') into requests from public.fixtures f join private.provider_fixture_mappings m on m.fixture_id=f.id and m.provider='six-nations' and m.approved where (j.kind='halftime' and f.id=(j.payload->>'fixtureId')::uuid or j.kind in ('reconcile','recovery') and f.round_id=rid) and (j.kind='halftime' or f.status='final' and f.full_time is not null and f.full_time+interval '120 minutes'<=clock_timestamp());
 if j.kind='recovery' and jsonb_array_length(requests)=0 then return private.ok('{"skip":true}');end if;
 value:=jsonb_build_object('fixtureRequests',requests,'roundId',rid);
 elsif j.kind='notify' then
 with selected as(select id from private.push_deliveries where status in ('pending','accepted','retry') and next_attempt_at<=clock_timestamp() and attempts<5 and (lease_expires_at is null or lease_expires_at<=clock_timestamp()) order by next_attempt_at,id limit 100 for update skip locked),claimed as(update private.push_deliveries d set job_id=j.id,lease_token=j.lease_token,lease_expires_at=j.lease_expires_at from selected where d.id=selected.id returning d.*) select jsonb_build_object('messages',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',d.id,'token',d.token,'kind',case when n.payload->>'kind'='reminder' then 'deadline' else n.payload->>'kind' end,'versionId',n.payload->>'versionId','ticketId',d.ticket_id))),'[]') from claimed d join public.notifications n on n.id=d.notification_id)) into value;
 else value:=j.payload;end if;return private.ok(value);exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;
create function private.schedule_notification_retry() returns void language plpgsql set search_path='' as $$declare next_at timestamptz;begin select min(next_attempt_at) into next_at from private.push_deliveries where status in ('pending','accepted','retry') and attempts<5; if next_at is not null then insert into public.scheduled_jobs(kind,payload,due_at,max_attempts,dedupe_key) values('notify','{}',next_at,3,'notify:retry:'||next_at::text) on conflict do nothing;end if;end$$;

create or replace function public.worker_execute_job(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.scheduled_jobs;r public.rounds;entryrow public.entries;s public.squads;uid uuid;op uuid;value jsonb;delivery jsonb;push private.push_deliveries;
begin j:=private.fence(p_input);
 if j.kind='lock_round' then
 select * into r from public.rounds where id=(j.payload->>'roundId')::uuid for update;
 if r.deadline>clock_timestamp() then return private.fail('ROUND_LOCKED','Round deadline not reached');end if;
 -- Entry row locking serializes confirmations with carry-forward and deletion.
 for entryrow in select * from public.entries where season_id=r.season_id order by id for update loop
 if not exists(select 1 from public.squads where entry_id=entryrow.id and round_id=r.id) then
 select q.* into s from public.squads q join public.rounds old on old.id=q.round_id where q.entry_id=entryrow.id and old.number<r.number order by old.number desc limit 1;
 if s.id is not null and private.selection_error(r.season_id,s.selection) is null then insert into public.squads(entry_id,round_id,revision,selection,provenance,locked_at) values(entryrow.id,r.id,1,s.selection,'carried',clock_timestamp());end if;
 end if;
 update public.squads set locked_at=clock_timestamp() where entry_id=entryrow.id and round_id=r.id and locked_at is null;
 end loop;update public.rounds set locked_at=coalesce(locked_at,clock_timestamp()) where id=r.id;
 elsif j.kind='export_account' then
 uid:=(j.payload->>'userId')::uuid;op:=(j.payload->>'operationId')::uuid;
 value:=jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where id=uid),'entries',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.entries e where user_id=uid),'squads',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.squads s join public.entries e on e.id=s.entry_id where e.user_id=uid));update public.account_operations set status='completed',result=value where id=op and user_id=uid;
 elsif j.kind='delete_account' then
 uid:=(j.payload->>'userId')::uuid;op:=(j.payload->>'operationId')::uuid;
 if exists(select 1 from public.leagues where owner_id=uid and not archived) then return private.fail('OWNER_TRANSFER_REQUIRED','Transfer or archive owned leagues before deletion');end if;
 delete from public.memberships m using public.entries e where e.id=m.entry_id and e.user_id=uid;
 update public.entries set user_id=null,display_name='Deleted player' where user_id=uid;
 delete from private.push_tokens where user_id=uid;delete from public.notifications where user_id=uid;delete from public.profiles where id=uid;delete from private.admins where user_id=uid;delete from private.requests where user_id=uid;update private.audits set actor_id=null,input='{}' where actor_id=uid;update public.account_operations set result=null where user_id=uid and id<>op;update public.leagues set owner_id='00000000-0000-0000-0000-000000000000' where owner_id=uid and archived;
 if coalesce((p_input->>'authDeleted')::boolean,false) then update public.account_operations set status='completed',result='{"anonymized":true,"identityDeleted":true}' where id=op;else update public.account_operations set status='processing',result='{"anonymized":true}' where id=op;return private.ok(jsonb_build_object('userId',uid,'anonymized',true));end if;
 elsif j.kind='reminder' then insert into public.notifications(user_id,payload,unique_key) select e.user_id,jsonb_build_object('kind','reminder','roundId',j.payload->>'roundId'),'reminder:'||j.id||':'||e.id from public.entries e join public.profiles p on p.id=e.user_id join public.rounds r on r.season_id=e.season_id where r.id=(j.payload->>'roundId')::uuid and p.reminders on conflict do nothing;insert into private.push_deliveries(notification_id,token) select n.id,t.token from public.notifications n join private.push_tokens t on t.user_id=n.user_id where n.unique_key like 'reminder:'||j.id||':%' on conflict do nothing;perform private.schedule_notification_retry();
 elsif j.kind='notify' then
 if p_input->'deliveries' is null then return private.fail('VALIDATION_ERROR','Delivery outcomes required');end if;
 for delivery in select * from jsonb_array_elements(p_input->'deliveries') loop select * into push from private.push_deliveries where id=(delivery->>'id')::uuid for update;if not found or push.job_id is distinct from j.id or push.lease_token is distinct from j.lease_token then return private.fail('VALIDATION_ERROR','Unknown or unfenced token delivery');end if;if delivery->>'status' not in ('accepted','delivered','invalid','retry') or (delivery->>'status'='accepted' and coalesce(delivery->>'ticketId','')='') or (delivery->>'status'='delivered' and push.ticket_id is null) then return private.fail('VALIDATION_ERROR','Invalid push delivery transition');end if;update private.push_deliveries set lease_expires_at=null,status=delivery->>'status',ticket_id=coalesce(delivery->>'ticketId',ticket_id),attempts=attempts+1,next_attempt_at=clock_timestamp()+case when delivery->>'status'='accepted' then interval '15 minutes' else interval '5 minutes' end where id=push.id;if delivery->>'status'='invalid' then delete from private.push_tokens where token=push.token;end if;end loop;perform private.schedule_notification_retry();
 else return private.fail('VALIDATION_ERROR','Unsupported execution kind');end if;
 return private.ok(jsonb_build_object('executed',true));exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;

create or replace function public.worker_reserve_request(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.scheduled_jobs;q private.provider_quotas;begin j:=private.fence(p_input);select * into q from private.provider_quotas where provider=p_input->>'provider' for update;if not found or not q.enabled then return private.fail('PROVIDER_DISABLED','Provider not authorized');end if;
 if exists(select 1 from private.request_reservations where provider=q.provider and request_key=p_input->>'requestKey') then return private.ok('{"reserved":false}');end if;
 if q.used_requests>=q.max_requests or (select count(*) from private.request_reservations where provider=q.provider and opportunity_key=p_input->>'opportunityKey')>=greatest(1,(p_input->>'maxRequests')::integer) then return private.fail('QUOTA_EXCEEDED','Request budget exhausted');end if;
 insert into private.request_reservations values(q.provider,p_input->>'requestKey',p_input->>'opportunityKey');update private.provider_quotas set used_requests=used_requests+1 where provider=q.provider;return private.ok('{"reserved":true}');exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;

create or replace function public.worker_ingest_observation(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.scheduled_jobs;o jsonb:=p_input->'observation';oid uuid;rid uuid;begin j:=private.fence(p_input);if j.kind='ingest_import' and (j.payload->'observation' is distinct from o or not exists(select 1 from public.import_batches b where b.payload=o and b.committed_at is not null)) then return private.fail('FORBIDDEN','Observation differs from approved import');end if;
 insert into public.observations(source,source_revision,fixture_id,observed_at,payload) values(o->>'source',o->>'sourceRevision',(o->>'fixtureId')::uuid,(o->>'observedAt')::timestamptz,o) on conflict(source,source_revision,fixture_id) do nothing;
 select id into oid from public.observations where source=o->>'source' and source_revision=o->>'sourceRevision' and fixture_id=(o->>'fixtureId')::uuid;
 if exists(select 1 from public.observations where id=oid and payload-'observedAt'<>o-'observedAt') then return private.fail('IDEMPOTENCY_CONFLICT','Source revision changed');end if;
 insert into public.statistics_revisions(observation_id,fixture_id,statistics,override_active) values(oid,(o->>'fixtureId')::uuid,o->'statistics',j.kind='ingest_import') on conflict(observation_id) do nothing;
 select id into rid from public.statistics_revisions where observation_id=oid;if j.kind in ('reconcile','recovery','ingest_import') then insert into public.scheduled_jobs(kind,payload,due_at,max_attempts,dedupe_key) select 'score_round',jsonb_build_object('roundId',f.round_id),clock_timestamp(),1,'score:'||rid::text from public.fixtures f where f.id=(o->>'fixtureId')::uuid on conflict do nothing;end if;return private.ok(jsonb_build_object('statisticsRevisionId',rid));exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated,service_role;
grant execute on function private.can_view_squad(uuid,timestamptz) to authenticated;
create function private.freeze_player_configuration() returns trigger language plpgsql set search_path='' as $$begin if exists(select 1 from public.entries where season_id=old.season_id) and (new.position,new.price_tenths,new.nation_id,new.season_id,new.eligible) is distinct from (old.position,old.price_tenths,old.nation_id,old.season_id,old.eligible) then raise exception 'Season player configuration frozen after entry';end if;return new;end$$;
create trigger player_configuration_frozen before update on public.players for each row execute function private.freeze_player_configuration();
create function public.health_check() returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('ready',true)$$;
revoke all on function public.health_check() from public;
grant execute on function public.health_check() to anon,authenticated;

create or replace function public.worker_claim_jobs(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 insert into private.worker_heartbeats values(p_input->>'workerId',clock_timestamp()) on conflict(worker_id) do update set last_seen_at=excluded.last_seen_at;update public.scheduled_jobs set status='failed',lease_expires_at=null,last_error=jsonb_build_object('code','LEASE_LOST','message','Final attempt lease expired; manual recovery required') where status='running' and lease_expires_at<=clock_timestamp() and attempts>=max_attempts;with due as(select id from public.scheduled_jobs where due_at<=clock_timestamp() and attempts<max_attempts and (status='pending' or (status='running' and lease_expires_at<=clock_timestamp())) order by due_at,id for update skip locked limit least(100,greatest(1,(p_input->>'limit')::integer))), claimed as(update public.scheduled_jobs j set status='running',attempts=attempts+1,worker_id=p_input->>'workerId',lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+make_interval(secs=>least(3600,greatest(1,(p_input->>'leaseSeconds')::integer))) from due where j.id=due.id returning j.*) select coalesce(jsonb_agg(private.job_json(claimed)),'[]') into result from claimed; return private.ok(result);end$$;
revoke all on all functions in schema private from public,anon,authenticated,service_role;
grant execute on function private.can_view_squad(uuid,timestamptz) to authenticated;

create function private.deadline_guard() returns trigger language plpgsql set search_path='' as $$begin if new.deadline<>old.deadline and not exists(select 1 from private.deadline_authorizations where round_id=old.id and new_deadline=new.deadline and consumed_at is not null) then raise exception 'Published deadline requires CTO authorization';end if;return new;end$$;
create trigger round_deadline_guard before update of deadline on public.rounds for each row execute function private.deadline_guard();
commit;
