# Visual Exposure - Session handover

Branch `feat/backend-foundation`, pushed to origin at `506c077` (22 commits since `d22095d`). Nothing is deployed. Detail of the Creator DS comparison is in `docs/DS_COMPARISON.md` (sections 1 to 18); do not repeat it here.

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
- **Catalyst Development schema (via MCP)**: added `swms.swms_number`, `time_entry.start_time`, `time_entry.end_time`, `time_entry.break_minutes`, `compliance_item.portal_login` (encrypted). Nothing else changed or deleted.

## 2. Modified files (all committed)
- Backend: `lib/domain/{fab,jobList,notifications,profile,reports,swms}.js`, `lib/services/{appSettings,compliance,dataTransfer,directory,hours,jobs,people,swms,tasks}.js`, `lib/{authz,repos/index,events/handlers}.js`, `functions/api/routes.js`.
- Tests: new `tests/{portal,profile}.test.js`; extended `directory, hours, issues2, joblist, notifications2, swms, swms2` tests and `tests/helpers.js`.
- Web: `api/{more,queries,types}.ts`, `App.tsx`, `components/{Messages,Notice,toast,CrewCards}.tsx`, `lib/taskKinds.ts`, `pages/{AdminData,Directory,Hours,Issues,JobDetail,Jobs,NewIssue,People,PersonDetail,SwmsList,SwmsPanel,TaskDetail,TaskManage,WorkList}.tsx`, `styles/{global,tokens}.css`.
- Docs: `docs/DS_COMPARISON.md`, `DS_CHECKLISTS.md`, `DS_WORKFLOWS.md`, `DS_REPORTS.md`.
- Not committed on purpose: `CLAUDE.md` (untracked), `ref-image/` (client screenshots, never push).
- `functions/*/lib` are generated copies (git-ignored): run `npm run sync` after any change in `lib/`.

## 3. Current implementation status
- Everything above is built, tested and pushed, but only against the fake test database and the dev mock. Nothing has run against the real Data Store except the schema checks and one SELECT.
- The dev mock (`web/dev/mock-api.mjs`) has no routes for profile, portal login, company rates or PATCH of companies and sites, so those screens only show their empty state there.

## 4. Remaining bugs and gaps
- **Verify in Development before relying on**: the two encrypted columns (`person.profile_private`, `compliance_item.portal_login`) read and write correctly; shift times and SWMS numbers save to the new columns.
- **Parent/Fab labour cost** rests on an assumption (sum of task labour cost by Cost Type); all six figures show zero until managers set a Cost Type on tasks.
- Existing SWMS stay unnumbered (no backfill).
- Not built: checklist question rules (who sees which question; start from `docs/DS_CHECKLISTS.md`), rating role (Team Member or Project Manager), site contact from the CRM site, CRM push of signs and sites, WorkDrive folder rename, timeline, device map and pivot reports, equipment details in `item_data`, ticket type extras in `compliance_type.meta`, Site Code, SWMS work activity field, pay split display on the Hours table, device details (needs columns).
- Job Owner, Owner Email, Manufacturing Owner stay hidden (owner decision); could be stored in `job.flags`.
- Older items still open: real job service may not return `parent_id` for grouped task tables; "My open" rule differs from Creator; Issues summary tiles take two rows; SWMS "My open" shows nothing for the test login; People list shows 10 of 13; Hours day-column widths reset on reload; "Group by job" not browser-tested; lint warnings in `GridKit.tsx`, `AdminMore.tsx` and three `only-export-components` in `Messages.tsx`.
- Dev mock: task detail page showed the old stage after a transition (the board was right); state resets on restart.

## 5. Tests executed and results
- `npm test` (backend): 309 pass, 0 fail (after the last change).
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
1. Before any deploy: add the same five columns to the Production Data Store (list in section 1), run `npm run sync`, `npm test`, then `npm run deploy:env` and `catalyst deploy --only client` only when the owner says.
2. In Development, save and read one personal profile, one portal login, one shift with times and one new SWMS to confirm the new columns.
3. Then build the next item the owner picks: timeline, device map and pivot reports (wanted), or the checklist rules once the question split is supplied.
