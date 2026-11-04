# Backend status against the functional spec (docs/FSD.md)

Counted on 4 Nov 2026, then updated after each batch. **Done** = built, tested and deployed to Development. **Partly** = the main behaviour exists, a named piece is missing. A partly built item counts as half.

## Scorecard (64 requirements)

| Area | Done | Partly | Not built |
|---|---|---|---|
| Jobs (JOB-1 to 9) | 5 | 3 | 1 |
| Tasks (TSK-1 to 8) | 5 | 3 | 0 |
| Install tasks (INS-1 to 6) | 5 | 1 | 0 |
| Fabrication (FAB-1 to 5) | 5 | 0 | 0 |
| Design (DES-1 to 3) | 3 | 0 | 0 |
| Checklists (CHK-1 to 8) | 6 | 2 | 0 |
| SWMS (SW-1 to 4) | 3 | 0 | 1 |
| Issues (ISS-1 to 6) | 5 | 0 | 1 |
| Hours and ratings (HRS-1 to 5) | 5 | 0 | 0 |
| Compliance (CMP-1 to 5) | 3 | 2 | 0 |
| Equipment and devices (EQP-1 to 5) | 4 | 1 | 0 |
| **Total** | **49** | **12** | **3** |

Overall: (49 + 12 / 2) / 64 = **86%**. (62% at the first count, then 67%, 75% and 82% after batches 1 to 3.)

## Built in batch 1 (4 Nov 2026)

- **JOB-5** close job: needs every task finished; stage "Completed - Closed"; CRM deal updated; closure email sent once (flag on the job).
- **TSK-2** subtasks (under the root parent; install subtasks have no SWMS of their own) and close-only tasks (External Install, Print Only closed directly by a manager, INS-6).
- **INS-5** approval records the OH&S answer (default No) and the management-review flag.
- **INS-2** sub-stages On Site and Finished On Site follow the team leader checklists. "Team Briefed" is not built: it needs the briefing step split out of the pre-job checklist, which depends on the real checklist wording.
- **EQP-2** hired equipment linked to an install task (`hired_equipment` in the task spec) goes off hire when the install finishes on site; project managers and install coordinators are emailed once.

## Built in batch 2 (4 Nov 2026): fabrication

- **FAB-1** fab types (CCV, CNC, CLB, General/Pack, Metal, Paint, Maintenance, LED, Workshop) with spec checks. ASSUMPTION: the spec fields for CCV, CNC and CLB (material, size, thickness, quantity and so on) are my guess because the spec does not list them; confirm with the client. Workshop tasks have no pre-job checklist.
- **FAB-2** the task list can be returned grouped (order=grouped): parents with their subtasks, roots by stage in a custom order, then date.
- **FAB-3** repeating workshop tasks: on Complete the next task is created for previous date + interval (days, weeks x 7, months x 30), once per task.
- **FAB-4** daily job maintenance-tasks: due equipment (in service, with a schedule, next check today or earlier) gets one Maintenance task and its next due date moves forward; finishing the task counts as the check. Needs the workshop job set (Admin settings).
- **FAB-5** the workshop job is a setting (PUT /admin/settings and POST /tasks/workshop), not a hard-coded id.

## Built in batch 3 (4 Nov 2026): hours

- **HRS-1** weekly employee hours (`GET /hours/weekly`): per person per day (Monday to Sunday), hours by fab, install, workshop and design, plus unbilled and final. Workshop hours ARE counted in the total (the Creator app left them out). ASSUMPTION: final = total worked minus unbilled. Managers see everyone; crew see only themselves; cost is shown to admins only.
- **HRS-3** one pay-period setting (start date and length in days, in Admin settings) drives "this pay period" and "last pay period" (`GET /hours/pay-period`).
- **HRS-4** hours not filled (`GET /hours/not-filled`): past fabrication work the person has no finished post-job checklist for, split into workshop and other, with an optional cutoff date setting. ASSUMPTION: in this app a finished post-job checklist always has hours, so "not filled" means the post-job checklist is not finished.
- **HRS-5** a manager rates each person on a finished task once (`POST /tasks/{id}/ratings`, 1 to 5 with a comment); `GET /people/{id}/ratings` lists them with the average. ASSUMPTION: a 1 to 5 scale (the spec gives none). Ratings are stored in the activity log, as the plan says.
- **DES-2** a design task cannot be completed until hours are booked on it. Design tasks have no checklists, so hours are booked by hand with `POST /tasks/{id}/hours` (own hours, or a manager for anyone on the task). Hand-booked hours are plain hours: no start and end times, so no overtime split.
- A new "hours" area in the permission matrix: managers view all, crew view their own.

