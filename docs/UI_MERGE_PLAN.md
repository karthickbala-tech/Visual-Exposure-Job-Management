# UI merge plan: our frontend (`web/`) takes the best of Kalyani's

Our frontend stays the primary app (real API, real permissions, our brand: green #68b04d, Raleway, uppercase headings, flat square cards). We take Kalyani's **ideas and rules**, not her components: hers are Tailwind and Radix (hard to port, and they hold sample data in context stores), ours is plain CSS and React Query.

Decisions from the owner (10 Nov 2026) are in the "Owner's choice" column.

## What each side has

| Area | Ours | Hers | Owner's choice | What we build |
|---|---|---|---|---|
| Sidebar | Collapsible rail with emblem, user menu, fade scroll, flat list | Grouped nav (Work, Field and safety, People, Assets), group auto-opens on the current page, a Settings link | Our profile, position and scrollbar + her grouping | Grouped nav (accordion) inside our sidebar; groups hidden when empty; single-child groups shown directly |
| Top bar | Search, theme, bell | Search, "viewing as" (demo), theme, bell, **settings icon** | Ours + her settings icon | Settings icon opens a personal Settings page (theme, density, text size, grouped nav on/off) |
| Dashboard | Role tiles, jobs by stage, my work, crew cards | **"To do now" list**, linked KPI tiles, "Go to" buttons, booked vs quoted bars, shift clock | Best of both | One "To do now" list (one new API request), linked KPIs, jobs-at-risk, booked vs quoted |
| Jobs list | Tabs, search, stage filter | Tabs **with counts**, PM and fab manager, Fab and Install progress, hours booked/quoted (red when over), risk lines, filters panel, bulk CSV | Best of both; keep our job detail page | Rich jobs list; our detail page gets the warning strip and Close job rule text |
| Work modules | Task board, task page | Design, Fabrication, Installation pages with saved views and counts, board and list, bulk actions, add-task wizard, approval panel (OH&S, management review, rating) | Hybrid | Design, Fabrication and Installation pages (list and board); approval panel on the task page |
| Calendar | Month, week, agenda | Unified, Fabrication, Installation tabs and type filter | **Ours** | Keep ours; add the tabs and type filter |
| SWMS | List, detail, PDF | KPI queues, 3-part progress bar, **3-step signing with typed name and tick**, 21 high-risk categories, auto-PPE | **Hers**, in our design | New list and sign dialog; hazards and PPE rules (needs a backend column); keep our real PDF |
| Hours | Weekly and pay period tables | Weekly roll-up with CSV, timesheet, **check-in clock**, add past shift, hours not filled | Ours + her functionality | Keep our tables; add CSV, add past shift, shift clock (needs a backend table) |
| People | Simple list, person page | 4 tabs, compliance KPIs, detail sheet, forms with date checks, self-only view | **Hers** | Tabs, KPIs, richer forms, self-only view |
| Issues | Table, filters, history, PDF | **Board and list, cards, quick panel, update rules, conditional fields, 7 print layouts** | **Hers** (cards, form) | Cards and board, report form, update rules (needs backend columns) |
| Admin | 7 tabs: permissions (editable), settings, roles, emails, log, outbox, integrations | 6 tabs, thin permissions, notification log, import and export | Combine | Keep ours; add import and export screen, role-removal guard, settings JSON backup |
| Other | Compliance, equipment, devices, directory | Same modules; compliance buckets, equipment off-hire, device schematic map | Best of each | Compliance buckets and clickable KPIs; device map |

## Rules worth taking (plain logic, goes into our backend)

- Close job only at 100% and only for PM or admin, with the reason shown.
- Approve a task: OH&S yes/no, "needs management review" flag, team leader rating.
- Bulk actions apply only to eligible tasks and report "N of M done, X skipped".
- Issue update: Completed needs "work completed"; any other status needs "next step" and "due date".
- Hours: confirm above 14 h, hard stop above 16 h (we already have this).
- Overtime split (weekday 8 h single, 2 h half, then double; Saturday; Sunday): we have `payRules`, extend for the timesheet.

## What we do not take

Her permission matrix (display only; ours is editable), the attachments screen (fake), "viewing as" (demo only), the static bell (ours reads real figures), the CRM and WorkDrive stubs (ours is real), short-name matching (we use people IDs), and her two-layer styling.

## Phases

Each phase is committed and pushed on its own; tested on localhost with the mock API first; deployed only when the owner says.

1. **Shell:** grouped sidebar, settings icon and Settings page, "No access" page.
2. **Dashboard:** "To do now" (new endpoint), linked KPIs, jobs at risk.
3. **Jobs list:** counts on tabs, people columns, progress, hours against quote, risk, filters panel, CSV (backend adds the numbers in one extra query).
4. **Work modules:** Design, Fabrication, Installation pages; approval panel.
5. **SWMS:** list queues, signing flow, hazards and PPE.
6. **People:** tabs, KPIs, forms.
7. **Issues:** board, cards, report form, update rules (backend columns first).
8. **Hours:** CSV, past shift, shift clock (backend table first).
9. **Admin and the rest:** import and export screen, device map, compliance buckets.
10. **Design-system pass:** one set of tokens, spacing, forms, dialogs, responsive checks on desktop, tablet and phone.

## Request-budget rules (Catalyst free plan)

One request per screen where possible; new numbers are added to existing endpoints, not new calls per row; no polling; lists keep the 30 to 60 second cache already in the app.
