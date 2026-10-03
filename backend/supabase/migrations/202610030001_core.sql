-- Ordinary mutations are RPC-only; private schema is never exposed by PostgREST.
create extension if not exists pgcrypto;
create schema if not exists private;
create table public.profiles(id uuid primary key, display_name text not null default 'Player', reminders boolean not null default true, deleted_at timestamptz);
create table public.seasons(id uuid primary key default gen_random_uuid(), name text not null, year integer not null unique);
create table public.rounds(id uuid primary key default gen_random_uuid(), season_id uuid not null references public.seasons, number integer not null, deadline timestamptz not null, locked_at timestamptz, active_version_id uuid, unique(season_id,number));
create table public.players(id uuid primary key default gen_random_uuid(), season_id uuid not null references public.seasons, nation_id uuid not null, name text not null, position text not null check(position in ('prop','hooker','lock','back_row','scrum_half','fly_half','centre','outside_back')), price_tenths integer not null check(price_tenths>0), eligible boolean not null default true);
create index players_season_idx on public.players(season_id,id);
create table public.entries(id uuid primary key default gen_random_uuid(), user_id uuid, season_id uuid not null references public.seasons, registered_at timestamptz not null default clock_timestamp(), display_name text not null, unique(user_id,season_id));
create index entries_season_idx on public.entries(season_id,id);
create table public.squads(id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.entries, round_id uuid not null references public.rounds, revision integer not null default 0, selection jsonb not null, provenance text not null check(provenance in ('confirmed','carried')), confirmed_at timestamptz not null default clock_timestamp(), locked_at timestamptz, unique(entry_id,round_id));
create index squads_round_idx on public.squads(round_id,entry_id);
create table public.leagues(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons,name text not null check(length(name) between 1 and 80),owner_id uuid not null,archived boolean not null default false,invite_code text not null unique check(invite_code ~ '^[A-Z0-9]{6}$'));
create table public.memberships(league_id uuid not null references public.leagues,entry_id uuid not null references public.entries,primary key(league_id,entry_id));
create index memberships_entry_idx on public.memberships(entry_id,league_id);
create table public.fixtures(id uuid primary key default gen_random_uuid(),round_id uuid not null references public.rounds,kickoff timestamptz not null,full_time timestamptz,status text not null default 'scheduled',disposition text,disposition_approved boolean not null default false,details jsonb not null default '{}');
create index fixtures_round_idx on public.fixtures(round_id);
create table private.admins(user_id uuid primary key);
create table private.requests(user_id uuid not null,operation text not null,request_id uuid not null,input jsonb not null,outcome jsonb not null,primary key(user_id,operation,request_id));
create table private.invite_attempts(user_id uuid not null,attempted_at timestamptz not null default clock_timestamp());
create index invite_attempts_user_idx on private.invite_attempts(user_id,attempted_at);
create table private.audits(id uuid primary key default gen_random_uuid(),actor_id uuid,operation text not null,input jsonb not null,created_at timestamptz not null default clock_timestamp());
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null,payload jsonb not null,read_at timestamptz,created_at timestamptz not null default clock_timestamp(),unique_key text unique);
create index notifications_user_idx on public.notifications(user_id,created_at);
create table private.push_tokens(user_id uuid not null,token text primary key,created_at timestamptz not null default clock_timestamp());
create table public.account_operations(id uuid primary key default gen_random_uuid(),user_id uuid not null,kind text not null,status text not null default 'pending',result jsonb);
create table public.scheduled_jobs(id uuid primary key default gen_random_uuid(),kind text not null,payload jsonb not null default '{}',due_at timestamptz not null,attempts integer not null default 0,max_attempts integer not null default 3 check(max_attempts>0),status text not null default 'pending',worker_id text,lease_token uuid,lease_expires_at timestamptz,result jsonb,last_error jsonb,dedupe_key text unique);
create index jobs_due_idx on public.scheduled_jobs(due_at,id) where status in ('pending','running');
create table private.provider_quotas(provider text primary key,enabled boolean not null default false,max_requests integer not null check(max_requests>=0),used_requests integer not null default 0);
create table private.request_reservations(provider text not null,request_key text not null,opportunity_key text not null,primary key(provider,request_key));
create table public.observations(id uuid primary key default gen_random_uuid(),source text not null,source_revision text not null,fixture_id uuid not null references public.fixtures,observed_at timestamptz not null,payload jsonb not null,unique(source,source_revision,fixture_id));
create table public.statistics_revisions(id uuid primary key default gen_random_uuid(),observation_id uuid not null unique references public.observations,fixture_id uuid not null references public.fixtures,statistics jsonb not null,created_at timestamptz not null default clock_timestamp(),override_active boolean not null default false);
create index statistics_fixture_idx on public.statistics_revisions(fixture_id,created_at desc);
create table public.import_batches(id uuid primary key default gen_random_uuid(),actor_id uuid not null,payload jsonb not null,report jsonb not null,committed_at timestamptz);
create table public.scoring_runs(id uuid primary key default gen_random_uuid(),round_id uuid not null references public.rounds,statistics_revision_id uuid not null references public.statistics_revisions,results jsonb not null,player_scores jsonb not null,complete boolean not null,created_at timestamptz not null default clock_timestamp());
create table public.run_approvals(id uuid primary key default gen_random_uuid(),run_id uuid not null references public.scoring_runs,statistics_revision_id uuid not null references public.statistics_revisions,actor_id uuid not null,reason text not null,created_at timestamptz not null default clock_timestamp());
create table public.publications(id uuid primary key default gen_random_uuid(),round_id uuid not null references public.rounds,run_id uuid not null references public.scoring_runs,approval_id uuid not null references public.run_approvals,replaces_id uuid references public.publications,created_at timestamptz not null default clock_timestamp());
create table public.rankings(version_id uuid not null references public.publications,entry_id uuid not null references public.entries,score_hundredths bigint not null,captain_bonus_hundredths bigint not null,contributing_tries bigint not null,rank integer not null,primary key(version_id,entry_id));
create index rankings_order_idx on public.rankings(version_id,rank,entry_id);
create function private.fail(code text,message text,details jsonb default null) returns jsonb language sql immutable set search_path='' as $$ select jsonb_build_object('error',jsonb_strip_nulls(jsonb_build_object('code',code,'message',message,'details',details))) $$;
create function private.ok(data jsonb) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('data',data)$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and auth.jwt()->>'aal'='aal2' and exists(select 1 from private.admins where user_id=auth.uid())$$;
create function private.immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'immutable record'; end$$;
create trigger observations_immutable before update or delete on public.observations for each row execute function private.immutable();
create trigger runs_immutable before update or delete on public.scoring_runs for each row execute function private.immutable();
create trigger approvals_immutable before update or delete on public.run_approvals for each row execute function private.immutable();
create trigger publications_immutable before update or delete on public.publications for each row execute function private.immutable();
create function private.statistics_immutable() returns trigger language plpgsql set search_path='' as $$begin if tg_op='DELETE' or (to_jsonb(new)-'override_active')<>(to_jsonb(old)-'override_active') then raise exception 'immutable statistics'; end if; return new; end$$;
create trigger statistics_immutable before update or delete on public.statistics_revisions for each row execute function private.statistics_immutable();
create function private.selection_error(p_season uuid,p_selection jsonb) returns jsonb language plpgsql set search_path='' as $$
declare n integer; total integer; formation text[]:=array['prop','prop','hooker','lock','lock','back_row','back_row','back_row','scrum_half','fly_half','centre','centre','outside_back','outside_back','outside_back'];
begin
 if jsonb_typeof(p_selection->'slots') is distinct from 'array' then return private.fail('INVALID_FORMATION','18 slots required'); end if;
 select count(*),count(distinct x->>'playerId') into n,total from jsonb_array_elements(p_selection->'slots') x;
 if n<>18 then return private.fail('INVALID_FORMATION','18 slots required'); end if;
 if total<>18 then return private.fail('DUPLICATE_PLAYER','Players must be unique'); end if;
 if exists(select 1 from jsonb_array_elements(p_selection->'slots') x left join public.players p on p.id=(x->>'playerId')::uuid and p.season_id=p_season and p.eligible where p.id is null) then return private.fail('INELIGIBLE_PLAYER','Ineligible player'); end if;
 if (select count(distinct (x->>'slot')::integer) from jsonb_array_elements(p_selection->'slots') x where (x->>'slot')::integer between 1 and 18)<>18 or exists(select 1 from jsonb_array_elements(p_selection->'slots') x join public.players p on p.id=(x->>'playerId')::uuid where (x->>'slot')::integer<=15 and p.position<>formation[(x->>'slot')::integer]) then return private.fail('INVALID_FORMATION','Invalid formation'); end if;
 select sum(p.price_tenths) into total from jsonb_array_elements(p_selection->'slots') x join public.players p on p.id=(x->>'playerId')::uuid;
 if total>1000 then return private.fail('OVER_BUDGET','Maximum budget is 100 credits'); end if;
 if exists(select 1 from jsonb_array_elements(p_selection->'slots') x join public.players p on p.id=(x->>'playerId')::uuid group by p.nation_id having count(*)>4) then return private.fail('NATION_LIMIT','Maximum four players per nation'); end if;
 if p_selection->>'captainId'=p_selection->>'viceCaptainId' or (select count(*) from jsonb_array_elements(p_selection->'slots') x where (x->>'slot')::integer<=15 and x->>'playerId' in(p_selection->>'captainId',p_selection->>'viceCaptainId'))<>2 then return private.fail('INVALID_CAPTAIN','Captain and vice captain must be different starters'); end if;
 return null;
