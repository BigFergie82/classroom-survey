export function choiceStats(question, responses){
 return question.choices.map(c=>{const count=responses.filter(r=>r.answers.some(a=>a.question_id===question.id&&a.choice_id===c.id)).length;return {...c,count,percentage:responses.length?count/responses.length*100:0};});
}
export function csvCell(value){let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function makeCsv(survey,responses){
 const headers=['survey_id','survey_title','survey_status','response_id','submitted_at',...survey.questions.map(q=>q.question_text)];
 const rows=responses.map(r=>[survey.id,survey.title,survey.status,r.id,r.submitted_at,...survey.questions.map(q=>{const answer=r.answers.find(a=>a.question_id===q.id);return q.choices.find(c=>c.id===answer?.choice_id)?.choice_text??'Unanswered';})]);
 return '\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
