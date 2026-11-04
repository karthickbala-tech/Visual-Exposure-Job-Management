# Backend status against the functional spec (docs/FSD.md)

Counted on 4 Nov 2026, then updated after each batch. **Done** = built, tested and deployed to Development. **Partly** = the main behaviour exists, a named piece is missing. A partly built item counts as half.

## Scorecard (64 requirements)

| Area | Done | Partly | Not built |
|---|---|---|---|
| Jobs (JOB-1 to 9) | 5 | 3 | 1 |
| Tasks (TSK-1 to 8) | 5 | 3 | 0 |
| Install tasks (INS-1 to 6) | 5 | 1 | 0 |
| Fabrication (FAB-1 to 5) | 0 | 0 | 5 |
| Design (DES-1 to 3) | 2 | 0 | 1 |
| Checklists (CHK-1 to 8) | 6 | 2 | 0 |
| SWMS (SW-1 to 4) | 3 | 0 | 1 |
| Issues (ISS-1 to 6) | 1 | 3 | 2 |
| Hours and ratings (HRS-1 to 5) | 1 | 1 | 3 |
| Compliance (CMP-1 to 5) | 3 | 2 | 0 |
| Equipment and devices (EQP-1 to 5) | 4 | 1 | 0 |
| **Total** | **35** | **16** | **13** |

Overall: (35 + 16 / 2) / 64 = **67%**. (It was 62% at the first count.)

## Built in batch 1 (4 Nov 2026)

- **JOB-5** close job: needs every task finished; stage "Completed - Closed"; CRM deal updated; closure email sent once (flag on the job).
- **TSK-2** subtasks (under the root parent; install subtasks have no SWMS of their own) and close-only tasks (External Install, Print Only closed directly by a manager, INS-6).
- **INS-5** approval records the OH&S answer (default No) and the management-review flag.
- **INS-2** sub-stages On Site and Finished On Site follow the team leader checklists. "Team Briefed" is not built: it needs the briefing step split out of the pre-job checklist, which depends on the real checklist wording.
- **EQP-2** hired equipment linked to an install task (`hired_equipment` in the task spec) goes off hire when the install finishes on site; project managers and install coordinators are emailed once.

## Still to build (in order)

1. **Fabrication (FAB-1 to 5):** fab types and their spec checks (CCV, CNC, CLB), parent and sub task ordering, repeating workshop tasks (`repeat_rule`), maintenance tasks generated from the equipment schedule, the configured workshop job.
2. **Hours (HRS-1, 3, 4, 5):** weekly employee hours, pay-period settings, hours-not-filled counts, employee rating.
3. **Issues (ISS-2 to 6):** department filter, update emails with old and new values, create a CRM deal from an issue, per-role hidden fields.
4. **Settings and notifications:** admin settings, editable email templates, a notification log.
5. **Reports:** the parameterised report endpoints (about 12).
6. **SWMS PDF (SW-4)** through Catalyst SmartBrowz (availability in the India data center to be verified); **DES-2** design completion needs booked hours.
7. **Needs input from outside:** MDM device sync (ManageEngine credentials), real checklist and SWMS wording (and "Team Briefed"), the data-migration script (Creator export), email sender (`MAIL_FROM`).

## Also done outside the 64 requirements

CRM and WorkDrive connected; won deals pulled into jobs on a schedule and on demand; CRM quotes saved as sign groups; job folders created in WorkDrive; outbox with retries; permission matrix editor; request-saving rules (docs/REQUEST_BUDGET.md); 208 automated tests.
