begin;
-- Correct PL/pgSQL record/alias ambiguity and pin pagination to immutable publication.
create or replace function public.game_read(p_operation text,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); value jsonb; squad_round public.rounds; ownentry public.entries; s public.squads; league_record public.leagues; version uuid; own integer; lim integer:=least(100,greatest(1,coalesce((p_input->>'limit')::integer,50)));
begin
 if uid is null then return private.fail('UNAUTHENTICATED','Authentication required'); end if;
 if p_operation='seasons' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'entryOpen',exists(select 1 from public.rounds where season_id=seasons.id and deadline>clock_timestamp())) order by year),'[]') into value from public.seasons;
 elsif p_operation='rounds' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'seasonId',season_id,'number',number,'deadline',deadline,'status',case when locked_at is null then 'open' else 'locked' end) order by number),'[]') into value from public.rounds where season_id=(p_input->>'seasonId')::uuid;
 elsif p_operation='fixtures' then
 select jsonb_build_object('items',coalesce(jsonb_agg(v order by v->>'id'),'[]'),'nextCursor',case when count(*)=lim then max(v->>'id') end) into value from (select jsonb_build_object('id',ff.id,'homeNationId',ff.details->'homeNationId','awayNationId',ff.details->'awayNationId','homeScore',ff.details->'homeScore','awayScore',ff.details->'awayScore','roundId',ff.round_id,'kickoff',ff.kickoff,'status',ff.status,'fullTime',ff.full_time,'disposition',ff.disposition,'dispositionApproved',ff.disposition_approved) v from public.fixtures ff join public.rounds rr on rr.id=ff.round_id where rr.season_id=(p_input->>'seasonId')::uuid and (p_input->>'roundId' is null or ff.round_id=(p_input->>'roundId')::uuid) and (p_input->>'cursor' is null or ff.id>(p_input->>'cursor')::uuid) order by ff.id limit lim) t;
 elsif p_operation='player_statistics' then
 select jsonb_build_object('items',coalesce(jsonb_agg(v order by v->>'fixtureId'),'[]'),'nextCursor',case when count(*)=lim then max(v->>'fixtureId') end) into value from (
 select jsonb_build_object('fixtureId',ff.id,'roundId',rr.id,'versionId',pub.id,'statistics',stat,'scoreHundredths',scored->'scoreHundredths','provenance',coalesce(obs.payload->'provenance','{}'::jsonb),'observedAt',obs.observed_at) v
 from public.rounds rr join public.publications pub on pub.id=rr.active_version_id join public.scoring_runs run on run.id=pub.run_id
 cross join lateral jsonb_array_elements(run.input_manifest->'fixtures') mf
 join public.fixtures ff on ff.id=(mf->>'fixtureId')::uuid and ff.round_id=rr.id
 join public.statistics_revisions rev on rev.id=(mf->>'statisticsRevisionId')::uuid and rev.fixture_id=ff.id
 join public.observations obs on obs.id=rev.observation_id
 cross join lateral jsonb_array_elements(rev.statistics) stat
 left join lateral(select ps from jsonb_array_elements(run.player_scores) ps where ps->>'playerId'=p_input->>'playerId' and ps->>'fixtureId'=ff.id::text limit 1) score_row(scored) on true
 where rr.season_id=(p_input->>'seasonId')::uuid and stat->>'playerId'=p_input->>'playerId' and (p_input->>'cursor' is null or ff.id>(p_input->>'cursor')::uuid)
 order by ff.id limit lim) t;
 elsif p_operation='players' then select jsonb_build_object('items',coalesce(jsonb_agg(v order by v->>'id'),'[]'),'nextCursor',case when count(*)=lim then max(v->>'id') end) into value from (select jsonb_build_object('id',id,'seasonId',season_id,'nationId',nation_id,'name',name,'position',position,'priceTenths',price_tenths,'eligible',eligible) v from public.players where season_id=(p_input->>'seasonId')::uuid and (p_input->>'position' is null or position=p_input->>'position') and (p_input->>'nationId' is null or nation_id=(p_input->>'nationId')::uuid) and (p_input->>'search' is null or name ilike '%'||(p_input->>'search')||'%') and (p_input->>'cursor' is null or id>(p_input->>'cursor')::uuid) order by id limit lim) t;
 elsif p_operation='squad' then
 select * into squad_round from public.rounds where id=(p_input->>'roundId')::uuid; if not found then return private.fail('NOT_FOUND','Round not found'); end if;
 select * into ownentry from public.entries where season_id=squad_round.season_id and ((p_input->>'entryId' is null and user_id=uid) or id=(p_input->>'entryId')::uuid); if not found then return private.fail('NOT_FOUND','Entry not found'); end if;
 select * into s from public.squads where entry_id=ownentry.id and round_id=squad_round.id; if ownentry.user_id is distinct from uid and (s.locked_at is null or not private.can_view_squad(ownentry.id,s.locked_at)) then return private.fail('FORBIDDEN','Locked snapshot membership required');end if;
 value:=jsonb_build_object('id',s.id,'entryId',ownentry.id,'roundId',squad_round.id,'revision',coalesce(s.revision,0),'selection',s.selection,'deadline',squad_round.deadline,'serverTime',clock_timestamp(),'locked',squad_round.deadline<=clock_timestamp(),'provenance',s.provenance);
 elsif p_operation='leagues' then select jsonb_build_object('items',coalesce(jsonb_agg(v order by v->>'id'),'[]'),'nextCursor',case when count(*)=lim then max(v->>'id') end) into value from (select private.league_json(l) v from public.leagues l join public.memberships m on m.league_id=l.id join public.entries e on e.id=m.entry_id where e.user_id=uid and l.season_id=(p_input->>'seasonId')::uuid and (p_input->>'cursor' is null or l.id>(p_input->>'cursor')::uuid) order by l.id limit lim) t;
 elsif p_operation='league' then
 select l2.* into league_record from public.leagues l2 join public.memberships m on m.league_id=l2.id join public.entries e on e.id=m.entry_id where l2.id=(p_input->>'leagueId')::uuid and e.user_id=uid;
 if not found then return private.fail('FORBIDDEN','League membership required'); end if;
 select jsonb_build_object('league',private.league_json(league_record),'members',coalesce(jsonb_agg(jsonb_build_object('userId',e.user_id,'displayName',e.display_name)),'[]')) into value from public.memberships m join public.entries e on e.id=m.entry_id where m.league_id=league_record.id;
 elsif p_operation='standings' then
 if p_input->>'leagueId' is not null and not exists(select 1 from public.memberships m join public.entries e on e.id=m.entry_id where m.league_id=(p_input->>'leagueId')::uuid and e.user_id=uid) then return private.fail('FORBIDDEN','League membership required');end if;
 select p.id into version from public.publications p join public.rounds r on r.id=p.round_id where r.season_id=(p_input->>'seasonId')::uuid order by p.created_at desc,p.id desc limit 1;
 if p_input->>'cursor' is not null then
 version:=split_part(p_input->>'cursor',':',1)::uuid;
 if not exists(select 1 from public.publications p join public.rounds rr on rr.id=p.round_id where p.id=version and rr.season_id=(p_input->>'seasonId')::uuid) then return private.fail('VALIDATION_ERROR','Cursor publication does not belong to season');end if;end if;
 with ranked as(select e.id,e.user_id,e.display_name,e.registered_at,rk.score_hundredths,rk.captain_bonus_hundredths,rk.contributing_tries,rank() over(order by rk.score_hundredths desc,rk.captain_bonus_hundredths desc,rk.contributing_tries desc,e.registered_at)::integer ranking from public.rankings rk join public.entries e on e.id=rk.entry_id where rk.version_id=version and (p_input->>'leagueId' is null or exists(select 1 from public.memberships m where m.league_id=(p_input->>'leagueId')::uuid and m.entry_id=e.id))), page_rows as(select * from ranked where p_input->>'cursor' is null or (ranking,id)>((split_part(p_input->>'cursor',':',2))::integer,(split_part(p_input->>'cursor',':',3))::uuid) order by ranking,id limit lim)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('entryId',id,'displayName',display_name,'rank',ranking,'scoreHundredths',score_hundredths,'captainBonusHundredths',captain_bonus_hundredths,'contributingTries',contributing_tries,'registeredAt',registered_at) order by ranking,id) from page_rows),'[]'),'nextCursor',case when (select count(*) from page_rows)=lim then (select version::text||':'||ranking::text||':'||id::text from page_rows order by ranking desc,id desc limit 1) end,'versionId',version,'ownRank',(select ranking from ranked where user_id=uid),'status',case when version is null then 'unpublished' else 'official' end) into value;
 elsif p_operation='match' then
 select jsonb_build_object('fixtureId',f.id,'roundId',f.round_id,'seasonId',r.season_id,'status',f.status,'snapshot',o.payload,'coverage',jsonb_build_object('complete',r.active_version_id is not null and exists(select 1 from public.publications pub join public.scoring_runs sr on sr.id=pub.run_id cross join lateral jsonb_array_elements(sr.input_manifest->'fixtures') mf where pub.id=r.active_version_id and mf->>'fixtureId'=f.id::text)),'observedAt',o.observed_at,'versionId',r.active_version_id) into value from public.fixtures f join public.rounds r on r.id=f.round_id left join lateral(select obs.* from public.observations obs where obs.fixture_id=f.id and (r.active_version_id is null or exists(select 1 from public.publications pub join public.scoring_runs sr on sr.id=pub.run_id cross join lateral jsonb_array_elements(sr.input_manifest->'fixtures') mf join public.statistics_revisions rev on rev.id=(mf->>'statisticsRevisionId')::uuid where pub.id=r.active_version_id and mf->>'fixtureId'=f.id::text and rev.observation_id=obs.id)) order by obs.observed_at desc limit 1) o on true where f.id=(p_input->>'fixtureId')::uuid;
 elsif p_operation='profile' then select jsonb_build_object('id',id,'displayName',display_name,'reminders',reminders) into value from public.profiles where id=uid;
 elsif p_operation='notifications' then select jsonb_build_object('items',coalesce(jsonb_agg(v order by v->>'id'),'[]'),'nextCursor',case when count(*)=lim then max(v->>'id') end) into value from (select jsonb_build_object('id',id,'kind',coalesce(payload->>'kind','notice'),'payload',payload,'readAt',read_at,'createdAt',created_at) v from public.notifications where user_id=uid and (p_input->>'cursor' is null or id>(p_input->>'cursor')::uuid) order by id limit lim) t;
 elsif p_operation='operation' then select jsonb_build_object('id',id,'kind',kind,'status',status,'result',result) into value from public.account_operations where id=(p_input->>'operationId')::uuid and user_id=uid;
 elsif p_operation='admin_state' then if not private.is_admin() then return private.fail('FORBIDDEN','Administrator MFA required'); end if; value:=jsonb_build_object('jobs',(select coalesce(jsonb_agg(to_jsonb(j)),'[]') from (select * from public.scheduled_jobs order by due_at desc limit 100) j),'imports',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from (select * from public.import_batches order by id desc limit 100) i),'runs',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select * from public.scoring_runs order by created_at desc limit 100) r),'coverage','[]'::jsonb);
 else return private.fail('VALIDATION_ERROR','Unsupported operation'); end if;
 if value is null then return private.fail('NOT_FOUND','Resource not found'); end if; return private.ok(value);
