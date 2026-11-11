# Visual Exposure - Session handover

Branch `feat/backend-foundation`, pushed to origin. **Deployed to Catalyst Development on 11 Nov 2026** (api, jobs, events with the `.env` variables, and the web client, redeployed from commit `df371a0`, the code at that commit plus the owner's uncommitted padding tweak in global.css). There is no Production or AU project yet (owner decision 3 Nov: finish on this Development project, review with the client, then move to AU). Detail of the Creator DS comparison is in `docs/DS_COMPARISON.md` (sections 1 to 18); do not repeat it here.

## 1. Completed work (since d22095d)
- **Creator DS file compared** with the app: all 68 forms, 423 workflows, 186 reports. Reference extracts: `docs/DS_CHECKLISTS.md`, `docs/DS_WORKFLOWS.md`, `docs/DS_REPORTS.md`.
- **UI pieces**: `components/Messages.tsx` (promise-based confirm and message dialogs, replaced all five `window.confirm`), `components/Notice.tsx`, warning and info toasts, `--warn` token. Submitting a task for manager review asks first.
- **Jobs**: grid columns Design Hours Booked, Design Labour Cost, Job Completed Date, Description, six Parent/Fab labour cost columns (admin only). Task Cost Type select (Fab or Parent).
- **Tasks**: DS fabrication spec fields added as optional keys (CCV, CNC, CLB).
- **SWMS**: DS hazard wording, two added hazards and two added PPE items; numbers from SWMS-0001; project manager marks Completed then Closed.
- **Issues**: Date Completed column, Locations picker, issue routing now accepts every issue department (was a bug for Workshop and VT).
- **Directory**: companies store address, DS company types, manager-only rates; sites store DS fields (country, notes, access notes, hours, tenant and owner contacts); full state names; Edit button for companies and sites.
- **People and compliance**: set-expiry button for three ticket types; personal details by role (`lib/domain/profile.js`); training portal logins (encrypted, managers only, logged reveal).
- **Hours**: past shift by start, end and break (split into single, time and a half, double).
- **Emails**: install finished on site (to PM and installation manager) and fab checklist submitted (to fab manager), from the `checklist.closed` event.
- **Fabrication timeline** (`df7b03c`): third view on the Calendar page (28-day window, bars from scheduled date to required finish, red when late). Fabrication tasks only. `/calendar` items now carry `required_finish`; no new request.
- **Fab variance report** (`df7b03c`): page `/variance` under Work and `GET /reports/fab-variance` (service `fabVariance`, domain `taskVariance`). Booked minus quoted hours per fabrication task and per job; anyone who can view tasks, scoped to their own tasks unless they see all. Two queries at most, capped at 300 tasks.
- **Catalyst Development schema (via MCP)**: added `swms.swms_number`, `time_entry.start_time`, `time_entry.end_time`, `time_entry.break_minutes`, `compliance_item.portal_login` (encrypted). Nothing else changed or deleted.

## 2. Modified files (all committed)
- Backend: `lib/domain/{fab,jobList,notifications,profile,reports,swms}.js`, `lib/services/dashboard.js`, `web/src/pages/{Calendar,Variance}.tsx`, `lib/services/{appSettings,compliance,dataTransfer,directory,hours,jobs,people,swms,tasks}.js`, `lib/{authz,repos/index,events/handlers}.js`, `functions/api/routes.js`.
- Tests: new `tests/{portal,profile}.test.js`; extended `directory, hours, issues2, joblist, notifications2, swms, swms2` tests and `tests/helpers.js`.
- Web: `api/{more,queries,types}.ts`, `App.tsx`, `components/{Messages,Notice,toast,CrewCards}.tsx`, `lib/taskKinds.ts`, `pages/{AdminData,Directory,Hours,Issues,JobDetail,Jobs,NewIssue,People,PersonDetail,SwmsList,SwmsPanel,TaskDetail,TaskManage,WorkList}.tsx`, `styles/{global,tokens}.css`.
- Docs: `docs/DS_COMPARISON.md`, `DS_CHECKLISTS.md`, `DS_WORKFLOWS.md`, `DS_REPORTS.md`.
- Not committed on purpose: `CLAUDE.md` (untracked), `ref-image/` (client screenshots, never push).
- `functions/*/lib` are generated copies (git-ignored): run `npm run sync` after any change in `lib/`.

## 3. Current implementation status
- Everything above is built, tested and pushed, but only against the fake test database and the dev mock. Nothing has run against the real Data Store except the schema checks and one SELECT.
- The dev mock (`web/dev/mock-api.mjs`) has no routes for profile, portal login, company rates or PATCH of companies and sites, so those screens only show their empty state there.

## 4. Remaining bugs and gaps
- **Development columns checked via the MCP (11 Nov 2026)**: raw ZCQL write and read-back worked for `time_entry.start_time/end_time/break_minutes`, `swms.swms_number`, `compliance_item.portal_login` and `person.profile_private`; test rows were deleted and the person value set back to null. Still unverified: the app's own encrypt and decrypt path against the real Data Store (only the unit tests cover it). Both encrypted columns are `text` (a 500-character write worked); the worst-case profile is estimated at about 3,800 characters encrypted, under the 10,000 limit, but a value that large was not written.
- **Parent/Fab labour cost** rests on an assumption (sum of task labour cost by Cost Type); all six figures show zero until managers set a Cost Type on tasks.
- Existing SWMS stay unnumbered (no backfill).
- Variance assumptions: Creator's "Fabrication Task Variance" definition was not in the extract, so it is booked minus quoted hours; `booked_hours` on the task row is assumed to be kept current in the real Data Store (not verified). Timeline only lists tasks whose scheduled date falls in the window. Timeline and variance not checked at tablet width or in dark mode.
- Checklist question rules: the role split IS in the Creator file (`Creator file/Projects.ds`, the on-load show and hide scripts) and is written up in `docs/DS_CHECKLIST_RULES.md` for owner review (install pre and post, fab pre and post). Version-2 templates (real wording, leader/member split) are written in `lib/seed/checklistTemplates.js` and tested (313 tests), DEPLOYED to Development on 11 Nov 2026 and the eight v2 rows were inserted into `checklist_template` through the MCP (same content the admin seed route `POST /admin/seed-templates` would add; running the seed later skips them). New checklists use v2; open ones keep v1. Not yet tried with a real task in the app. Owner answers 11 Nov 2026: only the management review "Yes" raises an issue (from the Creator workflow: Low priority issue for the installation manager, once per task) - done as install post-job v3 (2 rows inserted in Development; fab post-job unchanged because no fab script was supplied); all yes/no questions stay mandatory; rating stays as built (managers rate crew on completed tasks, role not stored); device map: owner asked for a real map in the web app (DONE: the Devices page now has a street map, Leaflet 1.9.4 with OpenStreetMap tiles, approved by the owner; List and Map toggle on the page (list by default; the map gets the full page in Map view, deployed? not yet: see git log); pins by worker initials, grey when stale; checked on desktop and phone with the mock; no extra Catalyst requests; browsers load tiles from tile.openstreetmap.org). The seed list in the deployed api now includes v3. Left out on purpose: hours and times, Minor Task and Workshop variants, and raiseIssueOn (owner to confirm; see the open questions in the doc).
- Not built: rating role (Team Member or Project Manager), site contact from the CRM site, CRM push of signs and sites, WorkDrive folder rename, the Job Overview pivot charts (no column definitions in the extract), equipment details in `item_data`, ticket type extras in `compliance_type.meta`, Site Code, SWMS work activity field, pay split display on the Hours table, device details (needs columns).
- Job Owner, Owner Email, Manufacturing Owner stay hidden (owner decision); could be stored in `job.flags`.
- Fixed: Hours day-column widths now persist (one shared `day` width via `GridColumn.widthKey`). Checked: "People list shows 10 of 13" is not a bug (10 active staff here, 2 subcontractors on their tab, 1 inactive hidden by default).
- Older items still open: real job service may not return `parent_id` for grouped task tables; "My open" rule differs from Creator; Issues summary tiles take two rows; SWMS "My open" shows nothing for the test login; "Group by job" not browser-tested; lint warnings in `GridKit.tsx`, `AdminMore.tsx` and three `only-export-components` in `Messages.tsx`.
- Dev mock: task detail page showed the old stage after a transition (the board was right); state resets on restart.

## 5. Tests executed and results
- `npm test` (backend): 310 pass, 0 fail (after the last change).
- Browser (mock API): timeline (desktop, phone) and variance page (desktop, phone) checked.
- Catalyst MCP (Development): SELECT, INSERT, UPDATE and DELETE of test rows confirmed on all new columns; test data removed.
- `cd web && npx tsc -b && npm run build`: pass. `npx oxlint src`: no errors.
- Browser (mock API :3100, Vite :5173): confirm dialog on a 15-hour shift; submit for review (cancel and submit); Edit company dialog opens prefilled. Not browser-tested: every other new screen.
- Catalyst MCP: columns created and one read-only ZCQL SELECT (SWMS number lookup) validated.

## 6. Important decisions (owner answers, section 18 of DS_COMPARISON)
- SWMS Completed and Closed are set by the project manager after the team leader signs; numbers start at SWMS-0001.
- Company types are the five Creator types (older kinds still valid); site states show full names and save short codes.
- Company rates visible and editable by managers only; personal details by role (admin all, managers four fields, the person their own); portal logins encrypted and managers only. Plain-text passwords are never stored.
- Parent/Fab rule confirmed. Job Owner fields hidden. Rating scale 1 to 5.
- Process: commit and push every change; never deploy without being asked; schema changes only additive, in Development, via the MCP.

## 7. Exact next step
1. Deployed to Development (see the header). Redeploy only when the owner says: `npm run sync`, `npm test`, `npm run deploy:env`, then `catalyst deploy --only client`. Smoke check after deploy: unauthenticated `/reports/fab-variance` returns 401 and the web app returns 200. When the AU project is created, add the five new columns there first (list in section 1).
2. DONE 11 Nov 2026 on the deployed site: a personal profile and a portal login were saved and read back in the app, the reveal and both changes were logged (`profile_changed`, `portal_changed`, `portal_viewed`), and test data was cleared. The two columns have the Data Store type **encrypted text** (10,000 characters), so the database encrypts them and no key is needed in `.env`. ZCQL and the MCP read them back decrypted, so anyone with Data Store access can read portal passwords; keep that access tight.
3. Then build the next item the owner picks: the checklist rules once the question split is supplied, or the device map once the device columns are decided.
