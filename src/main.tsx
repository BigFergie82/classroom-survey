import React, { createContext, useContext, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { ArrowDown, ArrowUp, ArrowUpRight, BarChart3, BookOpen, Check, ChevronLeft, Copy, Download, LogOut, Plus, QrCode, Search, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
const ResultsChart = React.lazy(() => import('./components/ResultsChart'));
import { db, configured, check, getSurvey, getResponses, duplicateSurvey, browserToken, friendly, type Survey, type DraftQuestion, type ResponseRow } from './lib/data';
import { choiceStats, makeCsv } from './lib/results.mjs';
import './style.css';
const Auth = createContext<{
    session: Session | null;
    ready: boolean;
}>({ session: null, ready: false });
function App() { const [session, setSession] = useState<Session | null>(null); const [ready, setReady] = useState(false); useEffect(() => { db.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); }); const { data } = db.auth.onAuthStateChange((_event, s) => { setSession(s); setReady(true); }); return () => data.subscription.unsubscribe(); }, []); return <Auth.Provider value={{ session, ready }}><BrowserRouter basename={import.meta.env.BASE_URL}><Routes><Route path="/" element={<Landing />}/><Route path="/login" element={<Login />}/><Route path="/s/:slug" element={<Student />}/><Route path="/dashboard" element={<Protected><Dashboard /></Protected>}/><Route path="/surveys/new" element={<Protected><Editor /></Protected>}/><Route path="/surveys/:id/edit" element={<Protected><Editor /></Protected>}/><Route path="/surveys/:id/present" element={<Protected><Present /></Protected>}/><Route path="/surveys/:id/results" element={<Protected><Results /></Protected>}/><Route path="*" element={<State title="Page not found" text="Check the address or return to the home page."/>}/></Routes></BrowserRouter></Auth.Provider>; }
function Logo() { return <Link className="brand" to="/"><span className="brand-icon"><BookOpen size={21}/></span>classroom<span className="brand-dot">.</span></Link>; }
function Shell({ children }: {
    children: React.ReactNode;
}) { const { session } = useContext(Auth); return <><header className="topbar"><Logo /><nav><Link className="nav-active" to="/dashboard">Survey studio</Link><span className="account">{session?.user.email}</span><button className="icon-btn" aria-label="Log out" onClick={() => db.auth.signOut()}><LogOut size={18}/></button></nav></header><main className="container">{children}</main><footer>CLASSROOM SURVEY STUDIO <span>Small questions. Better understanding.</span></footer></>; }
function Protected({ children }: {
    children: React.ReactNode;
}) { const { session, ready } = useContext(Auth); if (!ready)
    return <State title="Loading your workspace…"/>; return session ? children : <Navigate to="/login" replace/>; }