end$$;
create function private.command(operation text,input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if operation='leave_league' then if l.owner_id=uid then return private.fail('OWNER_TRANSFER_REQUIRED','Transfer ownership before leaving'); end if; delete from public.memberships m using public.entries e where m.league_id=lid and m.entry_id=e.id and e.user_id=uid;
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
 elsif operation='approve_run' then select * into run from public.scoring_runs where id=(input->>'runId')::uuid; if not found or not run.complete then return private.fail('DATA_INCOMPLETE','Complete run required'); end if; insert into public.run_approvals(run_id,statistics_revision_id,actor_id,reason) values(run.id,run.statistics_revision_id,uid,input->>'reason') returning id into entity; return private.ok(jsonb_build_object('approvalId',entity));
 elsif operation in ('publish_run','correct_run') then return private.publish((input->>'runId')::uuid,(select id from public.run_approvals where run_id=(input->>'runId')::uuid order by created_at desc limit 1));
 elsif operation='schedule_job' then insert into public.scheduled_jobs(kind,payload,due_at,max_attempts,dedupe_key) values(input->>'kind',coalesce(input->'payload','{}'),(input->>'runAt')::timestamptz,coalesce((input->>'maxAttempts')::integer,1),input->>'requestId') returning id into entity; return private.ok(jsonb_build_object('jobId',entity));
 elsif operation='fixture_disposition' then update public.fixtures set disposition=input->>'disposition',disposition_approved=true where id=(input->>'fixtureId')::uuid; return private.ok(jsonb_build_object('updated',true));
 elsif operation='publish_deadline' then
 if exists(select 1 from public.squads where round_id=(input->>'roundId')::uuid)  then return private.fail('APPROVAL_REQUIRED','Exceptional deadline change requires recorded CTO authorization'); end if;
 update public.rounds set deadline=(input->>'deadline')::timestamptz where id=(input->>'roundId')::uuid and locked_at is null; return private.ok(jsonb_build_object('updated',true));
 elsif operation='release_override' then update public.statistics_revisions set override_active=false where id=(input->>'statisticsRevisionId')::uuid; return private.ok(jsonb_build_object('released',true));
 end if;
 return private.fail('VALIDATION_ERROR','Unsupported operation');
end$$;
create function public.game_command(p_operation text,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); existing private.requests; outcome jsonb;
begin
 if uid is null then return private.fail('UNAUTHENTICATED','Authentication required'); end if;
 if p_operation in ('preview_import','commit_import','approve_run','publish_run','correct_run','schedule_job','fixture_disposition','publish_deadline','release_override') and not private.is_admin() then return private.fail('FORBIDDEN','Administrator MFA required'); end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_operation||(p_input->>'requestId'),0));
 select * into existing from private.requests where user_id=uid and operation=p_operation and request_id=(p_input->>'requestId')::uuid;
 if found then if existing.input<>p_input then return private.fail('IDEMPOTENCY_CONFLICT','Request ID reused with different input'); end if; return existing.outcome; end if;
 outcome:=private.command(p_operation,p_input);
 insert into private.requests values(uid,p_operation,(p_input->>'requestId')::uuid,p_input,outcome);
 insert into private.audits(actor_id,operation,input) values(uid,p_operation,p_input-'token'); return outcome;
