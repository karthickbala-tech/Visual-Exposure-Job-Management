# Visual Exposure: Code Build Plan

What we build in code, in what order, and when each piece is done. Sources: `FSD.md` (behaviour), `WORKFLOWS.md` (state machines and flows), `CATALYST_PLAN.md` and `CATALYST_BUILD_LOG.md` (platform). Backend rules follow the installed `backend-patterns` skill.

## 0. Where we are

| Done | Not done |
|---|---|
| 24 tables, 11 roles, embedded login, Stratus bucket, cache segments, job pool | Almost all endpoints, business rules, event and job handlers, integrations, files, email, the whole frontend |
| `api`, `events`, `jobs` deployed; shared `lib/`; 22 tests; `/health`, `/me`, `/jobs` (list) | Seed data, first user, a login page to test with |

## 1. Working rules (apply to every slice)

1. **One slice = one branch = one pull request**, small enough to review.
2. **Pure logic first.** State machines, rollup, completion %, pay hours and checklist progression are pure functions in `lib/domain/`, with unit tests, before any endpoint uses them.
3. **Thin routes.** Route (validate with zod, authorize) then service (rules) then `db` helper. No rules in `index.js`.
4. **Deny by default.** Every new endpoint gets an entry in the authz matrix and a test for each role group.
5. **Every state change writes an `activity` row** and publishes a domain event.
6. **No secrets, no hard-coded ids, emails or dates.** Configuration comes from `setting` or environment variables.
7. **Definition of done for a slice:** tests pass, deployed to Development, smoke-tested with a real login, docs updated, reviewed with the code-review skill.

## 2. Decisions to settle first (small spike, about half a day)

| # | Question | Why it matters | My proposed default |
|---|---|---|---|
| D1 | **How does `api` trigger event handlers?** Catalyst event functions are started by event listeners or Signals, not by a normal function call | The whole "events" design depends on it | `api` inserts an `integration_job` row (the outbox) and submits an immediate job on `ve_jobs_pool`; the `jobs` function drains the outbox and dispatches handlers in-process. `events` is kept for Signals-driven inputs such as the CRM webhook. **Spike to confirm** |
| D2 | **Text columns hold 10,000 characters.** Will a real checklist's `answers` and `definition` fit? | Decides JSON column versus a row per answer | Measure with a real install checklist; if it overflows, store `answers` as rows or in Stratus |
| D3 | JavaScript or TypeScript for `lib/` and `web/` | Maintenance and safety | TypeScript for `web/`, plain JavaScript with JSDoc for `lib/` (Catalyst functions run JS) |
| D4 | Business rules still open in FSD section 14 | Slices 2 to 4 | Use the **latest Creator behaviour** as the default and mark each as an assumption in the code and tests: ungated checklists, completion % by quoted hours, job completes when no task is in an open stage |

### Phase 0 results (2026-11-02)

| # | Result |
|---|---|
| **D1** | **Confirmed on the real project.** Catalyst Job Scheduling can only start Job-type functions, so `events` (an Event function) can never be a job target. Events are delivered by `lib/publish.js`: the API submits an immediate job to `jobs` with `{ job: 'dispatch-event', type, payload }`, and `jobs` dispatches to the handlers in `lib/events/registry.js`. A live test job went PENDING to SUCCESS in 648 ms with 129 ms dispatch delay; retries are configured on submit. The `events` function stays for Signals-driven inputs (for example the CRM webhook) |
| **D2** | **Handled by a guard, not a test row.** `text` columns hold 10,000 characters (confirmed in the column metadata). `db.insert` and `db.update` now reject any value over the limit with a clear 413 error. Checklist templates are split per task type, phase and role so each stays well under the limit; answers store file ids, not blobs |
| **D3** | **TypeScript for `web/`**, JavaScript with JSDoc for `lib/` and the functions |
| **D4** | Default business rules accepted as assumptions (see FSD section 14); each is marked in the code when used |
| **Local run** | `catalyst serve --only functions:api --http 3100` serves the API at `http://localhost:3100/server/api/`. Vite proxies `/server` to it. Event and job functions are not served locally; they are tested through unit tests and deployed jobs |
| **Frontend scaffold** | `web/` (Vite, React, TypeScript, React Router, TanStack Query, self-hosted Raleway). Branded shell and a status page that reads `/health` and `/me`. Checked in a real browser at desktop and phone width; two mobile layout bugs found and fixed during the local test |