## Built in batch 4 (4 Nov 2026): issues

- **ISS-2** every real change is saved as one history entry with each old and new value (`GET /issues/{id}/history`); an update that changes nothing is ignored. A change sends ONE email listing the old and new values to the department people, the reporter, and whoever it is assigned to or owned by, except the person who made the change.
- **ISS-3** boards: filter by department and by All Open, My Open (assigned to me or owned by me) and My Reported (`GET /issues?department=&view=open|mine|reported`); `GET /issues/board` gives the counts per department and status. Departments: Management, Design, Fabrication, Install, Civic Billboards (an issue can be sent to one by hand).
- **ISS-1 completed** who is told about each department comes from a setting (`issue_routing`: a manager and an inform-also list per department); a department with no entry goes to every project manager.
- **ISS-4** create a CRM deal from an issue, once (`POST /issues/{id}/crm-deal`): Deal_Name "Issue: <subject>", stage Qualification, closing date 30 days out, description with the issue text. ASSUMPTION: these deal defaults; the spec does not name the fields.
- **ISS-6** hidden fields: crew roles and viewers do not see the CRM deal, owner, assignee or source; viewers also do not see who reported it; managers and admin see everything. ASSUMPTION: the spec says about 18 fields are hidden per role but does not list them, so this is my choice.
- **ISS-5** (seven print layouts as PDF and email) is not built: it comes with the PDF batch.

## Built in batch 5 (4 Nov 2026): settings and notifications

These come from FSD section 8 and 5.14 (administration), not from the 64 numbered requirements, so the percentage above does not move.

- **Notification log** (FSD section 8, rule 3): every email, from every part of the system, writes one log row: the event, the recipients and the outcome (sent, skipped when no sender is set, failed). A failed email keeps its body, so an administrator can send it again (`GET /admin/notifications`, `POST /admin/notifications/{id}/retry`). A mail problem never breaks the action that caused it. Stored in the activity log (there is no separate table).
- **Editable emails** (rule 2): an administrator can change the subject, add an intro and a footer to each of the six emails (`GET /admin/mail-templates`, `PUT /admin/mail-templates/{name}`, `GET .../{name}/preview`). Edits can use {placeholders} such as {job} or {subject}; unknown ones are refused when saving, values are escaped in the email, and clearing an edit goes back to the original wording. ASSUMPTION: edits are limited to subject, intro and footer, not the whole body, so a wrong edit cannot break the details of an email.
- **Settings** (`PUT /admin/settings`, admin only): workshop job, pay period, hours cutoff date, who is told about issues of each department, the global default reminder days for tickets and documents (used by a type that sets none), the company (PCBU) details filled into every new SWMS, and the people who receive the weekly hours report (used by the reports batch).
- Not built from FSD 5.14: users and role assignment screens (people already carry their roles), primary roles, and import/export (it belongs with the migration script).

## Built in batch 6 (4 Nov 2026): reports

- **Job tabs and filters:** `GET /jobs?view=` my_open, my_jobs, preparation, ongoing, completed, all; also project manager, fab manager and name search. The job page carries design, fabrication and install numbers (total, open, overdue, percent).
- **Tasks:** filters by kind, person, open, overdue, dates; `GET /tasks/board?type=` is a kanban (columns by stage with overdue counts). Crew only ever see their own.
- **Calendars:** install, fab or all; install leaves out external and print-only work.
- **SWMS list** (`GET /swms?view=&mine=`) and **checklists report** (`GET /reports/checklists`).
- **Compliance dashboard** (`GET /compliance/dashboard`): overdue, today and within 30 days per kind, plus worker counts. Managers only.
- **Role dashboards** (`GET /dashboards/{role}`): tiles for seven roles from real data; admin may open any.
- **Weekly reports:** hours (Wednesday, one email, hours only, never cost) and open issues per department (Thursday). Jobs `weekly-hours-report` and `weekly-issues-report`, also `POST /admin/reports/weekly-hours|weekly-issues`. They use the monthly mail budget (100 emails on the demo plan).

