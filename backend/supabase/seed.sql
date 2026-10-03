-- Synthetic development tournament; no real players or provider rights implied.
insert into public.seasons(id,name,year) values('00000000-0000-4000-8000-000000000001','Synthetic Six Nations',2027);
insert into public.rounds(id,season_id,number,deadline) values('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001',1,clock_timestamp()+interval '7 days'),('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',2,clock_timestamp()+interval '14 days');
insert into public.players(id,season_id,nation_id,name,position,price_tenths)
select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-4000-8000-000000000001',('20000000-0000-4000-8000-'||lpad(((i-1)%6)::text,12,'0'))::uuid,'Synthetic Player '||i,(array['prop','prop','hooker','lock','lock','back_row','back_row','back_row','scrum_half','fly_half','centre','centre','outside_back','outside_back','outside_back','prop','lock','outside_back'])[i],40 from generate_series(1,18)i;
insert into public.fixtures(id,round_id,kickoff) values('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010',clock_timestamp()+interval '7 days');
