# Visual Exposure: progress (Claude working notes)

Last updated: 12 Nov 2026. Branch `feat/backend-foundation`, pushed to `origin`. Latest commit `27ff30d`.
Handover notes for the wider project remain in the root `progress.md` and `docs/BACKEND_STATUS.md`.

## 1. Current project status
- Backend: unchanged this session. Last recorded backend test run: 314 pass, 0 fail (from `progress.md`).
- Frontend (`web/`): this session was a UI/UX integration. The AI Studio export was used as a visual reference for theme, layout, spacing, cards and hover; local logic and routes were kept.
- Deployment: nothing deployed this session. Catalyst Development was last deployed on 11 Nov 2026 (`progress.md`).
- Local run: mock API on port 3100 (`node dev/mock-api.mjs`) and Vite on port 5173 (`npm run dev`). No Catalyst requests were made for this work.

## 2. Completed work (this session, in commit order)
- `0885df7` progress notes.
- `4666540` UI polish: Home two-column layout, shared `EmptyState` and `StatusDot`, chip dots, shell logo link, Ctrl/Cmd K hint, Calendar hover title, Task board "Overdue" tag.
- `fc4e13e` Theme: AI Studio tokens and stylesheet as the base; local-only rules kept (see decision 2). Brand green changed to `#22c55e`.
- `83f6d05` Scrolling and navigation: count bar inside table cards; back links return to the previous page; Task board remembers the last trade; Calendar day selection; Fab variance "Show tasks"; SWMS default view by role; device map wheel zoom; sidebar group toggling fixed.
- `2b61fea` Tables fill the window to the bottom; Filter "Show" section open by default; `/variance/:jobId` page; Calendar day panel without heading (tasks open in a new tab); sidebar child spacing.
- `8177586` Job details: Locations and Signs the same height; tighter spacing; clearer cards.
- `470284b` Job details: table tones, sticky job header, no gap under the header.
- `27ff30d` Sidebar in the job-header colour with white text; inset tables in job sections.

## 3. Current development task
- Waiting for owner answers (see section 6). No task is in progress.

## 4. Files modified (this session)
- `web/src/styles/global.css`, `web/src/styles/tokens.css`
- `web/src/App.tsx` (route `variance/:jobId`)
- `web/src/components/`: `Chip.tsx`, `Shell.tsx`, `ToDoList.tsx`, `ui.tsx` (`EmptyState`, `StatusDot`, `BackLink`), `FormKit.tsx`, `DeviceMap.tsx`
- `web/src/pages/`: `Home.tsx`, `Issues.tsx`, `Jobs.tsx`, `Calendar.tsx`, `WorkList.tsx`, `TaskBoard.tsx`, `TaskDetail.tsx`, `ChecklistPage.tsx`, `Variance.tsx`, `SwmsList.tsx`, `Compliance.tsx`, `Devices.tsx`, `Directory.tsx`, `Equipment.tsx`, `Hours.tsx`, `People.tsx`
- Docs: `docs/CLAUDE_PROGRESS.md` (this file)
- Not touched: backend (`functions/`, `lib/`, `tests/`), `CLAUDE.md`, `progress.md`, `.claude/skills/impeccable/`.

## 5. Important implementation decisions
1. **Local source of truth.** Where the AI Studio export differs in logic (role tiles for admin and viewer, extra KPIs, six stages, `/jobs?stage=` links, upcoming-work action column), the local behaviour was kept. These are open for the owner.
2. **Styling merge.** The AI Studio stylesheet is the base. Local rules are appended only where they style a class the base does not define, or set a theme variable the base never sets. The AI Studio stylesheet alone dropped about 60 classes in use. Script used: merge of the two files, kept in the session scratch folder.
3. **Brand green.** `#22c55e` (AI Studio) replaced `#68b04d`. `CLAUDE.md` still specifies `#68b04d`. Not yet confirmed by the owner.
4. **Scroll model.** Pages scroll as a whole. Table cards fill the rest of the window; the table scrolls inside the card; the count bar sits directly under the table inside the card. On phones tables keep their natural height (max 60dvh).
5. **Back links.** `BackLink` (in `ui.tsx`) uses browser history, falling back to the parent route when the page was opened directly.
6. **Sidebar.** Groups open automatically for the page you visit, but the person's own open and close choice rules after that. The sidebar background is the job-header colour (`--side: #101726`) in both themes, with white text.
7. **Variance.** "Open tasks" opens `/variance/:jobId` (same query, filtered in the browser, no extra request).
8. **Calendar.** Day selection is client-side. Tasks in the day panel open in a new tab.
9. **Map.** Mouse wheel zoom, drag, zoom buttons and keyboard are enabled (Leaflet defaults plus `scrollWheelZoom: true`).
10. **Constraints kept.** No API endpoint, request shape, permission, or Catalyst config changed. No new dependencies. No deploy.

## 6. Remaining bugs and pending work
- **Owner decisions needed:**
  - Brand green: keep `#22c55e` (AI Studio) or restore `#68b04d` (`CLAUDE.md`)?
  - Collapsed sidebar look: white rail with green active marker and tooltips, or keep the current dark rail?
  - Home content: adopt the AI Studio admin tiles, extra KPIs, six stages and action column, or keep local?
- **Uncommitted user edit:** `web/src/styles/global.css` has a change to `.jh` and `.jh__bar` colours and radii (`#101726`, white text, split radii). It was not made in this session and is left uncommitted. Confirm before committing.
- **Untracked:** `ref-image/` (client screenshots; never push). `CLAUDE.md` and `.claude/skills/impeccable/` (not tracked on purpose).
- **Not checked:** light theme on the job page and the tables; collapsed sidebar rail after the colour change; Issues board scroll behaviour; tablet width (768) for the job page in detail.
- **Hours page:** the totals strip sits between the table and its count bar (by design, kept).
- **Accepted lint:** "fast refresh" warnings (count changes with edits; no errors).
- **Real data:** all checks used the mock API. Nothing was checked against live Catalyst Data Store.

## 7. Tests executed and results
- `npx tsc -b`: pass (exit 0), last run after the final TypeScript change.
- `npm run build`: pass (last run after the final CSS change).
- `npx oxlint src`: 0 errors; warnings only (fast refresh).
- Backend `npm test`: not run this session (no backend changes). Last recorded: 314 pass, 0 fail.
- Browser (headless Chrome, mock API), by DevTools measurement:
  - Horizontal overflow at 360, 390, 768, 1024, 1366, 1920 px: none on Home, Jobs, Issues, Tasks, Calendar, Compliance, Hours, Equipment, Devices (one earlier overflow on Tasks at 390 was fixed).
  - Pages scroll and no card clips content on Admin, Issues, Calendar, Compliance, People, Equipment, Directory, Hours, SWMS, Checklists.
  - Behaviour checks passed: calendar day selection, variance "Show tasks" filter, SWMS default view for managers, back link (in-app and direct), sidebar group open and close (desktop, drawer, and the group holding the current page).
  - Job details: header sticky on scroll; gap between header and body is 0; Locations and Signs equal height (266 px at 1366 px wide).

## 8. Exact next steps
1. Owner answers the three decisions in section 6.
2. Confirm or discard the uncommitted `.jh` colour edit in `global.css`, then commit what is approved.
3. Check the light theme and the collapsed rail on Jobs and the job page.
4. Deploy to Catalyst Development only when the owner asks (`npm run sync`, `npm test`, `npm run deploy:env`, `cd web && npm run build`, `catalyst deploy --only client`).
