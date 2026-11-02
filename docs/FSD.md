# Visual Exposure: Functional Specification (FSD)

| | |
|---|---|
| Project | Migration of Zoho Creator app "Projects" to Zoho Catalyst |
| Source | `Creator file/Projects.ds` (93,688 lines: 68 forms, ~200 reports, 17 pages, ~190 + ~141 workflow entries, ~115 functions, 17 schedules, 10 profiles) |
| Version | 0.1 draft for client review |
| Date | 2026-11-02 |
| Companion | `docs/WORKFLOWS.md` (diagrams and state machines) |
| Status key | **[CONFIRM]** = ambiguous in the export, needs a client decision. See section 14. |

---

## 1. Purpose and scope

Visual Exposure runs signage jobs through three disciplines: **Design**, **Fabrication** and **Install**. Each job is created from a Zoho CRM Deal, split into tasks, scheduled, executed by team leaders and crews using pre-job and post-job checklists, reviewed by a manager, and closed. The same app tracks worker and subcontractor compliance (tickets, inductions, company documents), equipment and chemicals, safe-work method statements (SWMS), issues, and hours and labour cost.

This FSD describes what the Catalyst rebuild must do. It is derived only from the Creator export. Behaviour that Creator implemented through generated HTML links, popups and page refreshes is out of scope; the React app replaces it with normal routing.

### 1.1 In scope
- Job, task, sign, site and sign-group management
- Design, Fabrication and Install task lifecycles with approval, reject, reopen, hold, cancel and subtasks
- Pre-job and post-job checklists for all three disciplines, and PM approval checklists
- SWMS with sign-off and PDF
- Hours capture, labour cost, completion percentages, timesheet pay hours
- Issues module with department routing and history
- Compliance registers: workers, companies, company documents, tickets, inductions
- Equipment and chemical registers, maintenance task generation
- Role-based dashboards and calendars
- Integrations: Zoho CRM, WorkDrive, MDM device sync
- Scheduled reminders and weekly reports
- Notifications by email

### 1.2 Out of scope
- Customer portal (the Creator "Customer" profile has no forms)
- The "Write" and "Developer" profiles (legacy, no persona)
- Test and debug pages and functions (see section 13)
- Arabic and Persian translations in the Creator export
- Migrating plain-text training-portal passwords (see section 11)

---

## 2. Users and roles

Creator has 10 profiles, but five personas share one "Team Leader and Team Member" profile. The Catalyst roles below separate them. Every Creator profile currently has API, PII and ePHI access enabled; Catalyst must be deny-by-default.

| Catalyst role | Creator source | Main screens | Notes |
|---|---|---|---|
| `admin` | Administrator (CEO) | everything | Only role that can delete jobs or tasks that have hours |
| `project_manager` | Project Manager | PM Dashboard, Job Details, approvals | Hidden fields on Jobs: purchases and profit fields |
| `fab_manager` | Fabrication Manager | Fab Manager Dashboard, Workshop | Approves fabrication tasks |
| `install_coordinator` | Installation Coordinator | Install Dashboard, hours reports | |
| `second_ic` | 2 IC | IC Dashboard, Workshop | Create restricted on Jobs |
| `installer` | Team Leader and Team Member | Installer Dashboard, own checklists, Booked Hours | Own and assigned records only |
| `fab_worker` | same | Fab Worker Dashboard, Booked Hours | Own and assigned records only |
| `workshop` | same | Workshop Dashboard | May be `fab_worker` plus a department flag |
| `designer` | same | Design tasks, design checklists | |
| `contractor` | same, employee type "Subby ..." | Installer Dashboard | Stricter than Creator: own records, no employee PII |
| `viewer` | Read | all list screens | Consider masking PII |

Team leader versus team member is a **per-task assignment**, not a role.

### 2.1 Authorization model
1. Role check (coarse), then ownership or assignment check (fine), then field projection.
2. Matrix stored as configuration (module x role x verb plus field allow/deny list) and enforced by one middleware in the API. No per-route hard-coding.
3. Separate verbs for `export`, `import` and `custom_report`. Creator leaves import and export open to all.
4. Scoping uses user id and role claims, not email string comparison.
5. Org hierarchy CEO > Manager > Team Leader is kept as a `manager_of` relation.

Detailed Creator permission matrix and the proposed endpoint matrix are in the extraction notes (kept out of this document for length) and are carried into the build as the seed authorization config.

---

## 3. Target architecture