### Phase 1 status (2026-11-02)

| Part | State |
|---|---|
| **B1 backend** | Built and deployed. Domain rules as pure tested functions (`lib/domain`: stage state machines for design, fabrication and install, job rollup, completion %). Repositories (`lib/repos`), services (`lib/services/jobs.js`, `tasks.js`), request context. Endpoints: jobs (list, create, get, update), `POST /jobs/:id/tasks`, tasks (list, get, update), `POST /tasks/:id/transition`, assignees (add, remove). 64 tests pass, including role scoping, closed-job rules, reject and reopen comments, rollup after each transition, and a failed event publish never failing the request |
| **F0 frontend** | Embedded Catalyst login inside the branded page, auth gate (401 shows sign-in, 403 shows "no access"), role-aware navigation, sign out |
| **F1 frontend** | Dashboard (jobs by stage), jobs list with stage filter, job detail with progress and tasks grouped by type. Tables turn into labelled cards on phones |
| **Checked locally** | `catalyst serve` with client and API: the unsigned visitor gets the sign-in page with Catalyst's real form; all protected endpoints return 401 |
| **Checked live** | Hosted app returns 200; `/health` 200; `/jobs` and `/tasks` return 401 without a session |
| **Checked signed in** | Dashboard, jobs list, job detail and the create and stage controls, in a real signed-in browser against Development data |
| **Deferred to a later slice** | Caching the person lookup (needs measurements on real traffic), SWMS creation for install tasks (B3) |

### Phase 2 status (2026-11-02)

| Part | State |
|---|---|
| **Rules (pure, tested)** | `domain/payRules.js` (weekday, Saturday, Sunday, public holiday, breaks off double first), `domain/labourCost.js` (cost, effective hours, variance), `domain/checklistProgress.js` (template shape, conditional questions, completion, issue flags) |
| **B2 backend** | `services/checklists.js`: start (idempotent, picks the template for the task type, phase and leader or member role), save answers (validated, hidden answers dropped), complete. A post-job completion books one time entry (pay split, labour cost) and recalculates the task's booked hours, cost and variance. Approving a task approves its hours. Reject or reopen reopens the post-job checklist and puts hours back in review. Redoing it updates the same time entry |
| **Templates** | 12 seed templates (design, fabrication, install; pre and post; leader and member) with **placeholder wording**. `POST /admin/seed-templates` (admin) inserts missing ones, so a new project is set up in one call |
| **F3 frontend** | Task page (facts, team, stage buttons, checklist start or continue) and checklist page (big yes/no buttons, progress, hours form for post-job). Checked on a phone-sized screen against Development |
| **Assumptions** | Public holiday pays x2; labour cost is hours x rate with no overtime loading; a shift over 16 h is refused |
| **Not done** | Real checklist wording; photo answers (P3); raising issues from answers (P3); hours form clicked in the browser (verified through the API) |

## 3. Backend slices