function ErrorMessage({ error }: {
    error: string;
}) { return error ? <div role="alert" className="error">{error}</div> : null; }
function State({ title, text }: {
    title: string;
    text?: string;
}) { return <main className="state"><Logo /><div className="state-mark"><BookOpen /></div><h1>{title}</h1>{text && <p>{text}</p>}<Link to="/" className="text-link">Back to Classroom</Link></main>; }
function Landing() { const { session } = useContext(Auth); return <><header className="topbar"><Logo /><Link className="btn secondary" to={session ? '/dashboard' : '/login'}>Instructor {session ? 'dashboard' : 'login'} <ArrowUpRight size={16}/></Link></header><main className="landing"><div className="eyebrow"><span className="live-dot"/> MADE FOR THE CLASSROOM</div><h1>A little question.<br /><em>A clearer picture.</em></h1><p>Create a quick survey, share a QR code, and see where your class stands. Every voice, in one place.</p><Link className="btn" to={session ? '/dashboard' : '/login'}>Open survey studio <ArrowUpRight size={18}/></Link><div className="landing-grid"><article><span>01 / PREPARE</span><h3>Ask something useful.</h3><p>Build multiple-choice and true/false questions before class.</p></article><article><span>02 / SHARE</span><h3>Scan. Answer. Done.</h3><p>No student accounts. Just a QR code and a few taps.</p></article><article><span>03 / UNDERSTAND</span><h3>Make responses count.</h3><p>Review clear charts, keep your history, and export the details.</p></article></div></main></>; }
function Login() { const nav = useNavigate(); const { session } = useContext(Auth); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); if (session)
    return <Navigate to="/dashboard" replace/>; return <main className="login-layout"><section className="login-story"><Logo /><div><div className="eyebrow">A MOMENT TO CHECK IN</div><h1>Good teaching<br />starts with<br /><em>listening.</em></h1><p>Your classroom, a little more connected.</p></div><small>CLASSROOM SURVEY STUDIO / 2026</small></section><section className="login-form"><div><div className="eyebrow">INSTRUCTOR WORKSPACE</div><h2>Welcome back.</h2><p>Sign in to prepare your next classroom conversation.</p>{!configured && <ErrorMessage error="Setup needed: configure the Supabase project URL and publishable key before signing in."/>}<form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try {
    const result = await db.auth.signInWithPassword({ email, password });
    if (result.error)
        throw result.error;
    nav('/dashboard');
}
catch (err) {
    setError(friendly(err));
}
finally {
    setBusy(false);
} }}><label>Email address<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required placeholder="instructor@university.edu"/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required/></label><ErrorMessage error={error}/><button disabled={busy || !configured} className="btn full">{busy ? 'Signing in…' : 'Sign in'} <ArrowUpRight size={17}/></button></form><small>Instructor accounts are provisioned by the administrator.<br />Students join directly from a survey link.</small></div></section></main>; }
function Dashboard() { const [surveys, setSurveys] = useState<Survey[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState('all'); const [date, setDate] = useState(''); const nav = useNavigate(); async function load() { try {
    setSurveys(check(await db.from('surveys').select('*').order('created_at', { ascending: false })) as Survey[]);
}
catch (err) {
    setError(friendly(err));
}
finally {
    setLoading(false);
} } useEffect(() => { void load(); }, []); async function action(s: Survey, kind: string) { if (['delete', 'archive', 'close'].includes(kind) && !window.confirm(kind === 'delete' ? `Permanently delete “${s.title}” and ALL responses? Archive instead to preserve your history.` : `${kind === 'close' ? 'Close' : 'Archive'} “${s.title}”? Students will no longer be able to submit.`))
    return; setBusy(s.id); setError(''); try {
    if (kind === 'activate')
        check(await db.rpc('activate_survey', { p_survey_id: s.id }));
    if (kind === 'close')
        check(await db.rpc('close_survey', { p_survey_id: s.id }));
    if (kind === 'archive')
        check(await db.from('surveys').update({ status: 'archived' }).eq('id', s.id));
    if (kind === 'delete')
        check(await db.from('surveys').delete().eq('id', s.id));
    if (kind === 'duplicate') {
        const full = await getSurvey(s.id);
        if (full)
            nav(`/surveys/${await duplicateSurvey(full)}/edit`);
    }
    await load();
}
catch (err) {
    setError(friendly(err));
}
finally {
    setBusy('');
} } const active = surveys.find(s => s.status === 'active'); const shown = surveys.filter(s => s.title.toLowerCase().includes(search.toLowerCase()) && (status === 'all' || s.status === status) && (!date || s.created_at.slice(0, 10) >= date)); return <Shell><div className="page-heading"><div><div className="eyebrow">YOUR TEACHING WORKSPACE</div><h1>Survey studio<span className="muted-dot">.</span></h1><p>A quick pulse on what your class is thinking.</p></div><Link className="btn" to="/surveys/new"><Plus size={18}/> New survey</Link></div><div className="stats"><div><span>Total surveys</span><strong>{surveys.length.toString().padStart(2, '0')}</strong><small>Your question collection</small></div><div><span>Ready for class</span><strong>{surveys.filter(s => s.status === 'draft').length.toString().padStart(2, '0')}</strong><small>Drafts waiting in the wings</small></div><div><span>In the classroom</span><strong className="green">{active ? '01' : '00'}<span className="live-dot"/></strong><small>{active ? 'Accepting student responses' : 'No survey is active'}</small></div></div>{active && <section className="active-banner"><div><span className="badge active"><span className="live-dot"/> Live now</span><h2>{active.title}</h2><p>Your survey is open. Put the QR code up and let everyone join.</p></div><Link className="btn light" to={`/surveys/${active.id}/present`}><QrCode size={18}/> Present survey <ArrowUpRight size={18}/></Link></section>}<section className="survey-section"><div className="section-heading"><h2>Your surveys <span>{shown.length}</span></h2><span className="subtle">Made for the next good question</span></div><div className="filters"><div className="search"><Search size={17}/><input aria-label="Search surveys" placeholder="Find a survey…" value={search} onChange={e => setSearch(e.target.value)}/></div><label className="inline-label">Status<select value={status} onChange={e => setStatus(e.target.value)}>{['all', 'draft', 'active', 'closed', 'archived'].map(x => <option key={x} value={x}>{x === 'all' ? 'All statuses' : x[0].toUpperCase() + x.slice(1)}</option>)}</select></label><label className="inline-label">Created since<input type="date" value={date} onChange={e => setDate(e.target.value)}/></label></div><ErrorMessage error={error}/>{loading ? <p className="empty">Loading surveys…</p> : !shown.length ? <div className="empty"><BookOpen size={30}/><h3>{surveys.length ? 'No matching surveys' : 'Your next conversation starts here.'}</h3><p>{surveys.length ? 'Try a different search or filter.' : 'Create a survey to hear from every student in the room.'}</p>{!surveys.length && <Link className="btn" to="/surveys/new"><Plus size={16}/> Create your first survey</Link>}</div> : <div className="survey-list">{shown.map((s, index) => <article className="survey-row" key={s.id}><span className="row-number">{String(index + 1).padStart(2, '0')}</span><div className="survey-info"><div><h3><Link to={s.status === 'draft' ? `/surveys/${s.id}/edit` : `/surveys/${s.id}/results`}>{s.title}</Link></h3><span className={`badge ${s.status}`}>{s.status}</span></div><p>{s.description || 'A classroom check-in'}</p><small>Created {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</small></div><div className="row-actions"><Link className="btn small secondary" to={`/surveys/${s.id}/results`}><BarChart3 size={15}/> Results</Link>{s.status === 'draft' && <Link className="btn small secondary" to={`/surveys/${s.id}/edit`}>Edit</Link>}{s.status === 'active' ? <><Link className="btn small" to={`/surveys/${s.id}/present`}>Present</Link><button className="btn small secondary" disabled={busy === s.id} onClick={() => action(s, 'close')}>Close</button></> : s.status !== 'archived' && <button className="btn small" disabled={busy === s.id} onClick={() => action(s, 'activate')}>Activate <ArrowUpRight size={14}/></button>}<details><summary aria-label={`More actions for ${s.title}`}>•••</summary><div className="menu"><button disabled={busy === s.id} onClick={() => action(s, 'duplicate')}><Copy size={14}/> Duplicate</button>{s.status !== 'archived' && <button disabled={busy === s.id} onClick={() => action(s, 'archive')}>Archive</button>}<button className="danger" disabled={busy === s.id} onClick={() => action(s, 'delete')}><Trash2 size={14}/> Delete</button></div></details></div></article>)}</div>}</section><div className="studio-note"><BookOpen size={17}/><p>One survey at a time. Activating a new survey automatically closes the previous one.</p></div></Shell>; }
function newQuestion(): DraftQuestion { return { key: crypto.randomUUID(), question_text: '', question_type: 'multiple_choice', choices: ['', ''] }; }
function move<T>(list: T[], index: number, by: number): T[] { const copy = [...list]; const next = index + by; if (next < 0 || next >= copy.length)
    return list; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy; }
function Editor() { const { id } = useParams(); const nav = useNavigate(); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()]); const [loading, setLoading] = useState(Boolean(id)); const [locked, setLocked] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); useEffect(() => { if (!id)
    return; getSurvey(id).then(s => { if (!s)
    throw new Error('Survey not found.'); setLocked(s.status !== 'draft'); setTitle(s.title); setDescription(s.description); setQuestions(s.questions.map(q => ({ key: q.id, question_text: q.question_text, question_type: q.question_type, choices: q.choices.map(c => c.choice_text) }))); }).catch(e => setError(friendly(e))).finally(() => setLoading(false)); }, [id]); function update(key: string, patch: Partial<DraftQuestion>) { setQuestions(q => q.map(x => x.key === key ? { ...x, ...patch } : x)); } async function save(activate: boolean) { setError(''); if (!title.trim() || !questions.length || questions.some(q => !q.question_text.trim() || q.choices.length < 2 || q.choices.some(c => !c.trim()))) {
    setError('Add a survey title, question text, and at least two non-empty choices per question.');
    return;
} setBusy(true); try {
    const sid = check(await db.rpc('save_survey', { p_survey_id: id || null, p_title: title, p_description: description, p_questions: questions.map(({ key, ...q }) => q) }));
    if (activate) {
        check(await db.rpc('activate_survey', { p_survey_id: sid }));
        nav(`/surveys/${sid}/present`);
    }
    else
        nav('/dashboard');
}
catch (e) {
    setError(friendly(e));
}
finally {
    setBusy(false);
} } return <Shell><Link className="back" to="/dashboard"><ChevronLeft size={16}/> Back to studio</Link><div className="page-heading"><div><div className="eyebrow">MAKE ROOM FOR A GOOD QUESTION</div><h1>{id ? 'Edit survey' : 'A new conversation'}<span className="muted-dot">.</span></h1><p>Keep it focused. A few good questions go a long way.</p></div><span className="badge draft">Draft</span></div><ErrorMessage error={error}/>{loading ? <p>Loading survey…</p> : locked ? <div className="card"><h2>This survey is read-only.</h2><p>Duplicate it from the dashboard to edit a fresh draft while preserving historical results.</p></div> : <form onSubmit={e => { e.preventDefault(); void save(false); }}><fieldset disabled={busy}><section className="card editor-meta"><label>Survey title<input maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Recursion concept check" required/></label><label>Description <span className="subtle">(optional)</span><textarea maxLength={4000} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Give your class a little context."/></label></section>{questions.map((q, i) => <section className="card question-editor" key={q.key}><div className="question-heading"><span className="eyebrow">QUESTION {String(i + 1).padStart(2, '0')}</span><div className="compact-actions"><button type="button" className="icon-btn" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => setQuestions(move(questions, i, -1))}><ArrowUp size={16}/></button><button type="button" className="icon-btn" aria-label={`Move question ${i + 1} down`} disabled={i === questions.length - 1} onClick={() => setQuestions(move(questions, i, 1))}><ArrowDown size={16}/></button><button type="button" className="icon-btn danger" aria-label={`Delete question ${i + 1}`} disabled={questions.length === 1} onClick={() => { if (confirm('Remove this question?'))
    setQuestions(questions.filter(x => x.key !== q.key)); }}><Trash2 size={16}/></button></div></div><label>Question<input maxLength={2000} value={q.question_text} onChange={e => update(q.key, { question_text: e.target.value })} required placeholder="What would you like to ask?"/></label><label>Question type<select value={q.question_type} onChange={e => update(q.key, { question_type: e.target.value as DraftQuestion['question_type'], choices: e.target.value === 'true_false' ? ['True', 'False'] : ['', ''] })}><option value="multiple_choice">Multiple choice</option><option value="true_false">True / False</option></select></label><div className="choices-editor">{q.choices.map((c, j) => <div className="choice-editor" key={j}><span>{String.fromCharCode(65 + j)}</span><input aria-label={`Question ${i + 1}, choice ${j + 1}`} maxLength={1000} value={c} readOnly={q.question_type === 'true_false'} required onChange={e => update(q.key, { choices: q.choices.map((x, k) => k === j ? e.target.value : x) })}/>{q.question_type === 'multiple_choice' && <><button type="button" className="icon-btn" aria-label={`Move choice ${j + 1} up`} disabled={j === 0} onClick={() => update(q.key, { choices: move(q.choices, j, -1) })}><ArrowUp size={14}/></button><button type="button" className="icon-btn" aria-label={`Move choice ${j + 1} down`} disabled={j === q.choices.length - 1} onClick={() => update(q.key, { choices: move(q.choices, j, 1) })}><ArrowDown size={14}/></button><button type="button" className="icon-btn danger" aria-label={`Delete choice ${j + 1}`} disabled={q.choices.length <= 2} onClick={() => { if (confirm('Remove this choice?'))
    update(q.key, { choices: q.choices.filter((_, k) => k !== j) }); }}><Trash2 size={14}/></button></>}</div>)}</div>{q.question_type === 'multiple_choice' && <button type="button" className="text-link" disabled={q.choices.length >= 12} onClick={() => update(q.key, { choices: [...q.choices, ''] })}><Plus size={14}/> Add choice</button>}</section>)}<button type="button" className="btn secondary" disabled={questions.length >= 50} onClick={() => setQuestions([...questions, newQuestion()])}><Plus size={16}/> Add question</button><div className="save-bar"><p>{questions.length} question{questions.length === 1 ? '' : 's'} · All answers required</p><div><button className="btn secondary" type="submit">{busy ? 'Saving…' : 'Save draft'}</button><button className="btn" type="button" onClick={() => void save(true)}>Save & activate <ArrowUpRight size={16}/></button></div></div></fieldset></form>}</Shell>; }