| Layer | Choice |
|---|---|
| Front end | React (Vite recommended over the unmaintained `react-scripts`), hosted on Catalyst Web Client |
| Functions | **3** (decided): `api` (Advanced I/O: REST, authorization, validation, event publishing), `events` (event handlers and the retry outbox), `jobs` (cron and one-off scheduled jobs). One codebase, shared `lib/` for domain rules and the integrations module. See `docs/CATALYST_PLAN.md` section 8 |
| Database | Catalyst Data Store, 24 tables (`docs/CATALYST_PLAN.md`) |
| Files | Catalyst Stratus (or File Store) for uploads, one `file_asset` table; WorkDrive for job folders (see **[CONFIRM]** 6) |
| Scheduling | Catalyst Cron and Job Scheduling, run by the `jobs` function |
| Email | Catalyst Mail with templates stored as settings |
| Auth | Catalyst Authentication, 11 roles, permission matrix stored as configuration |
| Secrets | Catalyst environment variables, separate for Development and Production |
| Integrations | A shared module used by `events` and `jobs`, not a separate function; the browser never holds CRM or WorkDrive tokens |
| Cost model | Pay as you go, billed on execution time and memory (free tier then per GB-second); the number of functions does not change cost. Confirm current pricing and the per-project minimum in the Catalyst console |

Time zone Australia/Melbourne. Date format `dd-MMM-yyyy`. Twelve-hour clock.

---

## 4. Data model

> **Superseded.** The final data model is in `docs/CATALYST_PLAN.md` (24 tables, Catalyst-native). The tables below describe the Creator entities for reference and traceability only.

### 4.1 Modelling decisions
1. **One `task` table with `task_type`** (design, fabrication, install) plus child tables for type-specific fields. Creator has three near-identical wide tables (`Design_Task`, `Fabrication_Job1`, `Install_Job`).
2. **Checklists become rows, not 80-150 column forms.** `checklist` (task, type pre/post, role TL/TM, owner, status, step statuses, times, hours) plus `checklist_template_question` and `checklist_answer`. Old "OLD" columns go to an archive table or JSON column.
3. **Multi-select lookups become junction tables** (task crew, task signs, SWMS install subtasks, setup notify lists).
4. **Text flags become booleans** (`Project_Manager = "Yes"` and similar). Roles go to a `user_role` table.
5. **Derived and UI fields are not stored:** generated URL/HTML fields, `Set_Mandatory`, `Visibility_Check`, `Internal_Stage`, `Edit_From_URL`, `Redirect_Page`, developer sections.
6. **Rollups are computed** (hours, labour cost, completion %), cached only where the dashboard needs speed.
7. **Clean names.** Drop `Job1`, `SF`, `1/3/4` suffixes and typos (Copmpany, Satge1, Set_Mndatory, Fab_Manger).
8. Numbers and times stored as text in Creator (quantities, dimensions, start times) get proper types.
9. Names split into columns (prefix, first, last, suffix).
10. Status and stage values become enums (strings in Creator contain spaces and ampersands).
11. Keep `crm_deal_id`, `crm_site_id`, `crm_sign_id`, `workdrive_folder_id` as external-id columns.

### 4.2 Core entities

