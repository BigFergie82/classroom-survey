# Classroom Survey Studio

A React + TypeScript classroom survey application with Supabase PostgreSQL and Auth. Instructors create and activate surveys; students join by QR code and answer without an account. Responses persist in PostgreSQL and results can be exported as CSV.

## Local setup

1. Install Node.js 22.12+ or 24 LTS.
2. Run `npm ci` (or `npm install` for the first installation).
3. Create a free Supabase project.
4. Run `supabase/migrations/001_classroom.sql` once in the project's SQL Editor. It creates all five tables, indexes, foreign keys, RLS policies, and RPC functions inside a transaction.
5. In **Authentication > Sign In / Providers**, disable **Allow new users to sign up**. This app intentionally treats administrator-provisioned authenticated accounts as instructors. Do not deploy with open signup enabled.
6. In **Authentication > Users**, create an instructor user. Keep this password private. Provide grader credentials separately through HuskyCT, never in this repository.
7. Copy `.env.example` to `.env`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the project URL and publishable key (or legacy anon key). These two client values are public by design. Never put a service-role key or database password into a `VITE_` variable.
8. Run `npm run dev` and open the printed address.

Without configuration, the login page explains what is missing. There is no mock login or local-only substitute for the database.

## Build and tests

```text
npm test
npm run build
npm run preview
```

The tests cover calculation denominators, zero-response results, unanswered questions, CSV metadata and escaping, and spreadsheet-formula protection. They do not replace deployed database and browser tests. Use `docs/TESTING.md` for the full acceptance workflow.

## Architecture

- `src/main.tsx`: authentication state, protected routes, instructor dashboard, editor, presentation, student form, results.
- `src/lib/data.ts`: typed models, Supabase data operations, pagination, duplicate token and friendly errors.
- `src/lib/results.mjs`: reusable count/percentage calculations and CSV generation.
- `src/style.css`: responsive, keyboard-accessible interface with a neutral green palette.
- `supabase/migrations/001_classroom.sql`: database source of truth.
- `tests/results.test.mjs`: deterministic calculation and export tests.

The frontend signs instructors in with Supabase Auth. Instructor requests use their session JWT and RLS-protected tables. Anonymous visitors can read active survey content, but have no direct access to responses or answers. They submit through `submit_survey_response`, a narrowly granted security-definer function that validates every question and choice, checks survey status and completeness, and inserts one response with its answers atomically.

The schema contains `surveys`, `questions`, `choices`, `responses`, and `answers`. Deleting a survey cascades to dependent records. A partial unique index permits only one active survey. Activation uses a database advisory lock to serialize competing activations and closes the previous survey transactionally. Submission uses a shared row lock to allow parallel submissions while coordinating with closure. A uniqueness constraint on `(survey_id, anonymous_token)` prevents accidental repeat submissions even if a client retries.

## Design decisions

- All questions are required; multiple-choice questions have 2-12 choices and surveys have 1-50 questions.
- Only drafts can be edited. Closed and archived surveys remain immutable in the editor; duplicate one to revise it. This preserves question/answer relationships for historical results.
- True/false choices are fixed to True and False.
- Presentation counts refresh every five seconds; results refresh on request. Realtime is outside the MVP.
- Browser tokens prevent accidental duplicates, not determined voting fraud. Clearing browser storage or changing browsers creates a different anonymous identity. No student names or emails are collected.
- Unavailable public links use a combined closed/unavailable state because anonymous RLS does not reveal whether a non-active survey exists.
- CSV includes survey metadata, response ID, timestamp, and a column per question. It quotes all cells, includes a UTF-8 BOM, and neutralizes spreadsheet formulas. Exports omit anonymous browser tokens.
- Historical search supports title, status, and a creation-date lower bound. Result queries paginate past Supabase's default row limit.
- The source specification's previously checked TODO entries are not accepted as proof of implementation or testing; the root TODO tracks this implementation honestly.

## Prepared deployment: GitHub Pages

The `.github/workflows/deploy.yml` workflow builds, tests, and publishes the app after a push to `main`. It includes the public Supabase URL and publishable client key; neither is a secret, and access is enforced by database grants and RLS. The local `.env` stays ignored.

After creating the `classroom-survey` repository, set **Settings > Pages > Build and deployment > Source** to **GitHub Actions**. Push the source, watch the workflow, and verify the URL returned by the deployment. Do not describe an expected URL as a successful deployment until the workflow completes and the page is checked.

The build sets `PUBLIC_BASE_PATH=/classroom-survey/`; the router and generated survey URLs honor that path. The workflow copies the app shell to `404.html` so direct survey routes can render on Pages. A direct deep link may initially have HTTP 404 status on this host even though the client app renders. Hosts with an SPA rewrite avoid that limitation.

## Alternative: Cloudflare Pages

1. Create a GitHub repository and push this project, including the original supplied specifications in `specs/`.
2. Create a Cloudflare Pages project from that repository.
3. Set build command `npm run build`, output directory `dist`, and Node version 24.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as production build variables.
5. Deploy. `public/_redirects` provides the SPA fallback so direct survey links work.
6. Add the production origin to Supabase's Auth URL configuration. Verify instructor login, public student submission in a separate browser, results, and refresh persistence.
7. Display the production presentation page so its QR code uses the production origin rather than localhost.

Other static hosts are supported if they build with Vite and rewrite application routes to `index.html`. The Supabase database remains hosted separately.

## Submission package

Required: GitHub URL, public app URL, private grader-login instructions, development summary, AI development history, and screenshots showing database tables, a survey and questions, stored test responses, and application results. See `docs/SUBMISSION.md` for current verification status. Never submit real student identifiers or credentials in screenshots.
