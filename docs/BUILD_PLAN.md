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
| **SWMS (B3 part)** | `domain/swms.js` and `services/swms.js`. One SWMS is created with each install task (not for minor tasks, subtasks, external or print-only). Status Created, PM Signed, TL Signed, or Not Required when the task is marked not used. The project manager signs first, then the team leader of that task. Edits (site address, PPE that can only grow, work steps) are manager-only and locked once signed. Each crew member adds their own declaration. A team leader cannot finish the pre-job checklist until the SWMS is TL Signed or Not Required (INS-4). SWMS panel on the task page. Checked against Development data, on a phone-sized screen |
| **Not started** | Hazard library seed, SWMS PDF (SmartBrowz availability to confirm), file uploads to Stratus (`file_asset`, signed URLs), email templates and send |
| **Assumptions** | Four issue statuses and the allowed moves, department routing by task type, default priority Normal; "required SWMS status" for the pre-job gate is TL Signed or Not Required; PCBU defaults start empty (the settings table is not built yet) |

### Phase 3 status update (2026-11-02, files and email)

| Part | State |
|---|---|
| **Files (B4)** | `domain/files.js` (allowed types JPEG, PNG, WebP, HEIC, PDF; photos 15 MB, PDFs 25 MB; safe names and keys), `lib/storage.js` (signed links via Stratus), `services/files.js`. The browser asks the server for a 5 minute upload link, sends the file straight to Stratus, then confirms. Access follows the record the file belongs to (task, checklist, issue). Added column `file_asset.is_uploaded`. **Checked against the real bucket**: signed upload returned 200, confirm, list, and a signed download returned the same 70 bytes. Files panel on the task page |
| **Email (B4)** | `domain/notifications.js` (escaped templates), `lib/mail.js` (Catalyst Mail; sends only when `MAIL_FROM` is set), handlers for a new issue (to project managers) and for a task sent back by a reject or reopen (to the people assigned). Skipped and logged when no sender is set. Tested with a fake mailer |
| **Needs you (console)** | 1. Stratus bucket CORS: allow origins `http://localhost:3000` and the hosted app URL, methods PUT and GET, header `content-type`. Without it the browser blocks the upload (the signed link itself works). 2. Mail: verify a sender domain (DKIM and SPF), then set function environment variables `MAIL_FROM` (and optionally `APP_URL`). Production also needs `STRATUS_BUCKET` for its own bucket |
| **Not done** | SWMS PDF (SmartBrowz to confirm), hazard library seed, photo answers inside checklists (the file service is ready; the question type still shows a placeholder), file upload on issues in the UI |

### Phase 4 status (2026-11-02)

| Part | State |
|---|---|
| **B7 dashboard and calendar** | `GET /dashboard`: managers get jobs by stage, overdue tasks, open issues and SWMS awaiting signature (four small grouped queries, cached in the `kpi` segment for 60 seconds and invalidated by date); everyone gets their own upcoming work. Crew never receive company-wide counts. `GET /calendar?from&to`: scheduled tasks, scoped, at most 62 days. "Today" is Melbourne time (override with `BUSINESS_TZ`) |
| **Permission matrix** | `domain/matrix.js` (validation; the admin role can never be reduced), `services/settings.js`. `GET` and `PUT /admin/authz` (admin only) store overrides in `setting` (versioned, logged). Every request loads the matrix from the `config` segment (5 minutes), falling back to the built-in defaults; a damaged value can never lock anyone out. Roles you do not override keep their defaults. **No admin screen yet** (API only) |
| **F2 and F4 frontend** | Role-aware dashboard and a weekly calendar grouped by day, both phone-first. Checked against Development data |
| **Measured** | Dashboard call about 0.8 to 1.0 s through the local proxy, including sign-in checks. The "under 500 ms" target is **not yet verified** on the deployed app with realistic data; the likely cost is the per-request user and person lookups, not the figures |
| **Not done** | Seven separate role dashboards (one shared, role-aware dashboard instead; split further once the real needs are known), kanban board, matrix editing screen, fabrication and install calendars as separate views |

### Phase 5 status (2026-11-02)

| Part | State |
|---|---|
| **People (B5)** | `GET/POST /people`, `GET/PATCH /people/:id`. Managers list people; pay rates and private profile fields are never sent to non-admins; only admins create or edit (email unique and lower-cased; roles validated against the 11 roles). People screen |
| **Compliance (B5)** | `domain/reminders.js` (status Valid, Expiring, Expired, No expiry; offsets fire once each, most urgent only after missed days; renewing restarts them). `services/compliance.js`: list, create, renew; crew see only their own items. 6 placeholder types seeded by `POST /admin/seed-compliance-types`. Compliance screen with add form, soonest expiry first, status colours |
| **Reminder job** | `compliance-due` in the `jobs` function: emails the person (unless they opted out) and the project managers; records an offset as sent only after the email went out, so with no sender configured nothing is lost; a failing item does not stop the rest; expired items leave the daily check. **Checked live**: ran through Catalyst's scheduler in the deployed function, finished SUCCESS in 613 ms, left every item still due (no sender) |
| **Frontend** | Navigation wraps on phones instead of hiding items |
| **Not done** | Creating the recurring schedule (a daily 07:00 Melbourne cron; the job is ready and tested), company and site screens, equipment and chemical registers, weekly reports, editing a person in the UI, per-person compliance view, attaching ticket photos |
| **Assumptions** | Default reminder offsets 30, 14, 7 and 0 days (placeholder types use their own); "do not contact" counts as opted out of email when it holds any text other than false or empty; reminders go to the person and every project manager |