| Entity (Catalyst table) | Creator source | Key fields | Relationships |
|---|---|---|---|
| `job` | Jobs | subject, stage, status, expected finish, agreed and required fab finish, deal id, quote id, hours and cost rollups, completion % (job, fab, install), closure flags | PM, fab manager (employee); has many tasks, signs, sign groups |
| `site` | Sites | name, address, state, post code, lat/long, CRM account/contact/deal ids | many jobs through sign groups |
| `sign_group` | Sign_Groups | name, description, totals | job, site; has many line items |
| `line_item` | Line_Items_SF | product, cost, sell, margin, qty | sign group |
| `sign` | Signs | name, revision, qty, medium, finishing, four stage fields, artwork, RFQ fields, install dates, pictures, CRM ids | job, sign group |
| `task` | Design_Task, Fabrication_Job1, Install_Job | task_type, name, stage, sub_stage, quoted, proposed and booked hours, scheduled date and times, cost type, parent task, workdrive ids, CRM deal | job, site, sign group, PM, fab manager, team leader; crew (junction); signs (junction) |
| `task_fab_spec` | Fabrication_Job1 | fab type, CCV/CNC/CLB dimensions, materials, vinyl brand and colours | task |
| `task_install_detail` | Install_Job | install type, SWMS status, vehicles, tools lists, site contact, supplied materials, address copy | task |
| `task_attachment` | *_Attachment_SF | file ref, workdrive id and link | task |
| `task_comment` | Reopened_Comments, Reject forms | task, kind (reject, reopen), comment, author, date | task |
| `task_stage_history` | new | task, from, to, by, at, comment | task |
| `checklist` | Pre/Post/Job checklists (all 3 disciplines) | type, role, owner, status, step statuses, times, hours, unbilled hours, briefing rating, management and OH&S flags | task, employee |
| `checklist_answer` | checklist question columns | question key, answer | checklist |
| `pm_review` | Project_Manager_Checklist (3 forms) | comment, OH&S flag, management review flag, TL rating | task |
| `swms` | SWMS | status, PCBU details, PPE flags, address, signatures | job, work manager, install tasks (junction) |
| `swms_task` | Task | task text, responsible person | swms, task template |
| `swms_declaration` | Declaration | worker, signature, date | swms |
| `task_template` | Task_Template | name, hazards | |
| `issue` | Issues | subject, department, status, priority, reported by, assigned to, review-for flags, 7 print layouts | employee, site, fab or install task |
| `issue_history` | Issue_Management_History | change, by, at | issue |
| `employee` | Employee_Database ("Workers") | name parts, email, phone, DOB, address, hourly rate, employee type, active, in_mdm | company, primary role, ratings |
| `employee_rating` | Employee_Rating_Details | rating, comment | employee, checklist |
| `company` | Companies1 | name, type, owner contact, is_internal flag, active, notify flags | |
| `company_document` / `company_document_type` | Company_Documents, Copmpany_Document_Types | type, expiry, file | company |
| `worker_ticket` / `ticket_type` | Workers_Tickets, Worker_Ticket_Types | reference, issue and expiry dates, images, training authority, do-not-contact flags (no credentials) | worker, company |
| `worker_induction` / `induction_type` | Workers_Inductions, Workers_Inductions_Type | dates, sites, cost, duration (no credentials) | worker, company, sites |
| `employee_hours` | Employee_Hours | date, fab/install/workshop hours, unbilled, final | employee |
| `timesheet_entry` | Staff_Timesheet | single, time-and-half, double hours, breaks | **[CONFIRM]** 9 (parent link missing in export) |
| `equipment`, `equipment_type`, `equipment_maintenance` | Equipment_Register, Equipment_Type, *_SF, Maintenance_Checklists | tool code "VE - n", off-hire, schedule, frequency days | |
| `chemical` | Chemical_Register | SDS, stock, location | workshop location |
| `workshop_location` | Workshop_Locations | name, area supervisor | employee |
| `device` | Devices | user, UDID, last location, lat/long | employee |
| `setting` and `role_assignment` | Setup | key/value config; role to employee lists; notify and inform-also lists | employee |
| `mail_template` | Mail_Templates | key, subject, body | |
| `primary_role` | Primary_Role_Master | name | |
| `fab_calendar_view` | Fab_and_Install_Task | none, replaced by a query | |

### 4.3 Not migrated
`Companies_OLD`, `Sheet1` (flat labour-cost import, replaced by a computed report), `Alert`, `Alert_Install`, `Alert_Install_New` (UI stubs), `Awaiting_Submission3/4`, `Design_Task_Checklists`, `Fabrication_Job_Checklists`, `Install_Job_Checklists` (superseded), `Project_Manager_Checklist1` and the reject dialogs (become modals and API actions). Historical data in legacy checklist forms is archived once, read-only.

### 4.4 Key integrity rules
- A task belongs to exactly one job. A subtask references the **root** parent.
- Job cannot gain tasks when `stage = Completed - Closed`.
- A checklist belongs to one task, one owner, one type; unique on (task, owner, type).
- `Job_Subject` and Job-level CRM fields are read-only after creation except for admin.
- Deleting a task with booked hours is admin-only and soft-deletes.

---

## 5. Functional requirements

IDs are used for traceability into the build backlog.

### 5.1 Jobs
- **JOB-1** Create a job from a CRM Deal conversion. Project Manager is derived from the Deal owner.
- **JOB-2** List with tabs: All, My Open, My Jobs, Preparation, Ongoing, Completed. Filters: stage, PM, fab manager.
- **JOB-3** Job Details screen: header (name, stage, folder links, completion gauge, required and agreed fab finish), KPI blocks for Management/Design, Fab and Install (total, open, overdue, %), embedded location, signs and the three task tables.
- **JOB-4** Add Design, Fab, Install and Minor Install tasks from a job (see WORKFLOWS section 3). Direct task creation outside a job is rejected with the message "You cannot create a Task here. Please create it from within your job".
- **JOB-5** Close job: available at 100% complete. Stage becomes Completed - Closed, closure report email sent once, CRM Deal updated.
- **JOB-6** Stage rollup after every task stage change (WORKFLOWS section 2.1).
- **JOB-7** Edit validation: Expected_Job_Finish, Stage, File location on VE server and Job_Subject required.
- **JOB-8** Admin-only editing of Deal link and Job created date. Rollup fields are read-only.
- **JOB-9** Job profitability fields are hidden from roles listed in section 2.