| Slice | Contents | Tables | Pure logic (tested first) | Done when |
|---|---|---|---|---|
| **B1 Jobs and tasks** | `POST/GET/PATCH /jobs`, `GET /jobs/:id` (with tasks and signs), `POST /jobs/:id/tasks`, `GET/PATCH /tasks/:id`, assignees; activity log helper; event publish helper | job, task, task_assignee, task_sign, sign, sign_group, site, activity | `domain/stages.js` (state machine per task type), `domain/rollup.js` (job stage), `domain/completion.js` (percentages) | A job with design, fab and install tasks can be created and moved through stages by role, with history |
| **B2 Task actions and checklists** | submit, approve, reject, reopen, hold, release, cancel, not-used, subtask; `GET /tasks/:id/checklist/next`; checklist step completion; PM review; time entries | checklist_template, checklist, time_entry | `domain/checklistProgress.js`, `domain/payRules.js` (single, x1.5, x2), `domain/labourCost.js` | A crew member completes pre and post-job checklists, hours and cost roll up, PM approves, job stage recalculates |
| **B3 Safety and issues** | SWMS lifecycle and sign-off; issues with department routing and history | swms, hazard_library, issue | SWMS status machine; issue routing by setting | SWMS signed to the required status; issue raised from a checklist answer |
| **B4 Files and notifications** | Stratus signed upload and download; `file_asset`; email templates and send; notification log | file_asset, setting (templates) | file kind and size rules; recipient resolution by role | Upload a photo to a checklist, receive an approval email |
| **B5 People and compliance** | people, companies, sites, signs CRUD; compliance items and types; `compliance-due` job; weekly reports | person, company, compliance_*, location, register_item, device | `domain/reminders.js` (next reminder date from offsets) | Expiring ticket triggers a reminder exactly once per offset |
| **B6 Integrations** | CRM deal-won webhook creates a job; CRM stage and cost sync; WorkDrive folders; MDM sync; outbox drain with retry | integration_job | retry and idempotency rules (already built) | A deal-won webhook creates a job and a WorkDrive folder, with retries visible in the outbox |
| **B7 Dashboards and admin** | KPI and calendar endpoints cached in `kpi`; settings and authz matrix editing; matrix read from `setting` and cached in `config` | setting | KPI queries | Each role dashboard loads in under 500 ms on realistic data |

Cross-cutting, done inside the slices: seed script for `setting`, `checklist_template`, `hazard_library`, `compliance_type`; Creator data migration scripts in the last phase.

## 4. Frontend slices (new `web/` app, Vite + React)

The collaborator's `react-app/` is the **visual reference only**: dark theme, layout, navigation and component feel. No code is copied across and the mock data layer is not reused.

| Slice | Contents | Needs backend |
|---|---|---|
| **F0 Shell and login** | Vite + React Router + TanStack Query; theme tokens from the reference; embedded Catalyst login page; `/me` gate; role-based navigation; one `api` client module; error and loading states | `/me` |
| **F1 Jobs** | Jobs list with filters, job detail with task tables and progress | B1 |
| **F2 PM dashboard** | KPI tiles, my open jobs, overdue design tasks, SWMS awaiting signature | B1, B3, B7 |
| **F3 Tasks and checklists** | Task detail, checklist step forms (mobile-first), approval panel | B2 |
| **F4 Calendars and dashboards** | Install and fab calendars, role dashboards | B7 |
| **F5 Issues, SWMS, hours** | Issue board, SWMS editor and sign-off, hours report | B3 |
| **F6 Compliance and admin** | Registers, expiry tables, settings, outbox view | B5, B7 |

Local development runs through `catalyst serve`, because the login script only exists when Catalyst serves the page.

## 5. Phases and the local test loop

Every phase repeats the same loop, so nothing is built on an untested layer:

1. **Backend, local:** write the pure logic and tests, then the endpoints. Run `npm test`, then run the functions locally (`catalyst serve`) and exercise them with scripted requests.
2. **Frontend, local:** build the screens against the local backend (or a typed mock of the same contract if the backend slice is not ready), run the dev server, check in the browser with Playwright and screenshots.
3. **Together, local:** frontend against backend, signed in as each role, golden path plus the failure paths (no access, bad input, empty data).
4. **Fix, then deploy to Development** and repeat the same checks against the real Catalyst project.
5. Review (code-review and `web-design-guidelines`), update docs, open the PR.

| Phase | Backend | Frontend | Result you can see |
|---|---|---|---|
| **P0 Setup and spike** | Confirm `catalyst serve` works for all three functions; D1 and D2 spikes | Vite app scaffold in `web/`, brand tokens from `DESIGN_REFERENCE.md`, `catalyst serve` proxy | Empty branded shell runs locally |
| **P1 Sign-in and jobs** | B1 (jobs, tasks, stage machines, activity) | F0 (login, shell, role navigation), F1 (jobs list and detail) | Sign in, see jobs, open one |
| **P2 Field workflow** | B2 (task actions, checklists, hours, cost) | F3 (task detail, checklists on mobile, approval panel) | A crew member completes a checklist, a manager approves |
| **P3 Safety and files** | B3 (SWMS, issues), B4 (files, email) | F5 (issues, SWMS, hours) | Raise an issue, sign a SWMS, attach a photo |
| **P4 Dashboards** | B7 (KPIs cached, settings, matrix) | F2 (PM dashboard), F4 (calendars and role dashboards) | The seven role dashboards |
| **P5 People, compliance, schedules** | B5 | F6 | Expiry reminders and registers |
| **P6 Integrations** | B6 (CRM, WorkDrive, MDM, outbox) | outbox admin view | Deal won creates a job and folder |
| **P7 Launch** | Data migration, reconciliation, security review, AU project | UAT fixes | Go-live |

