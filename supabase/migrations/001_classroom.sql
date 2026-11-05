-- Run once in Supabase SQL Editor. Disable public signups in Auth settings.
begin;
create table public.surveys (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 200),
 description text not null default '', status text not null default 'draft' check(status in ('draft','active','closed','archived')),
 public_slug text unique default replace(gen_random_uuid()::text,'-',''), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index only_one_active_survey on public.surveys(status) where status='active';
create table public.questions (
 id uuid primary key default gen_random_uuid(), survey_id uuid not null references public.surveys on delete cascade,
 question_text text not null check(length(trim(question_text)) between 1 and 2000), question_type text not null check(question_type in ('multiple_choice','true_false')),
 position integer not null check(position>=0), created_at timestamptz not null default now()
);
create index questions_survey_idx on public.questions(survey_id);
create table public.choices (
 id uuid primary key default gen_random_uuid(), question_id uuid not null references public.questions on delete cascade,
 choice_text text not null check(length(trim(choice_text)) between 1 and 1000), position integer not null check(position>=0), created_at timestamptz not null default now()
);
create index choices_question_idx on public.choices(question_id);
create table public.responses (
 id uuid primary key default gen_random_uuid(), survey_id uuid not null references public.surveys on delete cascade,
 anonymous_token text not null check(length(anonymous_token) between 16 and 200), submitted_at timestamptz not null default now(), unique(survey_id,anonymous_token)
);
create index responses_survey_idx on public.responses(survey_id);
create index responses_date_idx on public.responses(submitted_at);
create table public.answers (
 id uuid primary key default gen_random_uuid(), response_id uuid not null references public.responses on delete cascade,
 question_id uuid not null references public.questions on delete cascade, choice_id uuid references public.choices on delete set null,
 text_answer text, created_at timestamptz not null default now(), unique(response_id,question_id)
);
create index answers_response_idx on public.answers(response_id);
create index answers_question_idx on public.answers(question_id);
create index answers_choice_idx on public.answers(choice_id);
create function public.touch_survey() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now(); return new; end$$;
create trigger survey_updated before update on public.surveys for each row execute function public.touch_survey();
alter table public.surveys enable row level security;
alter table public.questions enable row level security;
alter table public.choices enable row level security;
alter table public.responses enable row level security;
alter table public.answers enable row level security;
-- A single-instructor deployment: only administrator-provisioned Auth accounts.
create policy instructor_surveys on public.surveys for all to authenticated using(true) with check(true);
create policy instructor_questions on public.questions for all to authenticated using(true) with check(true);
create policy instructor_choices on public.choices for all to authenticated using(true) with check(true);
create policy instructor_responses on public.responses for select to authenticated using(true);
create policy instructor_answers on public.answers for select to authenticated using(true);
create policy active_surveys on public.surveys for select to anon using(status='active');
create policy active_questions on public.questions for select to anon using(exists(select 1 from public.surveys s where s.id=survey_id and s.status='active'));
create policy active_choices on public.choices for select to anon using(exists(select 1 from public.questions q join public.surveys s on s.id=q.survey_id where q.id=question_id and s.status='active'));
grant usage on schema public to anon, authenticated;
revoke all on public.surveys, public.questions, public.choices, public.responses, public.answers from anon, authenticated;
grant select on public.surveys, public.questions, public.choices to anon;
grant select,insert,update,delete on public.surveys, public.questions, public.choices to authenticated;
grant select on public.responses, public.answers to authenticated;