### 5.2 Tasks (all types)
- **TSK-1** Stage transitions only through named actions that validate the current stage and caller role (state machines in WORKFLOWS sections 4-6). Every transition writes `task_stage_history`.
- **TSK-2** Actions: submit for approval, approve, reject, reopen, put on hold, take off hold, mark complete - not used, cancel, create subtask, close (external or print-only), reset assignment.
- **TSK-3** Scheduling: setting team leader, crew and date moves Awaiting Scheduling to Scheduled and creates checklists for each assignee. Changing crew deletes and creates checklists idempotently, after the save succeeds.
- **TSK-4** Hours: Quoted, Proposed and Booked. Booked = sum of post-job checklist hours. Labour cost = hours x employee hourly rate.
- **TSK-5** Attachments per task with upload, delete and sync to WorkDrive.
- **TSK-6** Conditional field behaviour (hide and show by type and role, mandatory fields on edit, disabled rollup fields) is implemented in the React form and re-validated server-side.
- **TSK-7** Validation messages must be kept where users know them (for example "Please fill the mandatory fields").
- **TSK-8** Completion percentages recalculate on any change (formula in WORKFLOWS section 10). **[CONFIRM]** 3.

### 5.3 Install tasks
- **INS-1** Install_Type drives which checklists and SWMS apply (table in WORKFLOWS section 4.1).
- **INS-2** Sub-stages Team Briefed, On Site, Finished On site are driven by checklist step completion.
- **INS-3** Task cannot reach Manager Review until every crew member's closure step is complete.
- **INS-4** Team Leader cannot finish the pre-job checklist until SWMS requirements are met.
- **INS-5** PM approval records comment, OH&S question (default No), and optional management-review flag.
- **INS-6** Close Task for External Install and Print Only skips checklists.

### 5.4 Fabrication tasks
- **FAB-1** Fab types with spec panels for CCV, CNC and CLB; Workshop and Maintenance types have special rules (WORKFLOWS section 5).
- **FAB-2** Parent and sub task grouping with sort order by parent, then stage in a custom order, then scheduled date.
- **FAB-3** Repeating workshop tasks: next date computed on Complete.
- **FAB-4** Maintenance tasks are generated from the equipment schedule (Cron) and reschedule the equipment's next due date.
- **FAB-5** Create Workshop Task button on Fab Manager and Workshop dashboards uses a configured Workshop job (not a hard-coded id).

### 5.5 Design tasks
- **DES-1** Stage flow with Awaiting Submission and Approved & Completed (WORKFLOWS section 6).
- **DES-2** Completing requires booked hours.
- **DES-3** Kanban board by stage. Cards turn red when Required_Finish is before today and the task is not Completed or Cancelled.

### 5.6 Checklists
- **CHK-1** Pre-job and post-job checklists exist per task discipline, per assignee, with TL and TM question sets.
- **CHK-2** Install flow: pre-job step 1 briefing, step 2 arrival; post-job step 1 on-site completion, step 2 closure with hours.
- **CHK-3** `GET .../checklist/next` returns which step the user sees (WORKFLOWS section 4.2).
- **CHK-4** Fab: pre-job then post-job; Workshop skips pre-job (**[CONFIRM]** 5).
- **CHK-5** Answers that raise OH&S or WHS issues can auto-create an Issue.
- **CHK-6** Time validation: warn above 14 h, hard stop above 16 h for fab, unbilled hours 0-16.
- **CHK-7** Briefing quality rating 0-10 (UI text says 1-10; use 1-10).
- **CHK-8** Photos and files upload to the file store with task and checklist references.

### 5.7 SWMS
- **SW-1** One SWMS per install task, created with the task. PCBU and company contact defaults come from settings.
- **SW-2** Status flow Created, PM Signed, TL Signed, Not Required.
- **SW-3** Task table from templates, PPE auto-tick (add only), declaration per crew member with signature.
- **SW-4** PDF generation and storage. List views: all, my open, my completed.

