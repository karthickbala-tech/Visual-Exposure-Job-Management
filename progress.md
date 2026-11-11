# Visual Exposure - Session handover

Branch `feat/backend-foundation`, all work pushed to origin (last code commit `f2845fd`). **Deployed to Catalyst Development on 11 Nov 2026**: api, jobs, events (with the `.env` variables) and the web client. There is no Production or AU project yet (owner decision 3 Nov: finish on this Development project, review with the client, then move to AU). The account is the **free plan**: see `docs/REQUEST_BUDGET.md`. Usage seen on 11 Nov: Cache get 541/1000 (tightest), Data Store fetch 4272/10000, update 298/1000, insert 162/5000, Mail 0/100. Detail of the Creator comparison is in `docs/DS_COMPARISON.md`; `docs/DS_CHECKLIST_RULES.md` has the checklist role rules.

## 1. Completed work
- **Earlier (see git log since `d22095d`)**: Creator DS comparison (68 forms, 423 workflows, 186 reports); confirm and message dialogs; Jobs grid columns and cost type; SWMS numbers, hazard wording and PM Completed/Closed; Issues fixes; directory fields and rates; personal details by role and encrypted portal logins; past-shift times on Hours; two checklist emails.
- **This session**:
  - **Calendar timeline**: third view, fabrication bars from scheduled date to required finish (red when late). `/calendar` items carry `required_finish`, no new request.
  - **Fab variance report**: page `/variance` and `GET /reports/fab-variance`, booked minus quoted hours per task and job; two queries at most, capped at 300.
  - **Hours**: day-column widths now persist (`GridColumn.widthKey`).
  - **Checklists**: real Creator wording and the team leader / member split for install and fab, pre and post (templates v2), and install post-job v3 where a Yes to the management review raises an issue (owner answer; from the Creator workflow). All yes/no questions stay mandatory.
  - **Devices**: List / Map toggle; the map is Leaflet 1.9.4 with OpenStreetMap tiles (owner approved the library), pins by initials, grey when stale.
  - **Verified in Development**: the new columns, and on the deployed site the profile and portal login save, read back and are logged.
  - **Deploy**: functions and client deployed twice, smoke-tested (app 200, unauthenticated API 401).

## 2. Modified files (this session, all committed)
- Backend: `lib/services/{dashboard,reports}.js`, `lib/domain/reports.js`, `lib/seed/checklistTemplates.js`, `functions/api/routes.js`.
- Tests: `tests/reports.test.js` (extended), new `tests/checklistTemplates.test.js`.
- Web: `pages/{Calendar,Variance,Devices,Hours}.tsx`, `components/{DeviceMap,GridKit}.tsx`, `App.tsx`, `navConfig.ts`, `api/{queries,types}.ts`, `styles/global.css`, `package.json` and lock (Leaflet), `dev/mock-api.mjs`.
- Docs: new `docs/DS_CHECKLIST_RULES.md`; this file.
- Not committed on purpose: `CLAUDE.md` (untracked), `ref-image/` (client screenshots, never push).
- `functions/*/lib` are generated copies (git-ignored): run `npm run sync` after any change in `lib/`.

## 3. Current implementation status
- Built, tested and deployed to Development. Almost all of it has run only against the fake test database and the dev mock; the real Data Store has had the schema checks, the encrypted-column check and template rows only.
- **Database changes in Development (via the MCP)**: columns `swms.swms_number`, `time_entry.start_time/end_time/break_minutes`, `compliance_item.portal_login`, `person.profile_private` (both encrypted text, 10,000 chars, so the database encrypts them and no key is in `.env`); 10 new rows in `checklist_template` (v2 x8, v3 install post x2). The seed route would skip them. Test rows were deleted.
- Older checklist rows (v1) remain; new checklists use the highest version, open ones keep their own.
- The dev mock has no routes for profile, portal login, company rates or PATCH of companies and sites.

