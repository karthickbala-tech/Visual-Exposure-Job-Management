# Visual Exposure - Session handover

Branch `feat/backend-foundation`. Last pushed code commit `f2845fd`. **Deployed to Catalyst Development on 11 Nov 2026**: api, jobs, events (with the `.env` variables) and the web client. There is no Production or AU project yet (owner decision 3 Nov: finish on this Development project, review with the client, then move to AU). The account is the **free plan**: see `docs/REQUEST_BUDGET.md`. Usage seen on 11 Nov: Cache get 541/1000 (tightest), Data Store fetch 4272/10000, update 298/1000, insert 162/5000, Mail 0/100. Detail of the Creator comparison is in `docs/DS_COMPARISON.md`; `docs/DS_CHECKLIST_RULES.md` has the checklist role rules.

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
- **Next: Phase 2 emails** (submitted for approval; management review / OH&S on approve; closure recipients and tables; profit changed).

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
- **Font mismatch**: `CLAUDE.md` (re-read this session) says the font is **Inter** (`@fontsource/inter`, owner decision 11 Nov 2026, "do not switch back to Raleway"). But `tokens.css` still sets `--font: 'Raleway'`, and `package.json` still lists `@fontsource/raleway`. Not changed yet. Needs a decision and a focused change.
- **Not yet tried with real data**: the new checklists on the live site (leader vs member, management review issue), the Devices map with real device locations (none may have reported), timeline and variance. Tablet width and dark mode were not checked for the new screens.
- **Assumptions**: variance is booked minus quoted hours and relies on `booked_hours` being kept current; Parent/Fab labour cost (sum of task labour cost by Cost Type) shows zero until managers set a Cost Type; existing SWMS stay unnumbered.
- **Checklist gaps**: the install post-job issue subject is the question text, not the Creator "Management Review - <task>"; fab post-job does not raise an issue (no script supplied); hours and times are not template questions; Minor Task (install) and Workshop (fab) variants are not selectable (a template is chosen by task type, phase and role only); the pre-job SWMS gate (leader cannot finish until the PM signed the SWMS) is not confirmed in the app.
- **Not built**: rating role stored with a rating (managers already rate crew on completed tasks, 1 to 5), site contact from the CRM site, Site Code, SWMS work activity field, pay split on the Hours table, CRM push of signs and sites, WorkDrive folder rename, Job Overview pivot charts (no definitions in the extract), equipment details in `item_data`, ticket type extras in `compliance_type.meta`. Job Owner fields stay hidden (owner decision).
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
1. **You, decide**: (a) Inter or Raleway: `CLAUDE.md` says Inter, but the code still uses Raleway. Confirm Inter, then I switch `--font` and the package. (b) Heading scale: collapse the 17/20/24/26/28px headings to one ramp? (c) Tooling: Context7 failed to connect; you said install the missing skills and Motion, but nothing is installed yet. Confirm which. (d) Commit the uncommitted type-token step now?
2. **Me, next**: fix the `.side-nav` horizontal overflow, merge the duplicate `.issue-board` and `.grid-wrap` rules, then run the zoom (75–150%) and tablet checks with screenshots.
3. **You, live site (from before)**: start an install or fab pre-job checklist as a team leader and as a member (the right questions each?), finish an install post-job one with the management review set to Yes (does an issue appear?), and open the Devices page. Send anything that looks wrong.
4. **You, rule (from before)**: pick the next small backend item: Site Code, SWMS work activity, site contact from the CRM, or the Hours pay split; and say whether fab post-job should also raise an issue on the management review.
5. Then the client review. Redeploy only when asked: `npm run sync`, `npm test`, `npm run deploy:env`, `cd web && npm run build`, `catalyst deploy --only client`.