### 5.8 Issues
- **ISS-1** Create, update and complete issues with department routing, manager and inform-also resolution from settings.
- **ISS-2** History row for every change; update email shows old and new values.
- **ISS-3** Boards by department with filters All Open and My Open. One screen replaces nine reports.
- **ISS-4** Create CRM Deal from an issue (Management, Civic Billboards, My Reported).
- **ISS-5** Print layouts (7) recreated as PDF and email templates.
- **ISS-6** Fields hidden per role as in Creator (about 18 on Issues).

### 5.9 Hours, timesheets, ratings
- **HRS-1** Employee Hours: daily fab, install and workshop hours, unbilled and final. Total_Hours must include workshop hours (Creator omits them).
- **HRS-2** Pay-hours calculation (WORKFLOWS section 10).
- **HRS-3** Pay-period buttons "Booked hours last / this pay period" use one configuration.
- **HRS-4** Hours-not-filled tiles for fab workers. Count completed post-job checklists with zero hours for tasks scheduled in the past, split workshop versus not, with a configurable cutoff date.
- **HRS-5** Employee rating after task completion.

### 5.10 Compliance registers
- **CMP-1** Workers (employees and subcontractors), companies, company documents, document types, ticket types, induction types.
- **CMP-2** Compliance dashboard: active VE and non-VE workers, overdue tickets, inductions and company documents with expiry today, within 30 days or past; toggles for active-only and all.
- **CMP-3** Reminders by Cron (WORKFLOWS section 11). Respect "do not contact" and opt-out flags.
- **CMP-4** Workers see only their own tickets and inductions.
- **CMP-5** No stored third-party credentials.

### 5.11 Equipment, chemicals, devices
- **EQP-1** Equipment register with type, tool code, off-hire handling, maintenance schedule.
- **EQP-2** Equipment off hire email when an install task finishes on site with off-hire flag.
- **EQP-3** Chemical register by location with SDS links.
- **EQP-4** Devices list and map, driven by MDM sync. Workers with devices filter.
- **EQP-5** Workshop locations with area supervisor.

### 5.12 Dashboards and calendars

| Screen | Role | Content |
|---|---|---|
| PM Dashboard | PM | KPI tiles (my open jobs, install, design; all open fab), jobs table, install calendar, install and design tables, fab calendar |
| Fab Manager Dashboard | Fab Manager | 8 tiles, fab calendar, fab tasks, design tasks, jobs with fab, Create Workshop Task |
| IC Dashboard | 2IC | my open fab tasks, calendar by day, hours last week |
| Install Dashboard | Install Coordinator | tiles, pay-period buttons, install calendar (excluding External and Print Only), install tasks, jobs |
| Installer Dashboard | Installer | my day calendar, my open install tasks |
| Fab Worker Dashboard | Fab worker | hours-not-filled tiles, my calendar, my post-job checklists |
| Workshop Dashboard | Workshop | open workshop tasks, my tasks, my overdue equipment checks (fix: Creator counted the wrong table), equipment register |
| Booked Hours | any worker | my pay-period hours |
| Compliance Dashboard | Admin | see CMP-2 |
| Employee Hours Weekly | Admin | cards and tables per employee and week |

Shared components: `TaskTable` (server-side filter, sort, group, role-scoped, stage-driven action menu), `StageBadge`, `FabTypeBadge`, `KpiTile`, `CalendarView` (week and day), `KanbanBoard`, `ApprovalPanel`, `ChecklistForm`, `SWMSEditor`, `HoursEntry`, `FileLinks`, `IssueBoard`, `ExpiryTable`, `PayPeriodPicker`.

Stage colours: Preparation amber, In Progress blue, Completed green, On Hold pink, Cancelled red, Completed - Closed dark blue. Fab type colours: CCV yellow, CNC green, CLB lime, General/Pack orange, Metal red, Paint blue, Maintenance cyan, LED purple.

### 5.13 Reports
About 200 Creator reports collapse into about 12 parameterised screens (full mapping in section 12). Saved filters replace report variants. `All_Fabrication_Task_API` is kept as a REST endpoint.

### 5.14 Administration
- Settings (role assignments, notification and inform-also lists, hours report recipients, expiry reminder days, pay-period config, workshop job, PCBU defaults)
- Mail templates, primary roles, users and role assignment, import/export (admin only)

---

### 5.15 Rules recovered from the Creator helper functions