exception when invalid_text_representation then return private.fail('VALIDATION_ERROR','Invalid query input'); end$$;

create function private.realtime_member(topic text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.memberships m join public.entries e on e.id=m.entry_id where e.user_id=(select auth.uid()) and 'league:'||m.league_id::text=topic)
$$;
revoke all on function private.realtime_member(text) from public,anon,service_role;
grant execute on function private.realtime_member(text) to authenticated;
create function private.publication_signal() returns trigger language plpgsql security definer set search_path='' as $$
declare league_id uuid;begin
 if new.active_version_id is distinct from old.active_version_id and new.active_version_id is not null and to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
 for league_id in select id from public.leagues where season_id=new.season_id loop
 perform realtime.send(jsonb_build_object('versionId',new.active_version_id),'publication','league:'||league_id::text,true);
 end loop;end if;return new;
end$$;
revoke all on function private.publication_signal() from public,anon,authenticated,service_role;
create trigger publication_identifier_signal after update of active_version_id on public.rounds for each row execute function private.publication_signal();
-- Managed Supabase supplies realtime; standalone Postgres intentionally has no websocket service.
do $$begin if to_regclass('realtime.messages') is not null then
 execute 'create policy fantasy_league_publications on realtime.messages for select to authenticated using (extension = ''broadcast'' and (select private.realtime_member(realtime.topic())))';
 end if;end$$;
commit;