exception when invalid_text_representation or not_null_violation or check_violation or foreign_key_violation then return private.fail('VALIDATION_ERROR','Invalid command input');
end$$;
create function private.league_json(l public.leagues) returns jsonb language sql stable set search_path='' as $$ select jsonb_strip_nulls(jsonb_build_object('id',l.id,'seasonId',l.season_id,'name',l.name,'ownerId',l.owner_id,'archived',l.archived,'inviteCode',case when l.owner_id=auth.uid() then l.invite_code end)) $$;
create function public.game_read(p_operation text,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); value jsonb; r public.rounds; ownentry public.entries; s public.squads; league_record public.leagues; version uuid; own integer; lim integer:=least(100,greatest(1,coalesce((p_input->>'limit')::integer,50)));
begin
 if uid is null then return private.fail('UNAUTHENTICATED','Authentication required'); end if;
 if p_operation='seasons' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'entryOpen',exists(select 1 from public.rounds where season_id=seasons.id and deadline>clock_timestamp())) order by year),'[]') into value from public.seasons;
 elsif p_operation='rounds' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'seasonId',season_id,'number',number,'deadline',deadline,'status',case when locked_at is null then 'open' else 'locked' end) order by number),'[]') into value from public.rounds where season_id=(p_input->>'seasonId')::uuid;
 elsif p_operation='players' then select jsonb_build_object('items',coalesce(jsonb_agg(v),'[]'),'nextCursor',null) into value from (select jsonb_build_object('id',id,'seasonId',season_id,'nationId',nation_id,'name',name,'position',position,'priceTenths',price_tenths,'eligible',eligible) v from public.players where season_id=(p_input->>'seasonId')::uuid and (p_input->>'position' is null or position=p_input->>'position') and (p_input->>'nationId' is null or nation_id=(p_input->>'nationId')::uuid) and (p_input->>'search' is null or name ilike '%'||(p_input->>'search')||'%') and (p_input->>'cursor' is null or id>(p_input->>'cursor')::uuid) order by id limit lim) t;
 elsif p_operation='squad' then
 select * into r from public.rounds where id=(p_input->>'roundId')::uuid; if not found then return private.fail('NOT_FOUND','Round not found'); end if;
 select * into ownentry from public.entries where user_id=uid and season_id=r.season_id; if not found then return private.fail('NOT_FOUND','Entry not found'); end if;
 select * into s from public.squads where entry_id=ownentry.id and round_id=r.id;
 value:=jsonb_build_object('id',s.id,'entryId',ownentry.id,'roundId',r.id,'revision',coalesce(s.revision,0),'selection',s.selection,'deadline',r.deadline,'serverTime',clock_timestamp(),'locked',r.deadline<=clock_timestamp(),'provenance',s.provenance);
 elsif p_operation='leagues' then select jsonb_build_object('items',coalesce(jsonb_agg(v),'[]'),'nextCursor',null) into value from (select private.league_json(l) v from public.leagues l join public.memberships m on m.league_id=l.id join public.entries e on e.id=m.entry_id where e.user_id=uid and l.season_id=(p_input->>'seasonId')::uuid order by l.id limit lim) t;
 elsif p_operation='league' then
 select l2.* into league_record from public.leagues l2 join public.memberships m on m.league_id=l2.id join public.entries e on e.id=m.entry_id where l2.id=(p_input->>'leagueId')::uuid and e.user_id=uid;
 if not found then return private.fail('FORBIDDEN','League membership required'); end if;
 select jsonb_build_object('league',private.league_json(league_record),'members',coalesce(jsonb_agg(jsonb_build_object('userId',e.user_id,'displayName',e.display_name)),'[]')) into value from public.memberships m join public.entries e on e.id=m.entry_id where m.league_id=league_record.id;
 elsif p_operation='standings' then
 if p_input->>'leagueId' is not null and not exists(select 1 from public.memberships m join public.entries e on e.id=m.entry_id where m.league_id=(p_input->>'leagueId')::uuid and e.user_id=uid) then return private.fail('FORBIDDEN','League membership required'); end if;
 select p.id into version from public.publications p join public.rounds r on r.id=p.round_id where r.season_id=(p_input->>'seasonId')::uuid order by p.created_at desc limit 1;
 select rk.rank into own from public.rankings rk join public.entries e on e.id=rk.entry_id where rk.version_id=version and e.user_id=uid;
 select jsonb_build_object('items',coalesce(jsonb_agg(v),'[]'),'nextCursor',null,'versionId',version,'ownRank',own,'status',case when version is null then 'unpublished' else 'official' end) into value from (select jsonb_build_object('entryId',e.id,'displayName',e.display_name,'rank',rk.rank,'scoreHundredths',rk.score_hundredths,'captainBonusHundredths',rk.captain_bonus_hundredths,'contributingTries',rk.contributing_tries,'registeredAt',e.registered_at) v from public.rankings rk join public.entries e on e.id=rk.entry_id where rk.version_id=version and (p_input->>'leagueId' is null or exists(select 1 from public.memberships m where m.league_id=(p_input->>'leagueId')::uuid and m.entry_id=e.id)) order by rk.rank,e.id limit lim) t;
 elsif p_operation='match' then
 select jsonb_build_object('fixtureId',f.id,'status',f.status,'snapshot',o.payload,'coverage',jsonb_build_object('complete',false),'observedAt',o.observed_at,'versionId',r.active_version_id) into value from public.fixtures f join public.rounds r on r.id=f.round_id left join lateral(select * from public.observations where fixture_id=f.id order by observed_at desc limit 1) o on true where f.id=(p_input->>'fixtureId')::uuid;
 elsif p_operation='profile' then select jsonb_build_object('id',id,'displayName',display_name,'reminders',reminders) into value from public.profiles where id=uid;
 elsif p_operation='notifications' then select jsonb_build_object('items',coalesce(jsonb_agg(v),'[]'),'nextCursor',null) into value from (select jsonb_build_object('id',id,'kind',coalesce(payload->>'kind','notice'),'payload',payload,'readAt',read_at,'createdAt',created_at) v from public.notifications where user_id=uid order by created_at desc limit lim) t;
 elsif p_operation='operation' then select jsonb_build_object('id',id,'kind',kind,'status',status,'result',result) into value from public.account_operations where id=(p_input->>'operationId')::uuid and user_id=uid;
 elsif p_operation='admin_state' then if not private.is_admin() then return private.fail('FORBIDDEN','Administrator MFA required'); end if; value:=jsonb_build_object('jobs',(select coalesce(jsonb_agg(to_jsonb(j)),'[]') from public.scheduled_jobs j),'imports',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.import_batches i),'runs',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.scoring_runs r),'coverage','[]'::jsonb);
 else return private.fail('VALIDATION_ERROR','Unsupported operation'); end if;
 if value is null then return private.fail('NOT_FOUND','Resource not found'); end if; return private.ok(value);