create function public.save_survey(p_survey_id uuid,p_title text,p_description text,p_questions jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare sid uuid; q jsonb; c jsonb; qid uuid; n integer=0; m integer;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) not between 1 and 50 then raise exception 'Add between 1 and 50 questions.'; end if;
 if p_survey_id is null then
  insert into public.surveys(title,description) values(trim(p_title),p_description) returning id into sid;
 else
  select id into sid from public.surveys where id=p_survey_id and status='draft' for update;
  if sid is null then raise exception 'Only drafts can be edited. Duplicate this survey to create a new version.'; end if;
  update public.surveys set title=trim(p_title),description=p_description where id=sid;
  delete from public.questions where survey_id=sid;
 end if;
 for q in select value from jsonb_array_elements(p_questions) loop
  if jsonb_typeof(q->'choices') is distinct from 'array' or jsonb_array_length(q->'choices') not between 2 and 12 then raise exception 'Each question needs 2–12 choices.'; end if;
  if q->>'question_type'='true_false' and (q->'choices') <> '["True","False"]'::jsonb then raise exception 'True/False questions require True and False choices.'; end if;
  insert into public.questions(survey_id,question_text,question_type,position) values(sid,trim(q->>'question_text'),q->>'question_type',n) returning id into qid;
  n=n+1; m=0;
  for c in select value from jsonb_array_elements(q->'choices') loop
   insert into public.choices(question_id,choice_text,position) values(qid,trim(c#>>'{}'),m); m=m+1;
  end loop;
 end loop;
 return sid;
end$$;

create function public.activate_survey(p_survey_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare s public.surveys;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 perform pg_advisory_xact_lock(428318);
 select * into s from public.surveys where id=p_survey_id for update;
 if s.id is null or s.status='archived' then raise exception 'Survey unavailable.'; end if;
 if not exists(select 1 from public.questions where survey_id=s.id) or exists(select 1 from public.questions q where survey_id=s.id and (select count(*) from public.choices c where c.question_id=q.id)<2) then raise exception 'Add questions and at least two choices before activating.'; end if;
 update public.surveys set status='closed' where status='active' and id<>s.id;
 update public.surveys set status='active' where id=s.id;
end$$;

create function public.close_survey(p_survey_id uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 update public.surveys set status='closed' where id=p_survey_id and status='active';
end$$;

create function public.submit_survey_response(p_survey_id uuid,p_anonymous_token text,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid; item jsonb; expected integer; received integer;
begin
 -- Share lock permits concurrent submissions but waits for lifecycle changes.
 perform 1 from public.surveys where id=p_survey_id and status='active' for share;
 if not found then raise exception 'SURVEY_NOT_ACTIVE'; end if;
 if p_anonymous_token is null or length(p_anonymous_token) not between 16 and 200 then raise exception 'INVALID_TOKEN'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'MISSING_REQUIRED_ANSWER'; end if;
 select count(*) into expected from public.questions where survey_id=p_survey_id;
 select count(distinct x->>'question_id') into received from jsonb_array_elements(p_answers) x;
 if expected=0 or jsonb_array_length(p_answers)<>expected or received<>expected then raise exception 'MISSING_REQUIRED_ANSWER'; end if;
 if exists(select 1 from public.responses where survey_id=p_survey_id and anonymous_token=p_anonymous_token) then raise exception 'DUPLICATE_RESPONSE'; end if;
 for item in select value from jsonb_array_elements(p_answers) loop
  if not exists(select 1 from public.questions where id=(item->>'question_id')::uuid and survey_id=p_survey_id) then raise exception 'INVALID_QUESTION'; end if;
  if not exists(select 1 from public.choices where id=(item->>'choice_id')::uuid and question_id=(item->>'question_id')::uuid) then raise exception 'INVALID_CHOICE'; end if;
 end loop;
 insert into public.responses(survey_id,anonymous_token) values(p_survey_id,p_anonymous_token) returning id into rid;
 insert into public.answers(response_id,question_id,choice_id) select rid,(x->>'question_id')::uuid,(x->>'choice_id')::uuid from jsonb_array_elements(p_answers) x;
 return jsonb_build_object('success',true,'response_id',rid);
exception when unique_violation then raise exception 'DUPLICATE_RESPONSE';
end$$;

revoke all on function public.save_survey(uuid,text,text,jsonb),public.activate_survey(uuid),public.close_survey(uuid),public.submit_survey_response(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_survey(uuid,text,text,jsonb),public.activate_survey(uuid),public.close_survey(uuid) to authenticated;
grant execute on function public.submit_survey_response(uuid,text,jsonb) to anon,authenticated;
commit;