## 5a. Backend performance and scalability rules

Applied to every backend change (from your brief): fewer round trips, no redundant loops, reuse and cache what is already fetched, fetch only what is needed, clean and maintainable, no over-engineering, and only measured, meaningful optimizations.

| Rule | How it applies on Catalyst |
|---|---|
| **One query for a list, not one per row** | Batch related rows with `IN (...)` (already done in the jobs service). Prefer one JOIN where ZCQL allows it. Never query inside a loop |
| **Fetch only what the screen needs** | List endpoints return summary columns; detail endpoints return the full row. ZCQL allows 20 columns per query, so wide tables use `SELECT *` or two targeted queries. Always paginate (cap 300) |
| **Reuse within a request** | Resolve the actor once per request and pass it down. Do not re-initialise the SDK or re-read settings inside services |
| **Cache what changes rarely** | `config` cache segment: permission matrix, settings, templates, role lookups (TTL 5 to 15 min, invalidated when admin edits). `kpi` segment: dashboard counts (TTL 30 to 60 s). Person lookup by email cached for the actor |
| **No heavy work on the user path** | Advanced I/O has a 30 s limit: emails, PDFs, CRM and WorkDrive calls, large recalculations run in `events` / `jobs` (15 min), written to the `integration_job` outbox |
| **Idempotent and retryable** | Event and job handlers are safe to run twice; outbound calls use `withRetry` and an idempotency key |
| **Aggregates computed once** | Job hours, cost and completion % are recalculated by one function on change and stored on the job; dashboards read the stored numbers |
| **Measure before optimizing** | Log `ms` per request (done). Add a slow-query log line over 500 ms. Optimize only what shows up there |

### Review of the backend as built (before any change)

| Finding | Verdict | Action |
|---|---|---|
| `resolveActor` runs 1 Catalyst call plus 1 query for the person on **every** request | Meaningful at scale | Cache the person row by email in `config` (short TTL); verify with measurements in P1 |
| `listJobs` 'assigned' path uses 3 sequential queries | Acceptable (batched, no N+1) | Revisit with a JOIN only if timings show it matters |
| Two `catalyst.initialize` calls per request | Negligible cost | Leave |
| `SELECT *` on `job` (39 columns) | Needed because of the 20-column rule | Leave; use summary endpoints later |
| Authz matrix is a constant in code | Fine now | Move to `setting` plus cache in B7 |
| No pagination metadata (`total`) | Minor | Add when the first list screen needs it |

No behaviour changes are made to the existing endpoints from this review; the cache is added in P1 when it can be measured.

## 6. What I need from you before the first line of code

1. Approve or change D1 to D4.
2. Confirm the Zoho OAuth client was rotated (needed for B6, not before).
3. The sender email for system emails (needed for B4).
4. ~~Frontend skills~~ done: `frontend-design` and `web-design-guidelines` installed. Not installed: UI UX Pro Max, Taste, Impeccable, Emil Kowalski, Interface Design (design-direction skills that would compete with the fixed brand), shadcn/ui (we are not committing to it yet), webapp-testing (we already have Playwright through MCP).

### Phase 3 status (2026-11-02, in progress)

| Part | State |
|---|---|
| **Issues (B3 part)** | `domain/issues.js` (statuses Open, In Progress, Resolved, Closed; moves along a fixed list; routing by task type), `services/issues.js` (raise, list, get, update; crew see only their own; managers move them). A checklist answer flagged as a problem raises one issue for the task's department, once, even if the checklist is redone. Issues screen with raise form and status buttons. Checked against Development data |
| **Not started** | SWMS lifecycle and sign-off, hazard library seed, file uploads to Stratus (`file_asset`, signed URLs), email templates and send |
| **Assumptions** | Four issue statuses and the allowed moves, department routing by task type, default priority Normal |