exception when invalid_text_representation then return private.fail('VALIDATION_ERROR','Invalid query input'); end$$;
create function private.fence(input jsonb) returns public.scheduled_jobs language plpgsql set search_path='' as $$declare j public.scheduled_jobs;begin select * into j from public.scheduled_jobs where id=(input->>'jobId')::uuid for update; if j.status is distinct from 'running' or j.worker_id is distinct from input->>'workerId' or j.lease_token is distinct from (input->>'leaseToken')::uuid or j.lease_expires_at<=clock_timestamp() then raise exception using errcode='P0001',message='LEASE_LOST'; end if; return j; end$$;
create function private.job_json(j public.scheduled_jobs) returns jsonb language sql set search_path='' as $$select jsonb_build_object('id',j.id,'kind',j.kind,'payload',j.payload,'attempts',j.attempts,'maxAttempts',j.max_attempts,'leaseToken',j.lease_token,'leaseExpiresAt',j.lease_expires_at)$$;
create function public.worker_claim_jobs(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 with due as(select id from public.scheduled_jobs where due_at<=clock_timestamp() and attempts<max_attempts and (status='pending' or (status='running' and lease_expires_at<=clock_timestamp())) order by due_at,id for update skip locked limit least(100,greatest(1,(p_input->>'limit')::integer))), claimed as(update public.scheduled_jobs j set status='running',attempts=attempts+1,worker_id=p_input->>'workerId',lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+make_interval(secs=>least(3600,greatest(1,(p_input->>'leaseSeconds')::integer))) from due where j.id=due.id returning j.*) select coalesce(jsonb_agg(private.job_json(claimed)),'[]') into result from claimed; return private.ok(result);end$$;
create function public.worker_heartbeat_job(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.scheduled_jobs;begin j:=private.fence(p_input); update public.scheduled_jobs set lease_expires_at=clock_timestamp()+make_interval(secs=>least(3600,greatest(1,(p_input->>'leaseSeconds')::integer))) where id=j.id returning * into j; return private.ok(private.job_json(j));exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;
create function public.worker_finish_job(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.scheduled_jobs;begin j:=private.fence(p_input); update public.scheduled_jobs set status='finished',result=p_input->'result',lease_expires_at=null where id=j.id;return private.ok('{"finished":true}');exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;
create function public.worker_retry_job(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.scheduled_jobs; retry boolean;begin j:=private.fence(p_input);retry:=j.attempts<j.max_attempts and p_input->>'retryAt' is not null;update public.scheduled_jobs set status=case when retry then 'pending' else 'failed' end,due_at=coalesce((p_input->>'retryAt')::timestamptz,due_at),last_error=p_input->'error',lease_expires_at=null where id=j.id;return private.ok(jsonb_build_object('scheduled',retry));exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;
create function public.worker_reserve_request(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.scheduled_jobs;q private.provider_quotas;begin j:=private.fence(p_input);select * into q from private.provider_quotas where provider=p_input->>'provider' for update;if not found or not q.enabled then return private.fail('PROVIDER_DISABLED','Provider not authorized');end if;
 if exists(select 1 from private.request_reservations where provider=q.provider and request_key=p_input->>'requestKey') then return private.ok('{"reserved":false}');end if;
 if q.used_requests>=q.max_requests or (select count(*) from private.request_reservations where provider=q.provider and opportunity_key=p_input->>'opportunityKey')>=least(3,(p_input->>'maxRequests')::integer) then return private.fail('QUOTA_EXCEEDED','Request budget exhausted');end if;
 insert into private.request_reservations values(q.provider,p_input->>'requestKey',p_input->>'opportunityKey');update private.provider_quotas set used_requests=used_requests+1 where provider=q.provider;return private.ok('{"reserved":true}');exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;
create function public.worker_ingest_observation(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.scheduled_jobs;o jsonb:=p_input->'observation';oid uuid;rid uuid;begin j:=private.fence(p_input);
 insert into public.observations(source,source_revision,fixture_id,observed_at,payload) values(o->>'source',o->>'sourceRevision',(o->>'fixtureId')::uuid,(o->>'observedAt')::timestamptz,o) on conflict(source,source_revision,fixture_id) do nothing;
 select id into oid from public.observations where source=o->>'source' and source_revision=o->>'sourceRevision' and fixture_id=(o->>'fixtureId')::uuid;
 if exists(select 1 from public.observations where id=oid and payload<>o) then return private.fail('IDEMPOTENCY_CONFLICT','Source revision changed');end if;
 insert into public.statistics_revisions(observation_id,fixture_id,statistics,override_active) values(oid,(o->>'fixtureId')::uuid,o->'statistics',o->>'source'='manual') on conflict(observation_id) do nothing;
 select id into rid from public.statistics_revisions where observation_id=oid;return private.ok(jsonb_build_object('statisticsRevisionId',rid));exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;
create function public.worker_stage_run(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.scheduled_jobs;rid uuid;begin j:=private.fence(p_input);
 if not exists(select 1 from public.statistics_revisions s join public.fixtures f on f.id=s.fixture_id where s.id=(p_input->>'statisticsRevisionId')::uuid and f.round_id=(p_input->>'roundId')::uuid) then return private.fail('DATA_INCOMPLETE','Revision does not belong to round');end if;
 insert into public.scoring_runs(round_id,statistics_revision_id,results,player_scores,complete) values((p_input->>'roundId')::uuid,(p_input->>'statisticsRevisionId')::uuid,p_input->'results',p_input->'playerScores',(p_input->>'complete')::boolean) returning id into rid;return private.ok(jsonb_build_object('runId',rid));exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;
create function private.publish(run_id uuid,approval_id uuid) returns jsonb language plpgsql set search_path='' as $$
declare run public.scoring_runs; approval public.run_approvals; rnd public.rounds; vid uuid;old_version uuid;
begin
 select * into run from public.scoring_runs where id=run_id;if not found then return private.fail('NOT_FOUND','Run not found');end if;
 select * into rnd from public.rounds where id=run.round_id for update;
 select * into approval from public.run_approvals where id=approval_id and run_approvals.run_id=run.id and statistics_revision_id=run.statistics_revision_id;
 if not found then return private.fail('APPROVAL_REQUIRED','Approval must bind exact run and revision');end if;
 if not run.complete or rnd.locked_at is null or exists(select 1 from jsonb_array_elements(run.player_scores) x where x->>'scoreHundredths' is null or jsonb_array_length(coalesce(x->'missingMetrics','[]'))>0) then return private.fail('DATA_INCOMPLETE','Run metrics or snapshots incomplete');end if;
 if not exists(select 1 from public.fixtures where round_id=rnd.id) or exists(select 1 from public.fixtures where round_id=rnd.id and not ((status='final' and full_time is not null and full_time+interval '120 minutes'<=clock_timestamp()) or (disposition in ('cancelled','abandoned','awarded') and disposition_approved))) then return private.fail('DATA_INCOMPLETE','Unresolved fixtures or verification window');end if;
 if exists(select 1 from public.entries e where e.season_id=rnd.season_id and not exists(select 1 from jsonb_array_elements(run.results) x where x->>'entryId'=e.id::text)) or (select count(*) from jsonb_array_elements(run.results))<>(select count(distinct x->>'entryId') from jsonb_array_elements(run.results) x) then return private.fail('DATA_INCOMPLETE','Every entry must have one result');end if;
 if exists(select 1 from jsonb_array_elements(run.results) x left join public.entries e on e.id=(x->>'entryId')::uuid and e.season_id=rnd.season_id where e.id is null) then return private.fail('DATA_INCOMPLETE','Results include invalid entries');end if;
 if exists(select 1 from public.statistics_revisions s where s.fixture_id=(select fixture_id from public.statistics_revisions where id=run.statistics_revision_id) and s.created_at>(select created_at from public.statistics_revisions where id=run.statistics_revision_id) and not exists(select 1 from public.statistics_revisions o where o.fixture_id=s.fixture_id and o.override_active and o.id=run.statistics_revision_id)) then return private.fail('DATA_INCOMPLETE','Scoring input revision superseded');end if;
 select id into vid from public.publications where publications.run_id=run.id and publications.approval_id=approval.id; if found then return private.ok(jsonb_build_object('versionId',vid));end if;
 old_version:=rnd.active_version_id;insert into public.publications(round_id,run_id,approval_id,replaces_id) values(rnd.id,run.id,approval.id,old_version) returning id into vid;
 -- Build a complete cumulative snapshot using each round's approved active result.
 with active_results as(select x from public.rounds r join public.publications p on p.id=r.active_version_id join public.scoring_runs s on s.id=p.run_id cross join lateral jsonb_array_elements(s.results) x where r.season_id=rnd.season_id and r.id<>rnd.id union all select x from jsonb_array_elements(run.results) x), totals as(select e.id,e.registered_at,coalesce(sum((x->>'scoreHundredths')::bigint),0) score,coalesce(sum((x->>'captainBonusHundredths')::bigint),0) bonus,coalesce(sum((x->>'contributingTries')::bigint),0) tries from public.entries e left join active_results on x->>'entryId'=e.id::text where e.season_id=rnd.season_id group by e.id,e.registered_at)
 insert into public.rankings select vid,id,score,bonus,tries,rank() over(order by score desc,bonus desc,tries desc,registered_at)::integer from totals;
 update public.rounds set active_version_id=vid where id=rnd.id;
 insert into public.notifications(user_id,payload,unique_key) select user_id,jsonb_build_object('kind',case when old_version is null then 'official' else 'correction' end,'versionId',vid,'roundId',rnd.id),vid::text||':'||id::text from public.entries where season_id=rnd.season_id and user_id is not null;
 insert into public.scheduled_jobs(kind,payload,due_at,dedupe_key) values('notify',jsonb_build_object('versionId',vid),clock_timestamp(),'notify:'||vid::text);
 return private.ok(jsonb_build_object('versionId',vid));end$$;
create function public.worker_publish_run(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.scheduled_jobs;begin j:=private.fence(p_input);return private.publish((p_input->>'runId')::uuid,(p_input->>'approvalId')::uuid);exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;
create function public.worker_job_context(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.scheduled_jobs;rid uuid;revision uuid;value jsonb;
begin j:=private.fence(p_input);rid:=(j.payload->>'roundId')::uuid;
 if j.kind='score_round' then
 select s.id into revision from public.statistics_revisions s join public.fixtures f on f.id=s.fixture_id where f.round_id=rid order by s.created_at desc limit 1;
 value:=jsonb_build_object('roundId',rid,'statisticsRevisionId',revision,'mode','official','statistics',(select coalesce(jsonb_agg(x),'[]') from public.fixtures f join lateral(select statistics from public.statistics_revisions where fixture_id=f.id order by override_active desc,created_at desc limit 1) s on true cross join lateral jsonb_array_elements(s.statistics) x where f.round_id=rid),'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'seasonId',p.season_id,'nationId',p.nation_id,'name',p.name,'position',p.position,'priceTenths',p.price_tenths,'eligible',p.eligible)),'[]') from public.players p join public.rounds r on r.season_id=p.season_id where r.id=rid),'entries',(select coalesce(jsonb_agg(jsonb_build_object('entryId',e.id,'selection',s.selection)),'[]') from public.entries e join public.rounds r on r.season_id=e.season_id left join public.squads s on s.entry_id=e.id and s.round_id=r.id and s.locked_at is not null where r.id=rid));
 elsif j.kind='notify' then value:=jsonb_build_object('messages',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'token',p.token,'title','Six Nations results','body','Your results have been updated','versionId',n.payload->>'versionId')),'[]') from public.notifications n join private.push_tokens p on p.user_id=n.user_id where n.payload->>'versionId'=j.payload->>'versionId'));
 else value:=j.payload;end if;return private.ok(value);exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;
create function public.worker_execute_job(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.scheduled_jobs;r public.rounds;entryrow public.entries;s public.squads;uid uuid;op uuid;value jsonb;
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
 delete from private.push_tokens where user_id=uid;delete from public.notifications where user_id=uid;delete from public.profiles where id=uid;delete from private.admins where user_id=uid;
 update public.account_operations set status='completed',result='{"anonymized":true}' where id=op;
 elsif j.kind='reminder' then insert into public.notifications(user_id,payload,unique_key) select e.user_id,jsonb_build_object('kind','reminder','roundId',j.payload->>'roundId'),'reminder:'||j.id||':'||e.id from public.entries e join public.profiles p on p.id=e.user_id join public.rounds r on r.season_id=e.season_id where r.id=(j.payload->>'roundId')::uuid and p.reminders on conflict do nothing;
 elsif j.kind='notify' then
 if p_input->'deliveries' is null then return private.fail('VALIDATION_ERROR','Delivery outcomes required');end if;
 delete from private.push_tokens where token in(select d->>'token' from jsonb_array_elements(p_input->'deliveries') d where d->>'status'='invalid');
 else return private.fail('VALIDATION_ERROR','Unsupported execution kind');end if;
 return private.ok(jsonb_build_object('executed',true));exception when raise_exception then return private.fail('LEASE_LOST','Job lease lost');end$$;
-- Enable RLS everywhere. Clients can only read expressly public/owned rows; no direct writes.
do $$declare t record;begin for t in select tablename from pg_tables where schemaname='public' loop execute format('alter table public.%I enable row level security',t.tablename);execute format('revoke all on public.%I from anon,authenticated',t.tablename);end loop;end$$;
grant select on public.seasons,public.rounds,public.players,public.fixtures to authenticated;
create policy seasons_read on public.seasons for select to authenticated using(true);
create policy rounds_read on public.rounds for select to authenticated using(true);
create policy players_read on public.players for select to authenticated using(true);
create policy fixtures_read on public.fixtures for select to authenticated using(true);
grant select on public.entries,public.squads,public.profiles,public.notifications,public.account_operations to authenticated;
create policy entries_own on public.entries for select to authenticated using(user_id=(select auth.uid()));
create policy profiles_own on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy notifications_own on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy operations_own on public.account_operations for select to authenticated using(user_id=(select auth.uid()));
create function private.can_view_squad(entry uuid,locked timestamptz) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.entries where id=entry and user_id=auth.uid()) or (locked is not null and exists(select 1 from public.memberships target join public.memberships own on own.league_id=target.league_id join public.entries e on e.id=own.entry_id where target.entry_id=entry and e.user_id=auth.uid()))$$;
create policy squads_private on public.squads for select to authenticated using(private.can_view_squad(entry_id,locked_at));
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated,service_role;
-- Policy helpers require execute, remain unexposed in private schema.
grant usage on schema private to authenticated;
grant execute on function private.can_view_squad(uuid,timestamptz) to authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.game_read(text,jsonb),public.game_command(text,jsonb) to authenticated;
grant execute on function public.worker_claim_jobs(jsonb),public.worker_heartbeat_job(jsonb),public.worker_finish_job(jsonb),public.worker_retry_job(jsonb),public.worker_reserve_request(jsonb),public.worker_ingest_observation(jsonb),public.worker_stage_run(jsonb),public.worker_publish_run(jsonb),public.worker_job_context(jsonb),public.worker_execute_job(jsonb) to service_role;