- **Completion percentages.** Weighted by quoted hours over the done set (Completed, Complete - Not Used, Manager Review, Cancelled), rounded to a whole number, with fallbacks when total hours are zero. Written to the Job (job, fab and install %) and recalculated after every task create or stage change.
- **Task creation.** Every create is blocked when the Job is Completed - Closed. Design, Fab, Install and Minor Install each create a WorkDrive folder, set the Job to In Progress and recalculate percentages. Install also creates its SWMS row.
- **WorkDrive folders.** The parent folder id comes from the CRM Deal (separate fields for Design, Fab and Install task folders). Sub-folders differ per task type. Rename follows the task name. Delete is soft: the folder is renamed with a "(DELETED)" suffix and its files are trashed.
- **CRM sync.** Job data goes to Deal fields (name, closing date, stage, labour cost fields). Sign edits update the CRM **Assets** module. Site edits update the Sites module. Field maps move into configuration.
- **Employee sync** into the project app is an upsert keyed on the CRM worker id. A sibling function is a no-op and is dropped.
- **Team leader change (install).** If the checklist owner no longer matches the Team Leader, delete both team-leader checklists and re-create only the post-job one. Do this after save, idempotently.
- **Closure and profit emails** have guard flags (`Closure_Email_Sent`, `Profit_Changed`) so each sends once.
- **Issue and email recipients** come from role fields on the Setup row, by department.
- **MDM sync** covers only employees with `In_MDM = Yes`. Devices are upserted by serial number. Devices that return no location are skipped.
- **Does nothing today:** `AJ_Close_all_the_Task` is entirely commented out. Do not build it.
- **Excluded:** test and debug functions. One debug copy of the closure email has an install-hours bug and is not a reference.

## 6. API outline

All JSON, authenticated, role-checked. Prefix `/api`.

| Area | Endpoints |
|---|---|
| Jobs | `GET/POST /jobs`, `GET/PATCH /jobs/{id}`, `POST /jobs/{id}/close`, `POST /jobs/{id}/install-tasks`, `/design-tasks`, `/fab-tasks`, `/minor-install-tasks`, `/workshop-tasks` |
| Tasks | `GET /tasks?type=&stage=&job=&assignee=&group=`, `GET/PATCH /tasks/{id}` |
| Task actions | `POST /tasks/{id}/(submit-for-approval|approve|reject|reopen|hold|release-hold|close|subtasks|mark-not-used|cancel|reset-assignment)` |
| Checklists | `GET /tasks/{id}/checklist/next`, `GET/PUT /checklists/{id}`, `POST /checklists/{id}/steps/{step}/complete` |
| PM review | `GET/POST /tasks/{id}/pm-review` |
| SWMS | `GET/PATCH /swms/{id}`, `POST /swms/{id}/sign`, `GET /swms/{id}/pdf` |
| Issues | `GET/POST /issues`, `PATCH /issues/{id}`, `POST /issues/{id}/crm-deal` |
| People | `GET/POST /employees`, `/companies`, `/tickets`, `/inductions`, `/company-documents` |
| Hours | `GET /hours/employee`, `GET /hours/pay-period`, `PUT /employee-hours/{id}` |
| Equipment | `/equipment`, `/chemicals`, `/workshop-locations`, `/devices` |
| Calendars | `GET /calendar/fab`, `/calendar/install` |
| Dashboards | `GET /dashboards/{role}` |
| Admin | `/settings`, `/mail-templates`, `/roles`, `/import`, `/export` |
| Integration (internal only) | CRM sync, WorkDrive, MDM, PDF generation. Run in `events` and `jobs` through the shared integrations module; not exposed as browser-callable routes |

Standards: pagination, filter and sort on the server, RFC 7807 style errors, optimistic concurrency (`updated_at`) on edits, idempotency key on create-action endpoints.

---

## 7. Integrations

| System | Purpose | Access |
|---|---|---|
| Zoho CRM (Deals, Sites, Assets (the Sign module), Accounts, Contacts) | Job source, stage and cost sync, issue-to-deal | Service credentials, minimum scopes (read Deals, Accounts, Contacts; write specific Deal, Site and Asset fields). The export mentions `Sites_X_Deals`, but no helper function touches it; confirm before including it. |
| Zoho WorkDrive | Task folders, attachments | Service credentials, folder and file scopes only |
| ManageEngine MDM | Device and location sync | Service credentials from secrets |
| Catalyst SmartBrowz (HTML template to PDF) | SWMS and report PDFs | Replaces Zoho Writer merge; verify availability. **[CONFIRM]** 7 |
| Catalyst Mail | All notifications | sender address from settings |

The four Creator OAuth connections request very broad scopes (CRM settings, users, org; WorkDrive org and users; Writer). The rebuild requests only the scopes it uses. Hard-coded CRM account and contact ids, the CRM org id and the Maintenance job id move to configuration. No credentials appear in source or documents.