function Present() { const { id } = useParams(); const nav = useNavigate(); const [s, setSurvey] = useState<Survey | null>(null); const [count, setCount] = useState(0); const [qr, setQr] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const url = s ? `${window.location.origin}${import.meta.env.BASE_URL}s/${s.public_slug}` : ''; useEffect(() => { if (!id)
    return; getSurvey(id).then(setSurvey).catch(e => setError(friendly(e))); const refresh = async () => { const r = await db.from('responses').select('id', { count: 'exact', head: true }).eq('survey_id', id); if (r.error)
    setError(friendly(r.error));
else
    setCount(r.count || 0); }; void refresh(); const timer = setInterval(refresh, 5000); return () => clearInterval(timer); }, [id]); useEffect(() => { if (url)
    QRCode.toDataURL(url, { width: 640, margin: 4, errorCorrectionLevel: 'M' }).then(setQr).catch(e => setError(friendly(e))); }, [url]); return <main className="present"><div className="present-top"><Logo /><Link className="back" to="/dashboard"><ChevronLeft size={16}/> Back to studio</Link></div><ErrorMessage error={error}/>{s ? <><div className="eyebrow">{s.status === 'active' ? 'SCAN. THINK. SHARE.' : 'SURVEY IS ' + s.status.toUpperCase()}</div><h1>{s.title}</h1><p>{s.description}</p>{qr && <img className="qr" src={qr} alt={`QR code for ${url}`}/>}<a className="survey-url" href={url} target="_blank" rel="noreferrer">{url.replace(/^https?:\/\//, '')}</a><div className="response-counter"><span className="live-dot"/> <strong>{count}</strong> responses <small>Refreshes every 5 seconds</small></div><div className="present-actions"><Link className="btn" to={`/surveys/${s.id}/results`}><BarChart3 size={17}/> View results</Link><a className="btn secondary" href={qr} download={`${s.public_slug}-qr.png`}><Download size={16}/> Download QR</a>{s.status === 'active' && <button className="btn secondary" disabled={busy} onClick={async () => { if (!confirm('Close this survey? Students will no longer be able to submit.'))
    return; setBusy(true); try {
    check(await db.rpc('close_survey', { p_survey_id: s.id }));
    nav('/dashboard');
}
catch (e) {
    setError(friendly(e));
    setBusy(false);
} }}>Close survey</button>}</div></> : !error && <p>Loading presentation…</p>}</main>; }
function Student() { const { slug } = useParams(); const [s, setSurvey] = useState<Survey | null>(null); const [loading, setLoading] = useState(true); const [answers, setAnswers] = useState<Record<string, string>>({}); const [error, setError] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [token, setToken] = useState(''); useEffect(() => { try {
    setToken(browserToken());
    if (localStorage.getItem(`classroom-submitted-${slug}`))
        setDone(true);
}
catch {
    setError('Enable browser storage to prevent accidental duplicate submissions.');
} if (!slug)
    return; getSurvey(slug, true).then(setSurvey).catch(() => setError('We could not load this survey. Check your connection and try again.')).finally(() => setLoading(false)); }, [slug]); if (done)
    return <main className="student"><Logo /><section className="submission card"><span className="success-mark"><Check size={30}/></span><div className="eyebrow">ALL SET</div><h1>Thanks for sharing.</h1><p>Your response has been recorded.<br />You can close this page and rejoin your class.</p></section></main>; return <main className="student"><Logo />{loading ? <p>Loading survey…</p> : !s ? <section className="card submission"><h1>Survey unavailable</h1><p>This survey is closed or the link is no longer available. Ask your instructor for the current QR code.</p><ErrorMessage error={error}/></section> : <><div className="student-intro"><div className="eyebrow">A QUICK CLASSROOM CHECK-IN</div><h1>{s.title}</h1><p>{s.description}</p><span className="subtle">{s.questions.length} questions · Anonymous responses · All questions required</span></div><form onSubmit={async (e) => { e.preventDefault(); if (s.questions.some(q => !answers[q.id])) {
    setError('Please answer every question.');
    return;
} setBusy(true); setError(''); try {
    check(await db.rpc('submit_survey_response', { p_survey_id: s.id, p_anonymous_token: token, p_answers: s.questions.map(q => ({ question_id: q.id, choice_id: answers[q.id] })) }));
    setDone(true);
    try {
        localStorage.setItem(`classroom-submitted-${slug}`, 'yes');
    }
    catch { /* Server-side uniqueness still prevents duplicates. */ }
}
catch (err) {
    setError(friendly(err));
}
finally {
    setBusy(false);
} }}><fieldset disabled={busy}>{s.questions.map((q, i) => <fieldset className="card student-question" key={q.id}><legend><span>{String(i + 1).padStart(2, '0')}</span> {q.question_text}</legend>{q.choices.map((c, j) => <label className={`answer-option ${answers[q.id] === c.id ? 'selected' : ''}`} key={c.id}><input type="radio" name={q.id} value={c.id} required checked={answers[q.id] === c.id} onChange={() => setAnswers({ ...answers, [q.id]: c.id })}/><span className="choice-letter">{String.fromCharCode(65 + j)}</span><span>{c.choice_text}</span></label>)}</fieldset>)}<ErrorMessage error={error}/><button className="btn full" disabled={!token || busy}>{busy ? 'Recording response…' : 'Submit response'} <ArrowUpRight size={17}/></button></fieldset></form><p className="student-footer">Your instructor sees answers, not your identity.</p></>}</main>; }
function Results() { const { id } = useParams(); const [s, setSurvey] = useState<Survey | null>(null); const [responses, setResponses] = useState<ResponseRow[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); async function load() { if (!id)
    return; setLoading(true); setError(''); try {
    const [survey, rows] = await Promise.all([getSurvey(id), getResponses(id)]);
    if (!survey)
        throw new Error('Survey not found.');
    setSurvey(survey);
    setResponses(rows);
}
catch (e) {
    setError(friendly(e));
}
finally {
    setLoading(false);
} } useEffect(() => { void load(); }, [id]); function download() { if (!s)
    return; const url = URL.createObjectURL(new Blob([makeCsv(s, responses)], { type: 'text/csv;charset=utf-8;' })); const link = document.createElement('a'); link.href = url; link.download = `survey-${s.public_slug}.csv`; link.click(); URL.revokeObjectURL(url); } return <Shell><Link className="back" to="/dashboard"><ChevronLeft size={16}/> Back to studio</Link><div className="page-heading"><div><div className="eyebrow">LISTENING, MADE VISIBLE</div><h1>{s?.title || 'Survey results'}</h1><p>{responses.length} responses {s && <>· <span className={`badge ${s.status}`}>{s.status}</span></>}</p></div><div className="button-group"><button className="btn secondary" disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</button>{s && <><button className="btn secondary" onClick={download}><Download size={16}/> Export CSV</button>{s.status === 'active' && <Link className="btn" to={`/surveys/${s.id}/present`}><QrCode size={16}/> Present</Link>}</>}</div></div><ErrorMessage error={error}/>{!loading && s && responses.length === 0 && <section className="card empty"><BarChart3 size={30}/><h2>No responses yet.</h2><p>Activate the survey and share its QR code to start the conversation.</p></section>}{s?.questions.map((q, i) => { const stats = choiceStats(q, responses); const answered = responses.filter(r => r.answers.some(a => a.question_id === q.id)).length; return <section className="card result-card" key={q.id}><div className="eyebrow">QUESTION {String(i + 1).padStart(2, '0')} / {q.question_type === 'true_false' ? 'TRUE OR FALSE' : 'MULTIPLE CHOICE'}</div><h2>{q.question_text}</h2><p className="subtle">{answered} answered · {responses.length - answered} unanswered</p><React.Suspense fallback={<p>Loading chart...</p>}><ResultsChart stats={stats}/></React.Suspense><table><caption className="sr-only">Response counts and percentages for {q.question_text}</caption><thead><tr><th>Answer choice</th><th>Responses</th><th>Percentage</th></tr></thead><tbody>{stats.map((c: {
    id: string;
    choice_text: string;
    count: number;
    percentage: number;
}) => <tr key={c.id}><td>{c.choice_text}</td><td>{c.count}</td><td>{c.percentage.toFixed(1)}%</td></tr>)}</tbody></table></section>; })}</Shell>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