## Built in batch 7 (4 Nov 2026): PDFs

- **SW-4:** `GET /swms/{id}/pdf` makes the SWMS as an A4 PDF (company details, site, PPE, tasks, declarations, sign-offs) with Catalyst SmartBrowz, with the same access rules as viewing the SWMS.
- **ISS-5:** `GET /issues/{id}/pdf?layout=summary|full` (full adds details and the change history). It prints only what the caller may see (hidden fields stay hidden).
- ASSUMPTION: two layouts, not the seven from Creator, until the client confirms them (FSD question 7). PDFs are made on request only and are not stored.
- **Before it works live:** SmartBrowz must be switched on once in the console (SmartBrowz, "Start Exploring"). Not yet tried against the real service.

## Built in batch 8 (4 Nov 2026): finishing partly built items

- **JOB-7:** editing a job keeps its name and expected finish ("Please fill the mandatory fields").
- **JOB-8:** the CRM deal link and created date can be changed only by an administrator; stage and percentages are read-only (ignored if sent).
- **CHK-3:** `GET /tasks/{id}/checklist/next` says which step the caller sees: pre-job, then post-job, then done (workshop skips pre-job), with the next question.
- **TSK-3:** taking someone off a crew clears their unfinished checklists (finished ones stay). Checklists are still created when a person starts them, not at scheduling: ASSUMPTION, which makes creation safe to repeat.
- **TSK-5:** `DELETE /files/{id}` (the person who added it or a manager) hides the file and publishes `file.deleted`. Sync of attachments to WorkDrive is NOT built (needs a file transfer job).
- **Left partly built:** conditional field checks per role on the task form (TSK-6), photo answers inside checklists (CHK-8), the "Team Briefed" sub-stage (needs real checklist wording), companies and documents detail (CMP-1), device sync (EQP-4, needs MDM credentials), attachments to WorkDrive.

## Built in batch 9 (4 Nov 2026): more partly built items

- **TSK-6 (server side):** a finished task is locked except for notes; the scheduled date cannot be after the required finish; only fabrication tasks have a spec.
- **CHK-8:** a photo answer must be a finished photo upload that belongs to that checklist.
- **CMP-1:** company documents. A compliance item can belong to a company (documents) or a person (tickets, inductions); `GET /compliance?company_id=`; reminders go to the company contact (unless opted out) and the project managers.
- **Roles (FSD 5.14):** `GET /roles`; only an administrator changes roles or the active flag, and nobody can remove their own administrator role or switch themselves off.
- **Not built:** attachments to WorkDrive (needs a file-transfer job), import and export, device sync (MDM credentials), "Team Briefed" (checklist wording).

## Built in batch 10 (4 Nov 2026): WorkDrive attachments, import and export

- **TSK-5 finished:** every attachment, once its upload is confirmed, is queued once (outbox job `workdrive.upload_file`) and copied into the WorkDrive folder of its job (through its task, checklist or issue). It waits harmlessly until WorkDrive is connected and the job folder exists, retries with the outbox backoff, skips files deleted before the copy, and runs twice without a second copy. Not yet tried against the real WorkDrive.
- **Export (FSD 5.14):** `GET /admin/export/{jobs|people|companies|issues}?format=csv|json&limit=&offset=` (administrators, up to 300 rows per request, one query). Only whitelisted columns leave (no pay rates, no descriptions); CSV cells that start with = + - @ are defused against spreadsheet formulas.
- **Import:** `POST /admin/import/people` and `/admin/import/companies` (administrators, up to 50 rows per request). Each row is checked on its own; bad rows and duplicates (same email, same company name) are skipped with a reason and never change existing records. This is the manual way in; the full Creator migration script still waits for the export.

## Still to build (in order)

1. **Needs input from outside:** MDM device sync (ManageEngine credentials), real checklist and SWMS wording (and "Team Briefed"), the data-migration script (Creator export), email sender (`MAIL_FROM`).

## Also done outside the 64 requirements

CRM and WorkDrive connected; won deals pulled into jobs on a schedule and on demand; CRM quotes saved as sign groups; job folders created in WorkDrive; outbox with retries; permission matrix editor; request-saving rules (docs/REQUEST_BUDGET.md); 271 automated tests.
