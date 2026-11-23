# Visual Exposure - Session handover

Branch `feat/backend-foundation`, merged into `main` (fast-forward, both on GitHub). **Last deployed to Catalyst Development on 23 Nov 2026** (`bd97252`, the Admin fixes, the whole-app and crew-role sweep fixes, the Equipment button row and Karthick's Catalyst Mail change, branch = main = Development): api, jobs, events and the web client, with a plain `catalyst deploy` (the variables already in Catalyst were left as they were). There is no Production or AU project yet (owner decision 3 Nov: finish on this Development project, review with the client, then move to AU). The account is the **free plan**: see `docs/REQUEST_BUDGET.md`. Usage seen on 11 Nov: Cache get 541/1000 (tightest), Data Store fetch 4272/10000, update 298/1000, insert 162/5000, Mail 0/100. Detail of the Creator comparison is in `docs/DS_COMPARISON.md`; `docs/DS_CHECKLIST_RULES.md` has the checklist role rules.

## 0d. 23 Nov 2026 (Kalyani's session, later): Admin fixes (merged to main and deployed to Development, `3eccd98`)

Reported: layout issues, and the Admin > Permissions role list showed module names. Fixed, one commit each, backend tests 386 pass, web tsc/oxlint/build pass, checked by screenshots of every Admin tab at desktop and phone width:
- **Role names** (`34cf960`): the role list comes from the fixed role list, not the matrix keys (the local mock sent the matrix area -> role, so the list showed "jobs", "tasks"; the mock now uses the real `lib/authz.js` defaults and saves). Companies and hours areas were missing from the table. One set of names, `lib/config.js` `ROLE_LABELS` and `web/src/lib/roles.ts`, replaces eight "_ to space" copies ("Second IC", "Administrator").
- **Layout** (`aae5e0e`): no empty strip under closed cards (Admin > Emails), Admin tabs in one sideways-scrolling row on a phone, Settings manager boxes aligned to the top, spacing for card notes, long CSV headings wrap.
- **Whole-app sweep, later the same day (deployed to Development, `db0b7a4`)**: every page and every tab at desktop and phone width, checked for raw codes, raw dates, sideways scroll and overflow. No raw codes left. Fixed: Equipment dates and task/issue history times were raw (history in UTC) (`37d3d18`); job header squeezed on a phone, Task board List/Board switch cut off on a phone, form dropdowns wider or narrower than their field, "Choose a primary role" shown on the empty Add a person form, lower-case calendar view names (`cab99e0`). Only the admin role was swept; crew roles see fewer pages.
- **Crew roles sweep (deployed to Development, `bd97252`, with the Equipment Action buttons on one line)**: the same check as installer, second IC, fab worker, workshop, viewer and the three managers. No raw codes, raw dates or sideways pages for any role. Fixed (`d957d8c`): add job, edit job and add person showed a bare line instead of the No access page; another person's page said "Could not load" when the server refuses crew; Fab variance was in the installer menu but always empty; a viewer's dashboard linked to SWMS and Hours, which a viewer cannot open, and showed a to-do list of actions a viewer cannot take. The mock now works out the dashboard and permissions as the server does (`823b45b`): before, a viewer got the crew dashboard and a second IC could not edit jobs, unlike Development.
- **Plain words** (`6b69f8a`): Email log and Outbox show "New issue", "Nobody to send it to", "Update the CRM deal" and readable dates instead of codes (`web/src/lib/systemLabels.ts`).

## 0c. 23 Nov 2026 (Kalyani's session): code review and fixes (merged to main and deployed to Development, `935310b`)

A read-only review (backend, web code, CSS) found the code clean but not ready for a year of real data. Fixed, one commit each, tests for each backend change (386 pass), web tsc/oxlint/build pass:
- **A, bugs**: the task page now refreshes after a stage move (`c686784`); "today" is the Melbourne date on every screen, not UTC (`65df560`, `web/src/lib/dates.ts`).
- **B, the 300-row cap** (a ZCQL SELECT returns at most 300 rows; several places took that as everything): new `lib/paging.js` `fetchAll` reads page by page (one fetch under 300 rows, ceiling 3,000, flags `truncated`), with a unique ROWID order so paging never skips rows. Jobs list (`af7e7b4`), hours and pay totals (`ab7f94e`), a person's tasks, crew lists and finished post-job checklists (`6b00ecc`), role tiles and task/issue boards (`c253c24`, open tasks in full, the newest 300 finished), job progress via `listByJob` (`dd4ffbf`). The test fake now honours limit/offset.
- **C, request savings**: hourly CRM sync writes only when deals changed (`c4829a5`, was about 720 of 1,000 updates a month); events with no handler are not sent, `file.deleted` registered (`b9ca443`); one email per checklist for all the issues it raises (`c63a9b4`); pages stop loading unused data, compliance status filter in the browser, 30 s default staleTime, `/me` once (`bab71f8`).
- **D, cleanup**: about 225 lines of unused CSS (`e77a5ef`); focus outline uses `--brand`, fab badge in dark mode (`0289209`); unused web code removed (`130dbbb`); People "Set expiry" uses `lib/validity` like the person page (`1b609fe`); type gaps closed (`3c48ebd`); one `lib/json.js` parseJson for ten copies (`518138d`). CSS removals checked by 54 pixel-identical screenshots (19 pages, light/dark, desktop/phone).
- **Not done (lower value or needs a decision)**: SWMS list, checklists report and some issue views still show at most 300 rows (plain lists); per-row writes when creating a task with crew and in imports; later CSS blocks that override earlier ones (merging needs a visual check); the add-ticket form written three times; `Equipment.tsx` (589 lines) could be split. **Owner decision (item 8)**: every checklist answer is one Data Store update, which real use would push past the free plan's 1,000 a month: save per section, or a paid plan for production.

## 0b. 18 and 19 Nov 2026 (Kalyani's session): merge to main, deploy, layout and accessibility

**18 Nov**
- Checked the 63 branch commits against Karthick's `CLAUDE.md` (pasted in chat; not yet in the repo), then fast-forwarded `main` to the branch. The two old local commits on `main` from 6 Nov (react-app only: jobFields, ui-kit) were not merged; web already has both. They are kept on the local branch `local-main-6nov`; local `main` now follows `origin/main`.
- Brand green: tried `#68b04d` (as `CLAUDE.md` says), the owner preferred and kept `#22c55e`. `CLAUDE.md` section 6 should say `#22c55e`.
- TSK-6 screens (`f742ad8`): Notes card on the task page (crew on the task and managers, also when finished; the server allows field roles notes only). `notes` and `description` are separate task columns (checked in the live table); the box that saves `description` is now labelled Description. Manage form refuses a scheduled date after the required finish before saving.
- CMP-1 (`23cffe7`): People > Subcontractors shows each company's document count; the button opens Company documents filtered to it (no new request).
- Deployed to Development. The Catalyst CLI is now logged in as karthickbalai (was kalyanimhala54); the folder has no `.catalystrc`, so deploy with `catalyst deploy --org 60093485853 -p 105747000000013075`. API health OK; live bundle matched the local build.

**19 Nov (merged to main and deployed to Development, `a4cbab2`)**
- Person page crashed on the mock (no profile route); card now treats a missing field list as empty, mock serves the profile (`f205922`).
- Layout (`6a18486`): overflow scan 25 routes x 7 sizes x 2 themes = 350, none flagged; a new clipping scan found the job form kept 3 columns on phones (now 3/2/1 by width), the job page pair cards had a 420px minimum (now capped at the screen), Equipment Status cut "Out of service" (column 150px).
- Accessibility (`eda5a23`): own script (axe could not be downloaded), 23 pages, both themes. Names, labels, alt text complete; focus visible. Light-theme text colours darkened to 4.5:1: `--muted` `#556378`, `--brand-strong` `#166534`, `--link` `#2563eb`, `--info` `#0369a1`, `--danger` `#b91c1c`; bell badge `#dc2626`; sidebar role in light green; Completed - Closed `#2f6fca`. Left on purpose: white on the green buttons (owner decision) and faded other-month calendar days.
- ManageEngine MDM device sync, EQP-4 (`f43dccd`, `a4cbab2`): read-only MDM client (`lib/integrations/mdm.js`, scope `MDMOnDemand.MDMInventory.READ`), sync plan and service (`lib/domain/mdmSync.js`, `lib/services/mdmSync.js`: matches MDM users to people by email, only people with "In MDM" ticked), `mdm-sync` job, `POST /admin/mdm/sync`. Screens: MDM row and "Sync devices from MDM now" in Admin > Integrations, "Sync from MDM" on Devices, "In MDM" tick on the worker form. Off until `MDM_REFRESH_TOKEN` is set (`node scripts/zoho-token.mjs --mdm`, then `npm run deploy:env`); set-up steps in `docs/GO_LIVE.md`. The location response shape is checked against the docs only, until the first real sync.
- Tests 373 pass; web tsc and build pass.
- 20 Nov: checked the remaining-work list against `docs/FSD.md` and the code (see sections 4 and 7). No backend item is open on our side; the FSD items not built wait for the client.

## 0a. 17 Nov 2026 (Kalyani's session, later): FSD audit and Phase 1 task rules

**Direction (Kalyani, 17 Nov):** web/ (Karthick's app) is the final application; react-app is reference only. Work is driven by `docs/FSD.md`. A full FSD check (every numbered requirement plus sections 5.12 to 14, in code, not from the status docs) gave six phases: 1 task rules, 2 missing emails, 3 admin/compliance/equipment, 4 screens (role dashboards and more), 5 integrations (CRM fields, Assets, Sites, WorkDrive per task, store SWMS PDF), 6 go-live (crons, concurrency, CI, migration). Blocked on the client: email sender, Stratus CORS, Creator export, MDM credentials, checklist and SWMS wording, the ~18 hidden issue fields and 5 print layouts, CRM field names, FSD questions 2, 6, 8, 9, 10, 12, 13, 15, 17, 20, and training-portal passwords vs CMP-5.

**Phase 1 done** (`f394a69` to `b1bdb64`, pushed, not deployed; one commit each, backend test for each rule; screens use existing components only):
1. Close task for External Install / Print Only now appears (`taskRules.stageOptions`); before, the server allowed it but no button was offered (INS-6).
2. Scheduled needs a date and a team leader (date only for close-only kinds); design Assigned needs someone on the task (`readinessProblem`, 409 not_ready) (TSK-3, DES-1).
3. Cancel / Not used / Reset assignment take the crew off with their unfinished checklists (finished kept); Cancel also clears the date and sets quoted hours to 0 (`cleanupFor`). New design move Assigned to To be Assigned (TSK-2/3).
4. A reason is required for On Hold, Cancelled, Complete - Not Used and a reset. Job page menu opens the task page with the reason form ready (`?move=`).
5. Job page: the close strip no longer promises to close with tasks in Manager Review (the server refuses); Close job now asks first (JOB-5).
6. Checklists offered per kind: none for External Install / Print Only, post only for Workshop (`checklistPhases`) on server, next-step and task page.
7. Checklist photo questions upload in place (to the checklist, answer = file id); post-job shift form shows the pay split, confirms over 14 h, refuses over 16 h or unbilled over worked.
- Tests 329 pass; build passes; oxlint 0 errors (10 accepted warnings). The running mock (PID 15392) predates these changes: restart it to see them. The mock has no file upload routes.
- **Assumption to confirm:** Cancel removes unfinished checklists (Creator kept them, WORKFLOWS section 5 [CONFIRM]); chosen to match the existing "taking someone off a task" rule.
**Phase 2 done** (`9cd5032` to `30050ae`, pushed, not deployed; emails are logged and skipped until MAIL_FROM is set):
1. "Install / Fabrication / Design Task Approval" to the job PM (install, design) or fab manager (fab) when a task reaches Manager Review; nobody on the job means everyone in that role.
2. An approval flagged "needs management review" or OH&S Yes emails the task department's manager and inform-also list (issue routing in Admin settings). The stage-change event now carries the approval answers.
3. Closure report: admins (directors) get hours per trade, labour cost all / Parent / Fab, purchases, and CRM revenue and profit (Total_Revenue, Job_Profit, Job_Profit1); the job PM and fab manager get hours only (JOB-9). Sent once as before.
4. Mock API: Admin > Emails lists and previews the real templates (12).
- **Not built on purpose:** the "profit changed" email. It is INACTIVE in Creator, and FSD section 8 rule 4 says inactive emails need client confirmation (FSD question 8). Also needs confirming: "directors" = admin role (FSD question 14), and the CRM deal field names.
- Tests 331 pass; oxlint 10 accepted warnings.
**Phase 3 done** (`3e21869` to `2dda232`, pushed, not deployed):
1. Admin settings: "also informed" tick list per department (the server already used it).
2. "Expiring" uses each item's own window everywhere (type's reminder days, else Admin's "Reminder days before expiry", else defaults): chips, compliance dashboard, to-do ("expire soon"), reminder emails. Count field renamed within30 -> expiring.
3. Do-not-contact: per item {worker, managers} (two ticks on the record form; older plain values still mean "not the worker") and per company (tick on the company form). Nobody left to tell: the reminder counts as handled.
   Fixes: company reminders now use the company email field (the old contact JSON was never filled, so companies were never emailed); the seed saved document types as "document" instead of "company_document", so they could not be attached to a company. Seed fixed, and Admin > Compliance types > "Load the starter types" repairs saved rows. **Run that once in Development** (one update).
4. Admin > Compliance types: add and edit ticket, induction and document types (POST/PATCH /compliance/types, admins; unique names; a used type keeps its kind).
5. Equipment: Edit (status incl. Off hire, Responsible person in item data), history of every edit and "Checked today" (GET /equipment/:id/history). Chemicals: Edit with supplier, stock and unit. Locations: area supervisor.
- Mock API gained: company, chemical, equipment and compliance type edit routes, location supervisor, item flags.
- Not done: a person-level do-not-contact needs a new person column (Catalyst console / MCP); location delete; equipment history is not written by the automatic off-hire switch (EQP-2) or maintenance tasks.
- Tests 337 pass; oxlint 10 accepted warnings.
**Phase 4, FSD-required only** (`605313d` to `18f22d4`, pushed, not deployed). Kalyani (17 Nov): build only what the FSD needs and the client does not have to approve; optional react-app extras wait for the client review.
1. Role dashboards (5.12) under the tiles: PM, Fab Manager (Create Workshop Task, FAB-5), 2IC, Install Coordinator (pay-period buttons: Hours reads ?view=this|last), Installer, Fab Worker, Workshop (Create Workshop Task, overdue checks). One shared calendar request per page; tables are list requests cached a minute.
2. Job page (JOB-3): Overdue always shown and "% Complete" per discipline (design % added to progressFor, shown only).
3. FAB-2: GET /jobs/:id returns fab tasks in groupAndSort order.
4. Add task (TSK-6, JOB-4): location, sign group, cost type, fab spec, crew (designer for design). POST /jobs/:id/tasks accepts spec and crew; with date and team leader it starts Scheduled (design with designer: Assigned) through the normal move (TSK-3).
5. INS-2: install sub-stage shown on the task and job pages (no "Team Briefed", no automatic stage moves: client).
6. Calendar Day view. 7. Fab lists grouped by sign group (task detail carries sign_group_name). 8. Devices: Workers view, with / without a device (device list carries personId).
- Tests 340 pass; oxlint 10 accepted warnings. Mock now runs as project_manager (MOCK_ROLES) to show a role dashboard.
- **Left for the client review (optional, not FSD):** bulk task actions, job activity feed, job On Hold / Cancel by hand, hours-not-filled list, compliance "Not filled in" rows and clickable tiles, task delete from the app.

**18 Nov: Phase 5 checked, Phase 6 started** (`abb207a`, pushed, not deployed).
- Phase 5 (integrations) is blocked on the client except one guess: task WorkDrive folders need the CRM Deal fields that hold the Design / Fab / Install parent folders (FSD 5.15) and FSD question 6 (subtask folders). CRM Deal / Assets / Sites pushes need the field names. SWMS PDF is already served by `GET /swms/:id/pdf`.
- Phase 6, optimistic concurrency (FSD section 10): task details, task manage and job forms send only changed fields plus `expected` (the values first shown); `PATCH /tasks/:id` and `/jobs/:id` answer 409 `changed_elsewhere` when another save changed one of those fields. Compared by field, not MODIFIEDTIME, so booked-hours or stage updates never block an edit. Fab spec edits now merge (only sent keys change). Helpers: `lib/domain/concurrency.js`, `web/src/lib/editDiff.ts`. Tests 345 pass; build passes; oxlint no errors.
- Same check on issues and SWMS (`455e7d7`): issue dialog sends `expected`; SWMS form sends only changed fields; stored JSON lists compared whole.
- Create actions run once (`2e31bc0`, `lib/idempotency.js`, `once()` in `functions/api/routes.js`): the same person, address and fields within 2 minutes gets the first answer, a copy still running gets 409 `in_progress`, a failed create leaves no mark. Claim = a cache put that fails if the key exists, so no cache get on the normal path. Not on subtasks (no fields). Needs `npm run sync` before deploy (done locally).
- CI (`d9f001c`, `.github/workflows/ci.yml`): backend tests and web build and lint on every push and PR; no deploy step on purpose. `gh` is not signed in on this machine; run status read from the public GitHub API.
- Tests 350 pass. Phase 6 left: crons checked 18 Nov via the Catalyst MCP (account karthickbalai, org 60093485853): all five exist, are enabled and ran with status 200 (GO_LIVE.md section 4), Creator migration script (needs the client's data export).

**18 Nov, later: small backend items and layout checks** (`1a53fbe` to `910031b`, pushed, not deployed).
- Site Code on sites (contacts JSON, no column). SWMS Work Activity: **new column `swms.work_activity` (text) added in Development via the MCP**; add it in AU too. Equipment history now records automatic off-hire, the daily maintenance run and finished maintenance tasks (with a reason, "Automatic" when no person). Workshop location delete (admins, refused while equipment/chemicals are there). Hours pay split columns Single / x1.5 / x2 / No times (from the stored split; plain hours = No times), in the totals row and CSV.
- Not built on purpose: rating role (owner decision: not stored); site contact from the CRM site (needs CRM field names); person do-not-contact (needs a person column; ask first).
- Layout scan (scratch Playwright on installed Chrome, mock only): 22 pages x 7 sizes x light/dark = 308 checks, now 0 flagged. Fixed: job page measured 825 px too wide (sr-only label escaping .table-wrap; .table-wrap is now position: relative). Sidebar overflow from the earlier audit is gone. Duplicate CSS rules merged (issue board padding, card-with-grid flex).
- Still open (owner decisions, not changed): heading scale; brand green #22c55e vs #68b04d; collapsed sidebar look; Home content. Real-data checks of checklists, map, timeline, variance still need the deployed site.
- Tests 352 pass; build passes; oxlint 0 errors. The Catalyst MCP is connected (account karthickbalai); see the memory note before using it (List_All_Functions returns secrets).

**18 Nov, last: backend items I could finish alone** (`71430fc` to `ccc932f`, pushed, not deployed).
- Stratus CORS checked in Development with a preflight from the app address: allowed (PUT, GET, HEAD, content-type); other origins get 403. Project CORS domain list is empty, which is fine (the app and api share one domain). Check AU the same way (GO_LIVE.md step 5).
- `tests/scheduled.test.js`: the five live crons run through the job registry as the system (admin, no person), as Catalyst runs them; each cron's job name is known and handled.
- CRM site contact, off until the client sends field names: fill `SITE_CONTACT_FIELDS` (and `CRM_SITE_MODULE` if not "Sites") in `lib/domain/crmSite.js`. Then `POST /sites/:id/crm-refresh` fills only mapped, non-empty fields. No button in the web app yet.
- Person do-not-contact, ON (owner approved): **new column `person.do_not_contact` (text) added in Development via the MCP; add it in AU too** (with `swms.work_activity`). Tick on the worker edit form, shown in the worker details. The person gets no compliance reminder (managers still do). Switch: `FEATURES.personDoNotContact` in `lib/services/people.js`.
- Pre-deploy dry run: `npm run sync`, 362 tests pass, all three functions load, web `tsc` and build pass, oxlint 0 errors (10 old warnings). `deploy:env:check` not run (it reads `.env`); run it yourself before deploying.

## 0. 17 Nov 2026 (Kalyani's session): react-app ports, batch 1

Compared every open item of `docs/REACT_APP_EXTRACTION.md` (and the demo's last two commits, `acf7309` and `37cbab7`, which were never pushed) with web. Built the 11 small ones, one commit each, all pushed to `feat/backend-foundation` (`1572468` to `b13cd44`). **Not deployed.**
- J10 Edit a sign (prefilled dialog); Version Number limit now 20 like the server.
- H4 Hours "Final" column, total, tile and CSV field. H2 live pay split for timed shifts (`web/src/lib/payRules.ts`, a copy of `lib/domain/payRules.js`, checked identical over 159,600 shifts) and the 14 h / 16 h / unbilled checks for timed shifts.
- P7 crew see Compliance as "My tickets & inductions".
- B1 column sets on the jobs list. B5 labour cost (all, Parent, Fab) in the job page section headers for admins: **backend change**, `GET /jobs/:id` now returns the same per-trade hours and costs as the list (shared `tradeTotals`, no extra query; new test).
- I2 photos and files on issues. I3 "Raise issue" on the task page (linked task, its department).
- E4 location edit and equipment/chemical counts (delete not built). D3 calendar type filter. S2 Auto theme and "Show in menu".
- Mock API: PATCH /signs/:id, POST and PATCH /locations, job page totals, issue task_id. **The mock that was already running (PID 15392) predates these; restart it** (`node web/dev/mock-api.mjs`); stopping it was blocked by the permission check this session.
- Tests: backend 324 pass (run as `NODE_PATH=functions/api/node_modules node --test "tests/**/*.test.js"`: the root has no node_modules, which is why a plain `npm test` reports 28 "Cannot find module 'zod'" failures); `npm run build` passes; oxlint 0 errors, the 10 accepted warnings.
- Next (batch 2, each needs a small backend change, see the extraction doc): J8 reasons for hold/cancel, J9 delete task, J7 bulk task actions, H3 hours-not-filled list, P4 missing compliance rows, E2/E3 equipment and chemical edit, D2 dashboards, D4 checklist register, B4 job cards on phones. Owner decisions still open: H1 shift clock (needed at all?), how many tasks at once for bulk actions.

## 1. Completed work
- **Earlier (see git log since `d22095d`)**: Creator DS comparison (68 forms, 423 workflows, 186 reports); confirm and message dialogs; Jobs grid columns and cost type; SWMS numbers, hazard wording and PM Completed/Closed; Issues fixes; directory fields and rates; personal details by role and encrypted portal logins; past-shift times on Hours; two checklist emails.
- **Earlier this sprint (committed)**:
  - **Calendar timeline**: third view, fabrication bars from scheduled date to required finish (red when late). `/calendar` items carry `required_finish`, no new request.
  - **Fab variance report**: page `/variance` and `GET /reports/fab-variance`, booked minus quoted hours per task and job; two queries at most, capped at 300.
  - **Hours**: day-column widths now persist (`GridColumn.widthKey`).
  - **Checklists**: real Creator wording and the team leader / member split for install and fab, pre and post (templates v2), and install post-job v3 where a Yes to the management review raises an issue (owner answer; from the Creator workflow). All yes/no questions stay mandatory.
  - **Devices**: List / Map toggle; the map is Leaflet 1.9.4 with OpenStreetMap tiles (owner approved the library), pins by initials, grey when stale.
  - **Verified in Development**: the new columns, and on the deployed site the profile and portal login save, read back and are logged.
  - **Deploy**: functions and client deployed twice, smoke-tested (app 200, unauthenticated API 401).
- **Redesign, step 1 (UNCOMMITTED, this session)**: type scale added to `tokens.css` (`--fs-2xs` 11px … `--fs-xl` 18px; `--fw-regular/medium/semibold/bold`). In `global.css`, 166 `font-size` and 100 `font-weight` declarations now use these tokens. Values unchanged, so no visual change yet. `.side-nav` got `overflow-x: hidden`.

## 2. Modified files
- Committed earlier: backend `lib/services/{dashboard,reports}.js`, `lib/domain/reports.js`, `lib/seed/checklistTemplates.js`, `functions/api/routes.js`; tests `tests/reports.test.js`, `tests/checklistTemplates.test.js`; web `pages/{Calendar,Variance,Devices,Hours}.tsx`, `components/{DeviceMap,GridKit}.tsx`, `App.tsx`, `navConfig.ts`, `api/{queries,types}.ts`, `package.json` and lock (Leaflet), `dev/mock-api.mjs`; docs `docs/DS_CHECKLIST_RULES.md`.
- **Uncommitted, this session**: `web/src/styles/tokens.css`, `web/src/styles/global.css`, and this file.
- Not committed on purpose: `CLAUDE.md` (untracked), `ref-image/` (client screenshots, never push).
- `functions/*/lib` are generated copies (git-ignored): run `npm run sync` after any change in `lib/`.

## 3. Current implementation status
- Built, tested and deployed to Development (the deployed build predates the uncommitted CSS changes). Almost all of it has run only against the fake test database and the dev mock; the real Data Store has had the schema checks, the encrypted-column check and template rows only.
- **Database changes in Development (via the MCP)**: columns `swms.swms_number`, `time_entry.start_time/end_time/break_minutes`, `compliance_item.portal_login`, `person.profile_private` (both encrypted text, 10,000 chars, so the database encrypts them and no key is in `.env`); 10 new rows in `checklist_template` (v2 x8, v3 install post x2). The seed route would skip them. Test rows were deleted.
- Older checklist rows (v1) remain; new checklists use the highest version, open ones keep their own.
- The dev mock has no routes for profile, portal login, company rates or PATCH of companies and sites.
- **Frontend redesign audit (started this session, mock only)**: at 1366×768 no page scrolls sideways. Jobs, Hours and Equipment scroll inside the table (pagination below, intended). Issues nests a column scroll inside the board scroll. Compliance has an inner vertical scroll. `.side-nav` still has content wider than its box, source not yet found. Still open: 14 off-scale headings (17/20/24/26/28px and three `clamp()` values), duplicated overrides for `.issue-board` and `.grid-wrap` in several places in `global.css`, zoom checks (75–150%), tablet, phone and dark-theme checks, before/after screenshots.
- **Dev servers**: the mock API (port 3100) and Vite (port 5173) were already running from an earlier session. A second Vite on 5174 was started by mistake and is still running; stopping it was blocked by the permission classifier. Stop it manually (find the PID on port 5174) or leave it.

## 4. Remaining bugs and gaps
- **Font**: done. The app uses Inter (`--font: 'Inter'`, `@fontsource/inter`), as `CLAUDE.md` says.
- **Not yet tried with real data**: the new checklists on the live site (leader vs member, management review issue, the INS-4 SWMS gate), the Devices map with real device locations (needs the MDM trial), timeline and variance.
- **Assumptions**: variance is booked minus quoted hours and relies on `booked_hours` being kept current; Parent/Fab labour cost (sum of task labour cost by Cost Type) shows zero until managers set a Cost Type; existing SWMS stay unnumbered.
- **Checked against the FSD (20 Nov)**:
  - Built (an earlier list here said otherwise): Site Code, SWMS work activity, the Hours pay split columns (HRS-2, 18 Nov), the pre-job SWMS gate (INS-4, `lib/services/checklists.js`, 409 `swms_required`; not yet tried live).
  - Not an FSD requirement: Job Overview pivot charts (FSD section 12 drops the hidden pivot reports); Minor Task / Workshop checklist variants (Workshop skipping pre-job is FSD question 5, [CONFIRM]); fab post-job raising an issue (CHK-5 says "can"; no client rule supplied); the install issue subject wording.
  - In the FSD but blocked on the client: CRM push of signs (Assets) and sites, WorkDrive folder rename and per-task folders (FSD 5.15; need the CRM field names and FSD question 6), site contact from the CRM site.
  - Owner decisions: rating role not stored; Job Owner fields hidden.
- **Accepted lint warnings**: "fast refresh" notes (several, including `GridKit.tsx`, `Login.tsx`) and `set-state-in-effect` in `Admin.tsx` and `AdminMore.tsx`; fixing them means restructuring shared components or admin screens for no user benefit. The exact count changed this session; no errors.
- **Older items**: real job service may not return `parent_id` for grouped task tables; "My open" differs from Creator; Issues summary tiles take two rows; SWMS "My open" is empty for the test login; "Group by job" not browser-tested; the dev mock shows the old task stage after a transition and resets on restart.
- **Security note**: ZCQL and the MCP read the encrypted columns decrypted, so anyone with Data Store access can read portal passwords.
- **Tooling**: the context7 MCP server failed to connect (timeout) this session. No new skills, plugins or UI libraries were installed.

## 5. Tests executed and results
- `npm test` (backend): **314 pass, 0 fail** (before the last deploy). Not re-run this session; no backend files changed.
- This session, frontend after the token edits: `npx tsc -b` pass; `npm run build` pass; `npx oxlint src` no errors (warnings only, as above).
- Browser (mock API, desktop 1366×768): overflow scan across 13 routes, script-based. Used the mock only; **no Catalyst requests this session**.
- Earlier browser checks (mock, desktop 1366 and phone 390): timeline, variance, Devices list and map toggle, Hours column-width persistence.
- Catalyst MCP (Development): write, read back and delete of test rows on all new columns; template rows read back; profile and portal login checked after saving through the deployed app, then cleared.
- Deploy smoke checks: web app 200, unauthenticated `/reports/fab-variance` 401; no `env_variables` left in the function configs.

## 6. Important decisions
- Finish on Development first, client review next, AU project later; add the new columns to AU first when it is created.
- Free plan: use unit tests and the mock before the real Data Store; use the MCP only when the real database is the point and say the request cost first; no polling, no per-row requests, no test emails.
- Checklist issue-raising: only the install management review "Yes" (a Low priority issue, once per task, for the installation manager). All yes/no questions mandatory.
- Rating stays as built: managers rate crew on completed tasks, scale 1 to 5, role not stored.
- Device map: a real street map in the web app (Leaflet and OpenStreetMap approved), toggle with the list.
- Earlier: SWMS Completed and Closed by the project manager; company rates and portal logins managers only; personal details by role; Job Owner fields hidden; schema changes only additive, in Development, via the MCP.
- Redesign (owner request, this session): audit first, then a foundation step (type tokens, scroll fixes) with screenshots, then module-by-module passes, each reviewed before the next. Owner declined a whole-app pass. Typography stays on the existing tokens; no heading-scale change until the owner decides.
- Process: commit and push every change; deploy only when the owner says; never read `.env`; the owner's own edits are committed only when they ask.

## 7. Exact next step

**Current (23 Nov 2026).** The review fixes (section 0c) are deployed to Development (app 200, API health ok, protected routes 401, live bundle = local build). Item 8 (owner, 23 Nov): no paid plan for now, stay on the free plan. Checklist answers are saved one update per answer (`useSaveAnswers` in `ChecklistPage.tsx`): fine for the demo, but before crews use it daily, batch the saving (the `PATCH /checklists/:id/answers` endpoint already takes several answers, so it is a web-only change). Otherwise no build work is open on our side.
1. **You, set-up**: MDM trial with a test phone and the read-only token (`docs/GO_LIVE.md`); rotate the exposed keys (Zoho OAuth secret and refresh token, Gmail app password, CRM webhook secret); recreate `.env` (none in the folder now) and run `npm run deploy:env` with every variable. Email goes through **Catalyst Mail only** since Karthick's `7f22b25` (deployed 23 Nov; SMTP and the Gmail app password are no longer used): `MAIL_FROM` must be set on the api, jobs and events functions to an address on a domain verified in Catalyst Mail, or every email is logged as skipped "No sender address set up" (Admin > Email log). Check that the people on Development have test or team addresses.
2. **You, on Development**: pre-job checklists as leader and member (including the SWMS gate), post-job with management review Yes (issue appears?), Devices map after the MDM sync, timeline and variance.
3. **Decided 19 Nov (owner): leave as they are**: white text on the green buttons, the collapsed sidebar look, the Home content. Ask Karthick to set `#22c55e` in `CLAUDE.md` and push it.
4. **Client**: CRM field names (unblocks the CRM push and WorkDrive folders), the open FSD questions (section 14); then the review on Development. Checklist and SWMS wording (owner, 20 Nov): the sample wording stays for the POC demo; when the client sends their questions, hazards and briefing points, we load them (data only) and build "Team Briefed". The Creator data migration is client-side.
5. Then the AU move (`docs/GO_LIVE.md`), with the columns `swms.work_activity` and `person.do_not_contact`.
6. Optional frontend tidy-ups: 14 off-scale headings (owner has not decided the scale), zoom and tablet checks.

**Older list (17 Nov, mostly done: Inter is in use, the layout checks ran):**
1. **You, decide**: (a) Inter or Raleway: `CLAUDE.md` says Inter, but the code still uses Raleway. Confirm Inter, then I switch `--font` and the package. (b) Heading scale: collapse the 17/20/24/26/28px headings to one ramp? (c) Tooling: Context7 failed to connect; you said install the missing skills and Motion, but nothing is installed yet. Confirm which. (d) Commit the uncommitted type-token step now?
2. **Me, next**: fix the `.side-nav` horizontal overflow, merge the duplicate `.issue-board` and `.grid-wrap` rules, then run the zoom (75–150%) and tablet checks with screenshots.
3. **You, live site (from before)**: start an install or fab pre-job checklist as a team leader and as a member (the right questions each?), finish an install post-job one with the management review set to Yes (does an issue appear?), and open the Devices page. Send anything that looks wrong.
4. **You, rule (from before)**: pick the next small backend item: Site Code, SWMS work activity, site contact from the CRM, or the Hours pay split; and say whether fab post-job should also raise an issue on the management review.
5. Then the client review. Redeploy only when asked: `npm run sync`, `npm test`, `npm run deploy:env`, `cd web && npm run build`, `catalyst deploy --only client`.
