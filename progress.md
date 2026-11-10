# Visual Exposure - Session handover

Branch `feat/backend-foundation`. Last pushed commit `71aacc5` ("List and job UX across the app, popups for add actions, Creator All Jobs parity"). Work after that commit is NOT committed yet. Nothing is deployed. `functions/*/lib` copies still need `npm run sync` before any deploy.

## 1. Completed work (since 71aacc5)
- Job Detail: right-click on fabrication/installation task rows opens a menu (Open task, Create subtask); the subtask popup is shared (`components/AddSubtaskDialog.tsx`).
- Installation tasks can get subtasks (Add subtask button shown for fabrication and installation tasks; the flag is `canSubtask` on `ManagePanel`).
- Job Detail task tables grouped like Creator: parent row, grey heading, subtasks, group totals row. More than three tasks in a table scroll inside it (`.jd-scroll`).
- Mock data: four subtasks for Northgate Mall Pylon Refresh (job 1042) in `web/dev/seed.mjs`; mock API now returns `parent_id` and `parent_or_sub`.
- Issues: board fills the body (one row of 280px columns, columns scroll inside, board scrolls sideways); count bar only in List view; the list and board fit short windows.
- Layout: pages with a fill-height list or board (Jobs, Issues) make the main area window-height and scroll inside it, so the bottom scrollbar and count stay on screen (desktop only).
- Vertical scrollbars hidden inside content boxes (grid, table, board, popups); sideways bars kept. The task tables are the exception and show a vertical bar.
- Collapsed sidebar: group icon buttons restyled (no browser button box).
- Font sizes: small sizes raised across the app (10-13px to 12-14px).
- Layout fixes at 125% zoom: no sideways page scroll (`.main-col` clips overflow and is positioned); Job Detail panels equal width.

## 2. Modified files (uncommitted)
- `web/src/pages/JobDetail.tsx`, `web/src/pages/TaskManage.tsx`, `web/src/pages/TaskDetail.tsx`, `web/src/pages/Issues.tsx`
- `web/src/styles/global.css`
- `web/dev/seed.mjs`, `web/dev/mock-api.mjs` (dev mock only)
- New: `web/src/components/AddSubtaskDialog.tsx`, `web/src/components/ContextMenu.tsx`
- Not committed on purpose: `CLAUDE.md` (untracked), `ref-image/` (client screenshots, must not be pushed).

## 3. Current implementation status
- Type-check (`npx tsc -b`) passes. Build passes. Lint: no errors; pre-existing warnings only.
- Tested in the browser (mock API on :3100, Vite on :5173): job-detail right-click menu and subtask popup; grouped task tables; Issues board and list heights at 900px and 600px; subtask button on an installation task.
- Not browser-tested: the mobile layout of the Issues board; zoom levels other than 125% and 150%.

## 4. Remaining bugs and gaps
- The real job service may not return `parent_id` for tasks. The grouped tables need it. Check on the live backend before relying on the grouping.
- Creator All Jobs gaps: "Labour Cost - Parent / - Fab" columns (definition needed); "Job Owner" for My jobs (needs a schema field, not approved); "My open" rule differs from Creator (On Hold, Completed - Closed); "Added Time" vs "Job Created Date" duplicate.
- The Issues summary tiles still take two rows above the board. Could be made one row like the Task Board.
- SWMS list shows "Nothing in this view" for the default "My open" view for this login.
- People list shows 10 of 13 (probably the Active-only default; not confirmed).
- Hours: day-column widths reset on reload (shared grid remembers only fixed columns).
- Work list "Group by job" groups not browser-tested.
- Lint warnings in `GridKit.tsx` (fast refresh) and `AdminMore.tsx`.
- Mock API state resets when the mock server restarts; some earlier mock tasks had been cancelled in memory.

## 5. Tests executed and results
- `npm test` (backend, 298 tests): 298 pass, 0 fail (latest run this session).
- `cd web && npx tsc -b && npm run build`: pass.
- `cd web && npx oxlint src`: no errors.
- Browser checks: see section 3.

## 6. Important decisions
- Creator names and layout are used for lists and fields; colours and spacing are ours (no copy of the Creator/reference palette).
- All open jobs follows Creator (not Completed, Cancelled or On Hold). My open keeps the existing rule until the user decides.
- Add actions open as popups (`components/Dialog.tsx`). Full-page add routes (new job, edit job, raise issue, add person) open over the current screen via a background location.
- Lists use the shared pieces: `ResizableGrid`, `GridStatusBar`, `ListToolbar`/`ListToolbarButtons`/`PanelSection` (`components/GridKit.tsx`, `components/ListToolbar.tsx`).
- Saved column choices: new columns show by default; hidden columns stay hidden (`ve.jobs.columns` stores `{visible, known}`).
- Subtasks: only fabrication and installation tasks; design tasks and closed jobs are refused.
- Job Detail: three-task limit before a table scrolls.

## 7. Exact next step
1. Commit the uncommitted work on `feat/backend-foundation` (include `progress.md`, the two new components, the dev mock changes; leave out `CLAUDE.md` and `ref-image/`), then push to origin. Add the Co-Authored-By line to the commit message.
2. Ask the user: labour cost Parent/Fab definitions; job owner field (schema change needs approval); My open rule; whether to merge Added Time with Job Created Date.