---

## 8. Notifications

See WORKFLOWS section 13 for the catalogue. Rules:
1. Recipients are resolved by role and settings, never literal addresses.
2. Templates live in the database and are editable by admin.
3. Every send writes a `notification_log` row (event, recipient, status) for audit and retry.
4. Active Creator emails only are migrated; inactive ones need client confirmation.
5. Debug and test mails to developer addresses are dropped.

---

## 9. Inactive Creator logic

About a third of workflows and 6-7 schedules are inactive: old email notifications, old checklist creation, some stage transitions (Open on pre-job complete, Fabrication Started, Team Briefed). The build covers active logic only. Inactive items are listed in the extraction notes; the client decides whether any come back. **[CONFIRM]** 8.

---

## 10. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Deny-by-default authorization on every endpoint; server-side field projection; no secrets in client; PII fields (DOB, address, rate, device identifiers, signatures) restricted by role; audit trail on stage changes and PII reads by admin |
| Privacy | Remove plain-text passwords; mask worker contact data for `viewer` |
| Performance | List endpoints under 500 ms at p95 for 10k tasks; calendars load a date window only |
| Availability | Development and Production Catalyst environments; deploy by `catalyst deploy` from CI |
| Reliability | Integration calls retried with backoff, idempotent, dead-letter log |
| Data integrity | DB constraints plus API validation; soft delete on tasks and jobs |
| Auditability | `task_stage_history`, `issue_history`, notification log |
| Accessibility | WCAG 2.1 AA for staff screens; large touch targets for installer and fab worker mobile screens |
| Mobile | Installer, fab worker and checklist screens must work on phones (Creator has phone and tablet layouts) |
| Observability | Structured logs without PII; error alerting |
| Testing | Unit tests for pure calculations (completion %, pay hours, repeat dates, expiry offsets); API tests for each state transition; role matrix tests |
| Configuration | Single settings table; no hard-coded names, dates, ids or addresses |

---

## 11. Data migration

1. Export Creator data per form through the Creator API or CSV (separate from the `.ds` definition).
2. Order: reference data (roles, companies, document and ticket types, equipment types, task templates) then employees then jobs, sites, sign groups, signs, then tasks, attachments, checklists, SWMS, issues, hours, tickets, inductions.
3. Map Creator record ids to Catalyst ids in a lookup table to preserve relationships and CRM links.
4. Transform: text to number/time, Yes/No text to boolean, split names, normalise stage strings, collapse the three task tables into `task`, split wide checklists into rows, archive OLD columns.
5. **Do not migrate** `Login` and `Password` from Workers_Tickets and Workers_Inductions. If the business needs them, move to a secrets vault, not the database.
6. Files: copy Creator-hosted files to the file store; keep WorkDrive ids as-is.
7. Run a reconciliation report (counts per entity, orphan checks, hour totals per job) before cut-over.
8. Cut-over plan: freeze Creator writes, final delta load, switch users, keep Creator read-only for an agreed period.

---

## 12. Screen map (Creator to React)

| React screen | Replaces | Variants collapsed |
|---|---|---|
| Jobs | Jobs_Report, Admin_All_Jobs, All_Open_Jobs, Open_Projects, Open_Jobs_PM/TL, Fab_Open_Jobs_PM, Ongoing, Completed, Job_Overview_New, Agreed_Fab_Finish_Date kanban | about 11 |
| Job Details | Job_Details page, Page_Jobs_Jobs | |
| Design Tasks (list and Kanban) | about 30 design reports | |
| Fab Tasks (list, group by job or sign group) | about 25 fab reports plus legacy stage reports | legacy stages mapped to current |
| Fab Calendar | six fab calendars | |
| Install Tasks | All, Page_Jobs_Install_Tasks, Pending_Review, Manager_Review, Open PM, TL and TM | |
| Install Calendar | four install calendars | |
| Unified Calendar | Fab_and_Install_Task_Report | |
| Checklists | all pre/post/completed checklist reports | |
| SWMS | nine SWMS reports | |
| Issues board | nine issue reports | |
| Hours | Install and fab hours reports, Employee_Hours_Report, Staff_Timesheet_Report, Booked_Hours | five |
| Compliance | Workers, Worker_List, Companies, Documents, Tickets, Inductions, Worker_Dashboard | |
| Equipment and Chemicals | registers, maintenance checklists, Workshop_Locations | |
| Devices | All_Devices list and Device_Locations map | |
| Admin | Setup (All_Setups), Mail templates, Primary roles, ratings | |
| Dashboards (7) | PM, Fab Manager, IC, Install, Installer, Fab Worker, Workshop | |

