# Classroom Survey Web App: Development Summary

Malcolm Ferguson | CSE 4095 - Agentic Programming | November 5, 2026

**Working draft. The database is configured and its transactional verification passed. Public deployment and the complete browser workflow still need verification. Revise this report before submitting.**

## Using the specifications

I asked a coding agent to review the assignment and the five supporting Markdown files. The overall specification defined the app's purpose and technology stack; DATABASE.md described the relational tables and access controls; API.md guided authentication and submission operations; UI.md defined instructor and student routes; and TODO.md provided implementation phases. The agent treated the supplied checklist as planning material rather than proof that this new implementation had already been tested.

## Generated implementation and architecture

The agent generated the React, TypeScript, and Vite application, responsive styles, Supabase integration, PostgreSQL migration, automated calculation/export tests, and documentation. The instructor interface includes login, survey listing and filtering, a draft editor with multiple-choice and true/false questions, activation and closure, duplication and archive actions, a projection-friendly QR presentation, and historical results with CSV export. Students access a public survey link, answer without logging in, and receive submission confirmation.

The frontend and database have different responsibilities. React handles display, navigation, form input, charts, and downloaded CSV files. Supabase Auth provides instructor sessions. PostgreSQL stores five related tables: surveys, questions, choices, responses, and answers. Foreign keys connect child records to their parents, and deleting a survey cascades through its related records. A partial unique index enforces one active survey.

The database migration was applied through the Supabase SQL Editor. It enables Row Level Security on all five tables. Anonymous clients may read active survey questions and choices but cannot read results or modify survey content. A server-side submission function validates survey status, question ownership, choice ownership, answer completeness, and duplicate tokens before storing a response and its answers in one transaction. An instructor account was provisioned administratively, public signups were disabled, and I reported successfully signing into the local app.

## Communication and data integrity

The browser uses the Supabase JavaScript client with the project URL and publishable key. Instructor requests carry the signed-in user's JWT. Student submissions call the database RPC rather than inserting arbitrary records directly. A browser token and database uniqueness constraint prevent accidental duplicate responses. Activation closes the previous active survey inside one transaction. Shared row locks coordinate submissions with closure while allowing concurrent students to submit.

Historical surveys are read-only in the editor; duplication produces a new draft. This design preserves existing response relationships when an instructor wants to revise questions. Results retain zero-count choices, show numeric percentages alongside charts, and paginate response queries beyond the default API row limit. CSV export includes survey metadata and timestamps, escapes text, and neutralizes spreadsheet-formula prefixes.

## Debugging and verification

One obstacle was the terminal's inability to resolve the npm registry. After I installed the dependencies separately, the agent could run the production build. The first build exposed JSX and TypeScript errors, which the agent corrected. A subsequent TypeScript/Vite build succeeded. Three automated tests passed for result calculations and CSV behavior. Live SQL tests then passed for role-based access, survey activation and closure, atomic responses, duplicate and incomplete-answer rejection, and private results. Those tests used simulated database roles and rolled back their data. They do not establish that the complete browser workflow, production refresh persistence, or physical QR scanning work. Those acceptance checks are documented and remain pending.

## Deployment and reflection

Deployment configuration is prepared for GitHub Pages, with Supabase hosting PostgreSQL and authentication separately. A workflow builds and tests the frontend, supplies the public client configuration, and prepares a fallback page for direct survey links. Public signup is disabled and database permissions protect instructor operations. GitHub's repository creation form returned an error during preparation, so a public deployment has not yet been verified. The public URL, private grader-login instructions, and screenshots must be added after deployment and testing.

This implementation illustrates how a full-stack app divides responsibilities between browser UI, authentication, and persistent data. It also shows why compiling generated code is only one part of verification: database permissions and complete workflows require independent tests. Before submission, I should replace this working-draft status with verified deployment details and add my own reflection on what I learned while configuring and testing the app.
