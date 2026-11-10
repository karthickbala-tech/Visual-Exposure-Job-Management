# What was taken from `react-app/` (and what is still to take)

Three read-only audits compared the colleague's demo (`react-app/`) with our app on 2026-11-10. This file is the single list of everything in her demo that is better than ours, with the exact rules, so `react-app/` can be moved to `backup-files/` without losing any idea. Status: **done** / **todo**. Value: H / M / L. FE = front-end only, BE = needs a backend change.

## People and compliance
| # | Item | Rules from her demo | Value | Status |
|---|---|---|---|---|
| P1 | Edit a worker | name required; type; primary role required for VE staff; phone; email checked; hourly rate admin only (>= 0); Active tick ("untick when the worker leaves; records kept") | H FE | |
| P2 | Edit a ticket, induction or document | reference; issue date not in the future; expiry after issue ("The expiry date must be after the issue date."); button "Set expiry N years after issue" with years by type: Working at Heights 2, EWP 5, First Aid 3, Dogging 5, insurance and WorkCover 1, subcontractor agreement 3 | H FE | |
| P3 | Add a ticket from the person's page | picker lists only types the person does not have; "already has every ticket type" when none left | M FE | |
| P4 | Blank required rows on adding a worker or company | types flagged for VE or non-VE; blank rows show "Not filled in" and count in tiles | M BE | todo |
| P5 | Worker slide-over | 440 px sheet: company, role, phone and email links, status chip, only items needing action, "Open full profile" | L FE | todo |
| P6 | More compliance tiles | Active VE, Active non-VE, Expired, Expires today, Within 30 days, Not filled in; each filters the tickets tab; status buckets Expired / Today / Soon (1 to 30 days) / Incomplete | M FE | |
| P7 | Crew self-only "My tickets & inductions" | no tabs or tiles; own records with the status filter | M FE | todo |
| P8 | Editable roles | roles cannot be removed while held | L | not needed (fixed 11 roles) |

## Hours
| # | Item | Rules | Value | Status |
|---|---|---|---|---|
| H1 | Shift clock | check in, start/end break, check out; one open shift per worker; stored with date, start, end, break minutes, status, notes, single / x1.5 / x2 pay; timesheet tab (all staff for managers) | H BE | todo (needs a `timesheet` table) |
| H2 | Past shift with times | start and end times, break minutes, live pay-split preview; no future; end after start; over 16 h refused; over 14 h needs a tick | M | todo |
| H3 | Hours not filled list | per person: fab tasks before today and on or after the cutoff whose completed post-job checklist has 0 hours; "Enter hours" per row | M FE+BE | todo |
| H4 | Weekly roll-up | "Final = total minus unbilled"; entries table for the period | L | todo |

## Jobs, tasks, checklists
| # | Item | Rules | Value | Status |
|---|---|---|---|---|
| J1 | Block "Submit for approval" until every crew member has closed their post-job checklist | message "Closure step still open for A and B"; install and fab only | H BE | todo |
| J2 | Add-task form with kind, date, hours, sign group, fab spec, crew | install types: VE Install, VE Subtask, Minor Task, External Install, Print Only; design types: Artwork Sign Off, Install Plan, LED Design, Manufacturing Sign Off, Proof Of Posting, Project Management; name and date required | H FE | todo |
| J3 | Task edit with fab spec and hired equipment | CCV: width, height, qty, vinyl; CNC: material, thickness; CLB: material, return height | H FE | todo |
| J4 | Edit job | name admin-only; expected finish, stage, server path required; CRM deal and created date admin-only | M FE | todo |
| J5 | Job attention strip and close dialog | "N tasks waiting for your approval"; "N tasks still in Manager Review. Closing will not wait for approval." | M FE | todo |
| J6 | Task and job activity history | needs `GET /tasks/:id/activity` | H BE | todo |
| J7 | Bulk task actions | schedule crew and date, hold, cancel with one reason, "N of M done, M skipped" | M FE | todo |
| J8 | Reasons for hold, cancel, not-used, reset; hold returns to the stage it came from | needs a `held_from` column | M BE | todo |
| J9 | Delete task (soft) | admin only when hours are booked | M BE | todo |
| J10 | Sign stages and edit | Deal, Artwork, Manufacturing, Install stage columns | M BE | todo |
| J11 | Crew flag "needs management review"; team leader rating 1 to 10 | needs a decision on the scale (ours is 1 to 5) | M | todo |

## Issues, equipment, devices, dashboards
| # | Item | Rules | Value | Status |
|---|---|---|---|---|
| I1 | Seven issue print layouts | Summary, Full, Install, Workshop, Civic Billboards, Management, VT/Digital Screens; names are placeholders until the client confirms | M | waiting on the client |
| I2 | Issue photo attachments | not really built in her demo | L | todo |
| I3 | Related task picker and review options by task | install: Management Review or WHS Reported; fab: Management Review or OH&S Reported | L FE | todo |
| E1 | Hired equipment picked on install tasks | on Finished On Site, off-hire-required items go Off hire and managers get one email | H FE | todo |
| E2 | Equipment register | KPI tiles, type filter, search, status tabs, columns last checked / every N days / responsible / N days late; edit with history; Off hire toggle | M FE+BE | todo |
| E3 | Chemicals | supplier, stock and unit, SDS review overdue, SDS link http/https only | M BE | todo |
| E4 | Locations | edit, delete refused while items remain, counts | L | todo |
| D1 | Device schematic map | SVG pins from lat/lng, grey when stale over 24 h, legend with OpenStreetMap link | M FE | todo |
| D2 | Role dashboards | PM open jobs with bars; workshop overdue checks with Mark checked; crew "My Day" with inline hour booking, one-line next step, sent-back reason | M to H FE | todo |
| D3 | Calendar | day view, type colours legend, event drawer, type filter | L | todo |
| D4 | Checklist register | per-person progress, views by role, Continue | L | todo |
| S1 | SWMS task table | Task, hazards and risks, control measures, person responsible, stored in `swms_tasks` | M BE | todo (needs real client wording) |
| S2 | Settings extras | auto theme, accent swatches, hide menu items | L FE | todo |

Already taken earlier (see `UI_MERGE_PLAN.md`): grouped sidebar, settings icon, dashboard to-do list, jobs list, work modules, SWMS signing, People tabs, Issues board and rules, Hours range and CSV, Admin data tab.

## Progress on 2026-11-10 (before `react-app/` moved to `backup-files/`)

**Done and pushed:** P1 edit a worker, P2 edit a ticket with the "set expiry N years" button, P3 add a ticket from the person page without duplicates, P6 "Expires today" tile and bucket counts in the status filter, J1 submit blocked until the crew closed their checklists (backend rule plus test), J2 add-task form with kind, dates and hours, J3 task details with fab spec and hired equipment (also E1), J4 edit job, J5 approval notice and close confirmation, J6 task stage history (new `GET /tasks/:id/history`), E2 equipment register filters, search and extra columns, D1 device schematic map, D2 inline "Book hours" on the crew home cards.

**Still to do (all rules are in the tables above; the demo's code is in `backup-files/react-app/`):** P4, P5, P7, H1 to H4, J7 to J11, I1 to I3, E2 (off-hire toggle and edit history), E3, E4, D2 (PM and workshop dashboards), D3, D4, S1, S2.
