-- Run in the Supabase SQL Editor after migration 001. All test data rolls back.
-- This simulates database roles; it does not test the Auth login flow.
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$
declare sid uuid; other uuid;
begin
 sid := public.save_survey(null,'Transactional verification','Synthetic test data',
 '[{"question_text":"What stops recursion?","question_type":"multiple_choice","choices":["A base case","A loop","A pointer"]},{"question_text":"Recursion needs a stopping condition.","question_type":"true_false","choices":["True","False"]}]'::jsonb);
 perform public.activate_survey(sid);
 other := public.save_survey(null,'Activation replacement','Synthetic test data','[{"question_text":"Ready?","question_type":"true_false","choices":["True","False"]}]'::jsonb);
 perform public.activate_survey(other);
 if (select status from public.surveys where id=sid)<>'closed' then raise exception 'FAIL: activation did not close previous survey';end if;
 perform public.activate_survey(sid);
 if (select count(*) from public.surveys where status='active')<>1 then raise exception 'FAIL: active survey invariant';end if;
 perform set_config('classroom.test_survey_id',sid::text,true);
end$$;
set local role anon;
do $$
declare sid uuid=current_setting('classroom.test_survey_id')::uuid; payload jsonb;
begin
 if (select count(*) from public.questions where survey_id=sid)<>2 then raise exception 'FAIL: anonymous active content';end if;
 if exists(select 1 from public.surveys where status<>'active') then raise exception 'FAIL: anonymous reads inactive survey';end if;
 select jsonb_agg(jsonb_build_object('question_id',q.id,'choice_id',(select c.id from public.choices c where c.question_id=q.id order by c.position limit 1))) into payload from public.questions q where q.survey_id=sid;
 perform public.submit_survey_response(sid,'verification-browser-token',payload);
 begin
  perform public.submit_survey_response(sid,'verification-browser-token',payload);
  raise exception 'FAIL: duplicate accepted';
 exception when raise_exception then
  if sqlerrm<>'DUPLICATE_RESPONSE' then raise;end if;
 end;
 begin
  perform public.submit_survey_response(sid,'verification-missing-token','[]'::jsonb);
  raise exception 'FAIL: missing answers accepted';
 exception when raise_exception then
  if sqlerrm<>'MISSING_REQUIRED_ANSWER' then raise;end if;
 end;
 begin
  perform 1 from public.responses;
  raise exception 'FAIL: anonymous can read responses';
 exception when insufficient_privilege then null;
 end;
 begin
  perform 1 from public.answers;
  raise exception 'FAIL: anonymous can read answers';
 exception when insufficient_privilege then null;
 end;
 if has_table_privilege('anon','public.surveys','INSERT') or has_table_privilege('anon','public.responses','INSERT') then raise exception 'FAIL: anonymous direct write privilege';end if;
 if has_function_privilege('anon','public.activate_survey(uuid)','EXECUTE') then raise exception 'FAIL: anonymous can activate';end if;
end$$;
set local role authenticated;
do $$
declare sid uuid=current_setting('classroom.test_survey_id')::uuid;
begin
 if (select count(*) from public.responses where survey_id=sid)<>1 then raise exception 'FAIL: response atomicity';end if;
 if (select count(*) from public.answers a join public.responses r on r.id=a.response_id where r.survey_id=sid)<>2 then raise exception 'FAIL: answer atomicity';end if;
 perform public.close_survey(sid);
end$$;
set local role anon;
do $$
begin
 begin
  perform public.submit_survey_response(current_setting('classroom.test_survey_id')::uuid,'verification-closed-token','[]'::jsonb);
  raise exception 'FAIL: closed survey accepted a submission';
 exception when raise_exception then
  if sqlerrm<>'SURVEY_NOT_ACTIVE' then raise;end if;
 end;
end$$;
reset role;
select 'PASS: lifecycle, active-content RLS, submission, duplicate/missing-answer rejection, result privacy, direct-write restrictions, closure' as database_verification;
rollback;
