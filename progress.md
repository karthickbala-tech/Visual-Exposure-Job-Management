# Visual Exposure - Current Progress

Last commit pushed to GitHub `main`: `f4853a7`. Nothing from this session is deployed.

## Current task
Make our `web/` app the hybrid front end (our design, Creator names, ideas from the colleague's `react-app/`), then use the Creator export for names everywhere.

## Completed
- UI merge phases 1-10 (shell, dashboard, jobs, work modules, SWMS, People, Issues, Hours, Admin data tab, design pass). Plan and status: `docs/UI_MERGE_PLAN.md`.
- Task board holds Design / Fabrication / Install as tabs; one Filters menu (saved views + extra filters) on Jobs, Task board, Issues, SWMS.
- Jobs: Creator-style wide grid, field search, column picker, coloured stage cells; add/edit job on their own pages (3-column form, Submit/Reset); job page with Management / Fabrication / Installation bands.
- Shared form pages (`FormKit`): New job, Edit job, Add a person, Raise an issue.
- Colleague's `react-app/` audited, best parts built, then moved to `backup-files/react-app/`. List: `docs/REACT_APP_EXTRACTION.md`.
- Creator names applied to: job page, job form, signs, add-task form, Issues (statuses, priorities, departments, Direction, review lists). Reference: `docs/CREATOR_NAMES.md`.
- Backend: stage on job create, admin-only system fields, purchases columns, job locations/crew on job page, submit blocked until crew closed checklists, task history endpoint, sign stages, Issues rules on Creator values.
- Data-layer bugs fixed (wrote to columns that do not exist): sites, companies, signs, register_item (item_kind/type/status/data), device os_name.
- Layout: compact scale on every page, full-width body (no left/right/bottom padding under the title), same top spacing as Calendar.
- Cleanup: unused prototypes to `backup-files/`, diagrams to `docs/reference/`.

## Files modified (main areas)
- Backend: `lib/services/{jobs,issues,tasks,directory,registers,dashboard,hours,dataTransfer}.js`, `lib/domain/{issues,fab,jobList,todo}.js`, `lib/repos/index.js`, `lib/authz.js`, `functions/api/routes.js`.
- Frontend: `web/src/pages/{Jobs,JobDetail,NewJob,EditJob,Issues,NewIssue,NewPerson,People,PersonDetail,Hours,Equipment,Devices,SignsPanel,TaskBoard,WorkList,Admin*}.tsx`, `web/src/components/{FormKit,JobForm,StageCell,FilterMenu,AddTaskForm,TaskDetailsPanel,TaskHistory,DeviceMap,CrewCards,JobModule}.tsx`, `web/src/lib/{names,taskKinds,validity}.ts`, `web/src/styles/global.css`, `web/dev/{mock-api,seed}.mjs`.
- Live Catalyst Data Store (Development): added `swms.hazards`; `issue`: next_step, work_completed, due_date, billboard_site, billboard_face, review_needed; `job`: total_purchases, stock_purchases.

## Current implementation status
- 296 backend tests pass. Front end type-checks and builds. Not seen in a browser (the browser tool was down).
- Local run: mock API `node dev/mock-api.mjs` (port 3100) + `npx vite` (port 5173), both in `web/`. Restart the mock after editing it; use `npx vite --force` if the page goes blank.

## Remaining bugs / gaps
- No visual check of any new screen yet; layout changes (full-width body, borders removed on cards) may need tuning.
- Creator names not yet applied to: Hours, Equipment, Chemicals, Companies, Company Documents, SWMS, People.
- Old issues in a dev database keep the previous statuses/priorities/departments (no migration).
- Still to do from the demo audit (all in `docs/REACT_APP_EXTRACTION.md`): shift clock/timesheet, hours-not-filled list, bulk task actions, task delete, hold-return stage, worker slide-over, issue print layouts and photos, off-hire toggle, role dashboards.
- Other repos may still write to non-existent columns (only sites, companies, signs, register_item, device, file_asset, sign_group, job, issue checked).
- Unrelated: `backup-files/react-app/src/App.css` shows as modified; `ref-image/` (client screenshots) is deliberately untracked and must not be pushed.

## Tests
- `npm test`: 296 pass, 0 fail (last run after the final change).
- `cd web && npx tsc -b`, `npx oxlint src` (only old warnings), `npm run build`: clean.

## Important decisions
- Our colours (#68b04d), Raleway, flat square cards; compact 12.5 px scale everywhere.
- Creator names are used for fields, columns and pick-lists; layout is ours, not Creator's.
- Job stage is derived from tasks; only chosen when a job is created.
- Issues follow the Creator pick-lists; any status can move to any other.
- Services keep short names; the data layer translates to real column names.
- Never push `ref-image/` or the Creator export; never read `.env`.

## Next step
Open http://localhost:5173 (restart mock first), check Jobs, Job detail, Issues, Calendar and Task board for the new spacing, fix what looks wrong, then apply Creator names to Hours (Employee Hours fields) and the Equipment/Chemicals registers.

## Restrictions
- Do not change unrelated modules.
- Do not deploy without approval.
- Preserve existing Catalyst request-budget rules.