## 4. Remaining bugs and gaps
- **Not yet tried with real data**: the new checklists on the live site (leader vs member, management review issue), the Devices map with real device locations (none may have reported), timeline and variance. Tablet width and dark mode were not checked for the new screens.
- **Assumptions**: variance is booked minus quoted hours and relies on `booked_hours` being kept current; Parent/Fab labour cost (sum of task labour cost by Cost Type) shows zero until managers set a Cost Type; existing SWMS stay unnumbered.
- **Checklist gaps**: the install post-job issue subject is the question text, not the Creator "Management Review - <task>"; fab post-job does not raise an issue (no script supplied); hours and times are not template questions; Minor Task (install) and Workshop (fab) variants are not selectable (a template is chosen by task type, phase and role only); the pre-job SWMS gate (leader cannot finish until the PM signed the SWMS) is not confirmed in the app.
- **Not built**: rating role stored with a rating (managers already rate crew on completed tasks, 1 to 5), site contact from the CRM site, Site Code, SWMS work activity field, pay split on the Hours table, CRM push of signs and sites, WorkDrive folder rename, Job Overview pivot charts (no definitions in the extract), equipment details in `item_data`, ticket type extras in `compliance_type.meta`. Job Owner fields stay hidden (owner decision).
- **Accepted lint warnings (10)**: eight "fast refresh" notes and two `set-state-in-effect` in `Admin.tsx` and `AdminMore.tsx`; fixing them means restructuring shared components or admin screens for no user benefit.
- **Older items**: real job service may not return `parent_id` for grouped task tables; "My open" differs from Creator; Issues summary tiles take two rows; SWMS "My open" is empty for the test login; "Group by job" not browser-tested; the dev mock shows the old task stage after a transition and resets on restart.
- **Security note**: ZCQL and the MCP read the encrypted columns decrypted, so anyone with Data Store access can read portal passwords.

## 5. Tests executed and results
- `npm test` (backend): **314 pass, 0 fail** (before the last deploy).
- `cd web && npx tsc -b && npm run build`: pass. `npx oxlint src`: no errors, the 10 accepted warnings only.
- Browser (mock API, desktop 1366 and phone 390): timeline, variance, Devices list and map toggle (tiles load, four pins in the box, no sideways scroll), Hours column-width persistence.
- Catalyst MCP (Development): write, read back and delete of test rows on all new columns; template rows read back; profile and portal login checked after saving through the deployed app, then cleared.
- Deploy smoke checks: web app 200, unauthenticated `/reports/fab-variance` 401; no `env_variables` left in the function configs.

## 6. Important decisions
- Finish on Development first, client review next, AU project later; add the new columns to AU first when it is created.
- Free plan: use unit tests and the mock before the real Data Store; use the MCP only when the real database is the point and say the request cost first; no polling, no per-row requests, no test emails.
- Checklist issue-raising: only the install management review "Yes" (a Low priority issue, once per task, for the installation manager). All yes/no questions mandatory.
- Rating stays as built: managers rate crew on completed tasks, scale 1 to 5, role not stored.
- Device map: a real street map in the web app (Leaflet and OpenStreetMap approved), toggle with the list.
- Earlier: SWMS Completed and Closed by the project manager; company rates and portal logins managers only; personal details by role; Job Owner fields hidden; schema changes only additive, in Development, via the MCP.
- Process: commit and push every change; deploy only when the owner says; never read `.env`; the owner's own edits are committed only when they ask.

## 7. Exact next step
1. **You**: on the live site, start an install or fab pre-job checklist as a team leader and as a member (the right questions each?), finish an install post-job one with the management review set to Yes (does an issue appear?), and open the Devices page. Send anything that looks wrong.
2. **You**: pick the next small item and give its rule: Site Code, SWMS work activity, site contact from the CRM, or the Hours pay split; and say whether fab post-job should also raise an issue on the management review.
3. Then the client review. Redeploy only when asked: `npm run sync`, `npm test`, `npm run deploy:env`, `cd web && npm run build`, `catalyst deploy --only client`.