### Phase 6 status (2026-11-02, partly blocked on credentials)

| Part | State |
|---|---|
| **Outbox (B6)** | `domain/outbox.js`, `services/outbox.js`, `drain-outbox` job. Work for other systems is queued with an idempotency key (queuing twice is a no-op, and queuing never breaks the user's action). Failures retry after 1 min, 5 min, 15 min, 1 h and 6 h, then park as Failed. Stored errors are bounded and scrubbed of anything that looks like a token or secret. An integration that is not set up yet (`NotConfigured`) waits an hour with no attempt counted, so nothing is lost while credentials are pending. **Checked live**: the deployed job ran SUCCESS in 573 ms and left the queued CRM update Pending, 0 attempts, "Zoho CRM is not configured" |
| **CRM deal-won webhook** | `POST /webhooks/crm/deal-won` (public route, shared secret in the `x-webhook-token` header, **off with 503 until `CRM_WEBHOOK_SECRET` is set**). A won deal creates one job in Preparation with the deal owner as project manager when the email matches a person; receiving the same deal twice returns the same job. **Checked live** through the Catalyst gateway on Development data: no token, wrong token and a bad body were refused; the first delivery created a job and the second did not |
| **Job stage to CRM** | When a job that came from a deal changes stage, one `crm.update_deal` item (`Job_Stage`) is queued. Checked live: moving the job to In Progress queued exactly one row |
| **Blocked: needs you** | The real Zoho clients (CRM updates and reads, WorkDrive folders, MDM sync) need the **rotated** OAuth client, its AU region details and a Catalyst Connection. The queue, retries, handlers table and tests are ready, so adding a client is one function per integration. Also needed: choose the webhook secret and configure the CRM webhook (URL, `x-webhook-token` header, field names) |
| **Assumptions** | CRM webhook field names (`deal_id`, `deal_name`, `owner_email`, `description`, `quote_ref`, `expected_finish`) and the CRM field `Job_Stage`; shared-secret header rather than a signature (CRM native webhooks can add a header, signing needs custom Deluge); retry delays above |
| **Not done** | Real Zoho calls (see Blocked), cost fields pushed to the CRM deal, sign edits to the CRM Assets module, WorkDrive folders per task, MDM sync, an outbox admin screen, the recurring schedule for `drain-outbox` |

### UI refresh (2026-11-02): the prototype's layout and UX on our brand

Kalyani's prototype (`react-app/`) is the reference for layout and interaction; the brand colours and the Raleway font stay ours. What was adopted in `web/`:

| Area | What changed |
|---|---|
| **Shell** | Charcoal sidebar with icons, the signed-in user and sign out at the bottom; top bar with search (Ctrl K) and a light and dark theme toggle (remembered, follows the device by default); the sidebar becomes a drawer on phones |
| **Design system** | One stylesheet with light and dark tokens; page header with a green eyebrow; bordered cards; KPI tiles with coloured top edge and numbers that turn red when something needs attention; square tone-based status chips; tables that become stacked cards on phones; toast messages after actions |
| **Screens** | Dashboard, Jobs (with filter and search), Job (progress ring), Task, Checklist, SWMS, Files, Issues, Compliance and People all rebuilt on those components. The Calendar is now a month and week grid with an agenda list on phones, coloured dots by task type and "+N more" |
| **Kept ours** | Colours, Raleway, real Catalyst sign-in, real role-based access. Not copied: her demo sign-in, the "Viewing as" role switcher and the notification bell (they need a backend we do not have) |
| **Accessibility** | Dark text on the green buttons (white on this green fails contrast), visible focus rings, labelled controls, status always shown as text as well as colour |

### Phase 7 status (2026-11-02, preparation only)

| Part | State |
|---|---|
| **Security review** | Done on the whole branch. One finding (a read-only viewer could attach files to any issue), fixed and covered by a test. Everything else checked held up |
| **Go-live plan** | `docs/GO_LIVE.md`: what is needed from you, how the AU project is built, environment variables, schedules, connections, the migration rules and reconciliation report, UAT by role, cut-over and rollback, the assumed business rules, and the known gaps |
| **Not started** | The migration script itself (needs the Creator data export), the AU project (needs you to create it), schedules, real Zoho connections (need the rotated OAuth client) |

### Type scale (compact, 2026-11-02)

Raleway only, weights 400, 600 and 700. Body 14px; page title 22 to 28px; card and table headings 11 to 12px in capitals; table cells 13px; buttons 12.5px (11.5px small); status chips 10.5px; big numbers 28px; sidebar items 12.5px in capitals. On phones, buttons and fields stay 44px tall so they are easy to tap. Figures use Raleway's normal numerals.

### Sign-in page (2026-11-02)

The page follows the prototype's layout (brand panel with icons, theme toggle, labelled field, full-width green button, green forgot-password link), in our colours and Raleway, light and dark. The form itself is still Catalyst's real login. Its look comes from a stylesheet Catalyst loads inside the form (`css_url`): `web/login-frame/build.mjs` joins Catalyst's default sheet (`embedded_signin.base.css`, unchanged) with our overrides (`overrides.css`) and writes `public/css/login-frame-light.css` and `login-frame-dark.css`. After editing the overrides run `node login-frame/build.mjs`. Works on the deployed Development site without any console setting. The frame sets its own `color-scheme` (otherwise the browser paints a white backdrop in dark mode). The password step, the forgot-password page and the one-time-code steps use the same sheet but were only checked for the email step and the "account does not exist" error, because I have no test password.
