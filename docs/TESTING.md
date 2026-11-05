# Acceptance and security checks

Use synthetic survey data only. Record actual outcomes and dates; unchecked items are not verified.

## Core workflow

1. Sign in as the provisioned instructor. Reload and confirm the session persists. Log out and confirm instructor routes redirect to login.
2. Create a draft titled "Recursion concept check" with one multiple-choice question ("What stops recursion?": "A base case", "A loop", "A pointer") and one True/False question ("Every recursive function needs a stopping condition."). Save and reload. Inspect `surveys`, `questions`, and `choices` in Supabase.
3. Reorder questions and multiple-choice options; save, reload, and confirm both order and text. Try empty fields; saving should be blocked.
4. Activate and open the presentation page. Confirm title, fallback URL, PNG download, and count. Scan the QR with a phone. Ensure it uses a reachable production URL.
5. Submit as an anonymous student. Inspect `responses` and `answers`; reload and confirm data persists. Check that instructor results show 1 response and 100% for each chosen answer.
6. Submit from another browser with different answers. Confirm counts are 1/1 and percentages 50%/50%, including zero-count choices. Unanswered count should be zero because required answers are enforced.
7. Retry the first browser's token through the RPC. It must fail with `DUPLICATE_RESPONSE` without creating partial rows.
8. Activate a second survey; verify the previous survey closes. A new submission to the previous survey must fail. Close the current survey and repeat.
9. Duplicate a closed survey. Confirm the copy is a draft, its choices/questions match, and response count is zero. Archive the original and confirm history is preserved. Only test permanent deletion on a deliberately created disposable survey, with explicit confirmation.
10. Export CSV. Open in Excel or LibreOffice. Verify metadata, timestamps, quotes, commas, line breaks, and formula-leading answer text are represented safely.

## Database security

Use the project's publishable key with no instructor bearer token in a separate client/browser. Never use service-role credentials to test anonymous access.

- Select active survey content: allowed.
- Select closed/draft survey content: no rows returned.
- Select `responses` or `answers`: permission denied.
- Insert/update/delete surveys, questions or choices: permission denied.
- Insert directly into responses or answers: permission denied; only the submission RPC is granted.
- Call save/activate/close RPC without authentication: permission denied.
- Submit missing answers, duplicate question IDs, foreign survey question IDs, or a choice belonging to another question: reject the entire submission; row counts unchanged.
- Submit after closure: reject with `SURVEY_NOT_ACTIVE`.
- Concurrent requests with one browser token: exactly one response saved.
- Concurrent activation of two surveys: at most one active row; competing activation serializes.
- Verify Auth public signup is disabled. A student must not be able to provision an authenticated instructor identity.

## Usability and deployment

- Navigate every control using Tab/Shift+Tab/Enter/Space; check visible focus and associated labels.
- Check a 390px phone viewport, tablet, and desktop. Choices and submit have large targets; no horizontal scrolling.
- Check student flow in Chrome and another browser; test real camera QR scanning.
- Verify results have a numeric table independent of chart colors.
- Confirm loading states, unavailable surveys, sign-in errors, and interrupted network retries.
- Open production `/s/:slug` and results routes directly, not just by clicking within the app.
- Verify browser console has no uncaught errors.
- Do not claim 200 simultaneous-user capacity or sub-two-second loading without measuring them; those performance targets require a separate load test.
