import {createClient} from '@supabase/supabase-js';
export const configured=Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const db=createClient(import.meta.env.VITE_SUPABASE_URL || 'https://unconfigured.supabase.co',import.meta.env.VITE_SUPABASE_ANON_KEY || 'unconfigured');
export type Choice={id:string; choice_text:string; position:number};
export type Question={id:string; question_text:string; question_type:'multiple_choice'|'true_false'; position:number; choices:Choice[]};
export type Survey={id:string; title:string; description:string; status:'draft'|'active'|'closed'|'archived'; public_slug:string; created_at:string; questions:Question[]};
export type ResponseRow={id:string; submitted_at:string; answers:{question_id:string; choice_id:string|null}[]};
export type DraftQuestion={key:string; question_text:string;question_type:'multiple_choice'|'true_false';choices:string[]};
export function check<T>(r:{data:T;error:{message:string}|null}):T {if(r.error)throw new Error(r.error.message);return r.data;}
export async function getSurvey(id:string,publicView=false):Promise<Survey|null>{
 const result=await db.from('surveys').select('*,questions(*,choices(*))').eq(publicView?'public_slug':'id',id).maybeSingle();
 const s=check(result) as Survey|null;
 if(s){s.questions.sort((a,b)=>a.position-b.position);s.questions.forEach(q=>q.choices.sort((a,b)=>a.position-b.position));}return s;
}
export async function getResponses(id:string):Promise<ResponseRow[]>{
 // PostgREST defaults to 1,000 rows; paginate so large classes and history export fully.
 const rows:ResponseRow[]=[];
 for(let from=0;;from+=500){const page=check(await db.from('responses').select('id,submitted_at,answers(question_id,choice_id)').eq('survey_id',id).order('id').range(from,from+499)) as ResponseRow[]; rows.push(...page);if(page.length<500)return rows;}
}
export async function duplicateSurvey(s:Survey){return check(await db.rpc('save_survey',{p_survey_id:null,p_title:`Copy of ${s.title}`.slice(0,200),p_description:s.description,p_questions:s.questions.map(q=>({question_text:q.question_text,question_type:q.question_type,choices:q.choices.map(c=>c.choice_text)}))})) as string;}
export function browserToken(){let token=localStorage.getItem('classroom-anonymous-token');if(!token){token=crypto.randomUUID();localStorage.setItem('classroom-anonymous-token',token);}return token;}
export function friendly(error:unknown){const text=error && typeof error==='object' && 'message' in error?String(error.message):String(error);if(text.includes('DUPLICATE_RESPONSE'))return 'You have already submitted a response to this survey.';if(text.includes('SURVEY_NOT_ACTIVE'))return 'This survey is no longer accepting responses.';if(text.includes('MISSING_REQUIRED_ANSWER'))return 'Please answer every question.';if(text.includes('INVALID_'))return 'Please reload the survey and check your answers.';if(text.includes('fetch'))return 'Connection interrupted. Check your internet connection and try again.';return text;}