Dropped: Test_Report1/2, Booked_Hours1, old Workers_Dashboard, hidden pivot reports, personal copies (`_Anitha`), `_NEW` copies (pick one), Alert_Install_Report, test actions.

Page menu order is defined near line 86206 of the export. Use it to confirm which screens each role sees before building navigation. **[CONFIRM]** 10.

---

## 13. Items intentionally dropped

- Generated HTML link fields, popup and redirect plumbing, `Set_Mandatory`-style flag fields
- Test and debug functions (AATest, Test, Sample, Debug, K_Test_Delay and similar), debug emails
- Creator-only schedules that mirror records into a calendar form (S9, S10)
- Personal copies of reports and legacy duplicate forms (section 4.3)

---

## 14. Open questions for the client

1. Which of the many duplicate function and report variants are actually used in the live UI?
2. Install checklists: should every crew member wait for the others at each step (older rule), or work independently (latest rule)?
3. Completion percentage basis: Proposed hours or Quoted hours? Should Design be included in the job percentage?
4. Job rollup: should Pending Review, Reopen and To be Assigned tasks block job completion?
5. Workshop fab tasks: skip the pre-job checklist? What happens on Cancel: delete checklists or keep?
6. Fab subtasks: create the WorkDrive folder for the new subtask or reuse the parent's? Keep WorkDrive as the file store or move files to Catalyst?
7. SWMS PDF: the plan generates it with Catalyst SmartBrowz from an HTML template. Does the client need the existing Zoho Writer template layout reproduced exactly?
8. Which inactive workflows and schedules should return?
9. Staff_Timesheet has no employee, task or job link in the export. What is its parent (an Employee_Hours row, an employee, a pay period)? Is Timesheet_Management (empty placeholder page) needed?
10. Which screens does each role see (confirm against the menu definition)?
11. Pay period: start day and length, and the single rule for "this" and "last" pay period.
12. Maintenance next-due: calendar days or business days?
13. Job stage list: are Design, Fabrication, Despatch and Install still job stages?
14. Do the 7 hard-coded internal people (fab manager, directors, managers) map to settings roles as assumed?
15. Should Customer and Read-only profiles be recreated, or dropped?
16. Expiry reminders: the company and worker expiry functions are fully commented out in Creator, and the ticket function flags anything expiring before the **task install date**, not before today. The three day offsets (before, on, after expiry) come from the Setup row and their before/after signs look inverted. What is the intended rule?
17. The job closure email reads install labour from `Install_Labour_Cost_Parent`, not `Install_Labour_Cost`. Which is correct?
18. How often should the MDM device sync run? The export defines no frequency.
19. The fab hours-not-filled cutoff is hard-coded to October 2026. What should the configurable cutoff be?
20. Checklist creation per Install_Type, Fab_Type and role lives in on-validate form workflows, not in any function (a commented-out reconcile algorithm exists for fab). Confirm the rule set in section 5.6.

---

## 15. Delivery phases (proposal)

| Phase | Outcome |
|---|---|
| 0 | Rotate credentials, confirm open questions, agree FSD |
| 1 | Foundation: repo, CI, auth, role matrix, settings, data model, seed data |
| 2 | Master data: companies, employees, sites, signs, jobs, CRM sync |
| 3 | Tasks and state machines, attachments, WorkDrive |
| 4 | Checklists (install, fab, design), PM review, hours and cost rollups |
| 5 | SWMS, issues, notifications |
| 6 | Dashboards and calendars |
| 7 | Compliance, equipment, devices, schedules |
| 8 | Data migration, UAT, security review, Production deploy |

---

## Appendix A. Source coverage

| Region of `Projects.ds` | Lines | Covered |
|---|---|---|
| Forms | 14-15934 | 68 forms |
| Reports | 15935-28286 | ~200 reports |
| Pages | 28287-28383 | 17 pages |
| Deluge functions | 28386-33505 | core helpers: completion %, task creation and sync, issue and email functions, CRM, WorkDrive, SWMS PDF, MDM (section 5.15) |
| Form workflows | 33506-51823 | ~330 workflow entries |
| Schedules | 51824-53119 | 17 |
| Custom actions / functions | 53120-58140 | ~115 |
| Permissions | 58141-62026 | 10 profiles |
| Connections, datasources | 62035-62589 | 4 connections, 3 datasources |
| Web, phone, tablet layouts | 62590-93677 | layout only, not analysed |
