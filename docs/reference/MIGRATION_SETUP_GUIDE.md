# Visual Exposure: Creator to Catalyst Migration Setup Guide

This guide lists everything needed to finish the migration. It is split into:

- **YOU**: setup, configuration, access and decisions that need your Zoho/Catalyst accounts or business knowledge.
- **CLAUDE**: code, schema scripts and UI that Claude builds once your part is done.

Items marked **(verify)** depend on your account, plan or region. Check them in the Catalyst console or official docs before relying on them.

Source of truth for the app definition: `Creator file/Projects.ds`.
Companion analysis: the migration planning report from the earlier session.

---

## Overall flow

```
Phase 0  Security & decisions        (YOU)
Phase 1  Catalyst account setup      (YOU)
Phase 2  Data Store tables           (YOU, or Claude generates a spec/script)
Phase 3  File Store                  (YOU)
Phase 4  Authentication & users      (YOU)
Phase 5  Zoho CRM / WorkDrive / mail connections (YOU)
Phase 6  Export Creator data         (YOU)
 ---- HANDOFF CHECKPOINT: send Claude the "Handoff package" (section at the end) ----
Phase 7  Backend functions           (CLAUDE)
Phase 8  React web application       (CLAUDE)
Phase 9  Workflows, schedules, emails(CLAUDE + YOU for config)
Phase 10 Data migration              (CLAUDE scripts, YOU run/approve)
Phase 11 Testing, security, deploy   (BOTH)
```

---

## Phase 0: Security and decisions (YOU, do first)

### 0.1 Rotate exposed credentials (urgent)
The Creator export contains a hardcoded OAuth `client_id`, `client_secret` and `refresh_token` inside the Deluge function `SK_F_MDM_Fetch_Location` (around line 57954 of `Projects.ds`).

- [ ] Open the Zoho API Console (`api-console.zoho.com.au`) and revoke or regenerate that client's secret and refresh token.
- [ ] Check whether the `Projects.ds` file was shared anywhere (email, chat, repo). Treat it as sensitive.
- [ ] Do not commit `Projects.ds` to a public repository.
- [ ] Note: `Workers_Tickets` and `Workers_Inductions` have `Login` and `Password` text fields. Decide in 0.2 whether these migrate.

### 0.2 Business decisions to record (answer in a short note for Claude)
- [ ] Is Zoho Creator being fully retired? (Plan assumes yes.)
- [ ] Is **Zoho CRM** still the source of Jobs, Sites and Deals? Is sync one-way (CRM to app) or two-way?
- [ ] Keep **WorkDrive** for job/task folders, or move all files to Catalyst File Store?
- [ ] Is **Zoho Writer** document generation (SWMS and similar) still needed? Where are the Writer templates?
- [ ] Is **ManageEngine MDM** device tracking still needed? (`Devices` form, location map.)
- [ ] Is there a **customer portal**? (A `Customer` profile exists in the export.)
- [ ] Should `Workers_Tickets.Login/Password` be migrated? If yes, they must be stored encrypted.
- [ ] How far back should historical data go (all, last N years, open jobs only)?
- [ ] Which of the 186 reports, 17 pages and 112 functions are still used? (A shortlist helps a lot.)
- [ ] Which authority decides roles for a person: the `Role` picklist or the flags (Project Manager, Fabrication Manager, Fabrication 2IC, Trades Person)?
- [ ] Who may perform each stage transition (see Phase 2.4)?

### 0.3 Permission matrix (YOU fill in)
Creator profiles: Read, Write, Team Leader and Team Member, Administrator, Installation Coordinator, Fabrication Manager, Project Manager, Developer, 2 IC, Customer.

- [ ] In Creator go to Settings > Users and export the user list with the profile for each user.
- [ ] For each target role, fill in the matrix below.

| Target role | Sees which records | Can create | Can edit | Can approve/reject | Can delete |
|---|---|---|---|---|---|
| Administrator | all | | | | |
| Project Manager | own jobs | | | | |
| Fabrication Manager | all fab tasks | | | | |
| Installation Coordinator / 2IC | | | | | |
| Team Leader | assigned tasks | | | | |
| Team Member / Installer | assigned tasks | | | | |
| Read-only | | | | | |

---

## Phase 1: Catalyst account and project setup (YOU)

Current state (from `.catalystrc`): project **VisualExposure**, id `105747000000013075`, **Development environment only**, timezone `Asia/Kolkata`.

- [ ] Confirm which Zoho account owns the Catalyst project. (`functions/.../package.json` names a different author.)
- [ ] Confirm the project's **data centre/region** in the Catalyst console. All your Zoho services are Australian (`.com.au`). **(verify)** that the project is in an AU region, because region cannot normally be changed after creation.
- [ ] Check the **plan and quotas** (functions timeout/memory, Data Store rows/storage, File Store size, Cron jobs, Mail quota, number of users). **(verify)**
- [ ] Add team members who will deploy (Catalyst console > Settings > Project Collaborators).
- [ ] Create a **Production** environment when you are ready (only Development exists now).
- [ ] Install and log in to the CLI on your machine:
  ```
  npm install -g zcatalyst-cli
  catalyst login
  catalyst --version
  ```
  Use the `--dc au` style option if your region is not the default **(verify)** exact flag for your CLI version.
- [ ] Confirm Node 22 is installed locally (`node -v`).
- [ ] Decide on version control: initialise git at the **project root** (`Visual-Exposure/`), not only inside `react-app/` (a nested repo with one commit exists there). Add a `.gitignore` for `node_modules`, `build`, `.env*`, and keep `Creator file/` out of the repo.

---

## Phase 2: Data Store tables (YOU create, or Claude supplies a creation script/spec to follow)

You create tables in Catalyst console > Cloud Scale > Data Store. Catalyst adds `ROWID`, `CREATORID`, `CREATEDTIME` and `MODIFIEDTIME` automatically.

Conventions to follow:
- Table names `snake_case`, singular or plural consistently (suggested: plural).
- Every migrated table gets a `creator_id` column (BigInt or Text, indexed if available) to hold the old Zoho Creator record ID.
- Lookups become **Foreign Key** columns (or BigInt holding a ROWID) **(verify)** which Catalyst foreign-key options are available on your plan.
- Use **Var Char** for short text, **Text** for long text, **Int/BigInt**, **Double** for decimals/currency, **Boolean**, **Date**, **Date Time**.
- Mark required columns **Not Null**; mark unique ones (for example employee email) unique.
- **(verify)** limits on columns per table, rows, text length and indexes. The Fabrication/Install/Design task forms have 75 to 109 fields each, so check column limits first.

### 2.1 Reference/master tables
| Table | Key columns (from the export) |
|---|---|
| `roles` | name, description (new) |
| `role_permissions` | role_id, resource, action (new) |
| `primary_roles` | primary_role (from `Primary_Role_Master`) |
| `companies` | company_name, active (Active/Not Active), owner_name, company_type, phone, email, skills_notes, street, suburb, state, post_code, rates (weekday business, weekday AH, Saturday day/night, Sunday day/night, public holiday), billing_notes |
| `company_document_types` | name, description, template file, required_for_new_companies |
| `company_documents` | company_id, document_type_id, issue_date, expiry_date, email_contact, do_not_contact_manager, do_not_contact_company |
| `ticket_types` | name and related (from `Worker_Ticket_Types`) |
| `induction_types` | from `Workers_Inductions_Type` |
| `equipment_types` | equipment_type |
| `workshop_locations` | name, area_supervisor_id, image/file |
| `mail_templates` | name, body (from `Mail_Templates`) |
| `settings` | single-row config (see 2.3) |

### 2.2 Core business tables
| Table | Key columns / notes |
|---|---|
| `employees` | active, first/last name, company_id, primary_role_id, worker_type, sex, date_of_birth, phone, personal_email, **ve_email_address (unique)**, start_date, cessation_date, flags: is_project_manager, is_fabrication_manager, is_fabrication_2ic, is_trades_person, role, hourly_rate, photo file id, skills, emergency_contact, zoho_crm_user_id, in_mdm, catalyst_user_id, creator_id |
| `employee_ratings` | rated_by, employee_id, links to post-job checklists |
| `jobs` | job_subject (required), stage (Preparation, In Progress, Completed, Completed - Closed, On Hold, Cancelled), job_status (Active/Inactive), description, project_manager_id, fab_manager_id, dates (required fab finish, agreed fab finish, expected finish, created, completed), % fab/install/job completed, cost and hours roll-ups (design/fab/install hours and labour costs, purchases, stock purchases), workdrive links, CRM deal id, related quote url, owner email, flags (closure email sent, job close triggered, profit changed, etc.), profit_email_schedule_time, creator_id |
| `sites` | site_name, street, city, state, post_code, country, notes, access notes, tenant and owner contact fields, business_hours, site_code, crm_site_id, job_id, creator_id |
| `sign_groups` | name, job_id, site_id, description, subtotal, total cost, profit margin, tax, grand total |
| `line_items` | sign_group_id plus line item fields (from `Line_Items_SF`) |
| `signs` | job_id, sign_group_id, 54 fields incl. sign number, revision, file attachments |
| `design_tasks` | job_id, sign_id, sign_group_id, project_manager_id, team_leader_id, team_member_id, task_assigned_to_id, stage (Not Started, In Progress, Client Review, On Hold, Completed, Cancelled, Complete - …), quoted hours, dates, notes, creator_id |
| `fabrication_tasks` | job_id, sign_id, sign_group_id, parent_task_id (self), parent_or_sub (Parent Task/Sub Task/Workshop), fab_type, fab_manager_id, team_leader_id, task_assigned_to_id, equipment_register_sf_id, stage and sub_stage, quoted hours, dates, notes |
| `install_tasks` | job_id, site_id, sign_id, sign_group_id, parent_task_id (self), project_manager_id, team_leader_id, other_staff (many-to-many), stage and sub_stage, quoted hours, dates, notes |
| `task_attachments` | task_type, task_id, file id, description (replaces the three `*_Attachment_SF` forms) |
| `checklists` | task_type (design/fab/install), phase (pre/post), task_id, owner employee_id, status, answers (see note), photos, creator_id |
| `checklist_answers` (optional) | checklist_id, question_key, answer. Use only if the checklist design in Phase 7 needs it. |
| `pm_checklists` | task_type, task_id, fields from `Project_Manager_Checklist*` |
| `task_events` | task_type, task_id, event (reject/reopen/hold/approve/comment), comment, actor_id, from_stage, to_stage (replaces the reject/reopen forms) |
| `swms` | 74 fields. See `SWMS` form. Link to install task, sub task, fab task, job, work_manager_id, worker_id |
| `swms_declarations` | swms_id, employee_id, signature, date_time |
| `swms_tasks` | swms_id, task_template_id, person_responsible_id |
| `task_templates` | from `Task_Template` |
| `chemicals` | from `Chemical_Register` (MSDS file, stock, hazard fields) |
| `alerts` | from `Alert*` forms, if still used |

### 2.3 People, hours, issues, equipment
| Table | Notes |
|---|---|
| `worker_tickets` | company_id, worker_id, ticket_type_id, active, reference_number, issue/expiry date, notes, ticket images, training authority, do-not-contact flags, login/password only if approved in 0.2 (encrypted) |
| `worker_inductions` | company_id, worker_id, induction_type_id, site_id, dates, files, same flags |
| `employee_hours` | date, employee_id, install/workshop/fab hours, total, unbilled hours, final billed hours |
| `staff_timesheets` | from `Staff_Timesheet` |
| `issues` | reported_by_id, date, subject, description, location, status, department, priority, assigned_to_id, person_responsible_id, site_id, fab_task_id, install_task_id, due date, completion, emails, deal id and url, images |
| `issue_history` | issue_id, person_responsible_id, notes, timestamps |
| `equipment` | equipment_type_id, workshop_location_id, entered_by_id, file, details |
| `equipment_checklists` | equipment_id, maintenance_checklist_id, assigned_to_id, scheduled_date, status (recurring generation) |
| `maintenance_checklists` | name, equipment_type_id |
| `devices` | worker_id, device fields (only if MDM is kept) |
| `audit_log` | actor_id, entity, entity_id, action, before, after, at (new) |
| `notification_log` | recipient, subject, type, status, sent_at (new, helps with reminder emails) |

### 2.4 Settings and stage reference data
- [ ] `settings` row: Fabrication Manager, Installation Manager, Office Manager, VT Manager, Civic Manager and their "notify also" lists, report recipient lists, expiry reminder offsets (companies, tickets, inductions: days before and after).
- [ ] Stage values:
  - Fab and Install: Awaiting Scheduling, Scheduled, In Progress, Manager Review, Rejected, Reopen, On Hold, Completed, Complete - Not Used, Cancelled.
  - Design: Not Started, In Progress, Client Review, On Hold, Completed, Cancelled, plus the rest of the "Complete - …" value (read the full list from the `Design_Task` form).
  - Jobs: see `jobs` above.
- [ ] **Fill in the allowed-transition table** (YOU decide, Claude implements): for each task type, which stage may move to which, and which role may do it.

| From | To | Allowed roles | Required input (comment, hours, checklist) |
|---|---|---|---|
| Awaiting Scheduling | Scheduled | | |
| Scheduled | In Progress | | |
| In Progress | Manager Review | | all checklists done |
| Manager Review | Completed | | |
| Manager Review | Rejected | | comment |
| Rejected / Completed | Reopen | | comment |
| any | On Hold / Cancelled | | |

### 2.5 After creating tables
- [ ] Export or screenshot the final table definitions (names, column names, types) so Claude can code against the exact schema. In the CLI: `catalyst pull` or the console export **(verify)** what your CLI version supports.
- [ ] Create indexes on the columns used for lookups and filters (job_id, stage, employee ids, dates, creator_id) **(verify)** index support.

---

## Phase 3: File Store (YOU)

- [ ] Open Cloud Scale > File Store and create folders (names are suggestions):
  `employee_photos`, `company_documents`, `worker_tickets`, `worker_inductions`, `design_attachments`, `fab_attachments`, `install_attachments`, `sign_files`, `swms_files`, `chemical_msds`, `issue_images`, `equipment_files`, `checklist_photos`, `generated_documents`, `import_staging`.
- [ ] Record each folder's **folder id** in the handoff package. Claude uses the ids from config, not hardcoded.
- [ ] Check file size limits and total storage on your plan. **(verify)**
- [ ] Decide public or private. Plan for **private** with authorised download through the backend.
- [ ] Estimate how much attachment data exists in Creator (Phase 6) and confirm it fits.

---

## Phase 4: Authentication and users (YOU)

- [ ] In Catalyst console go to Cloud Scale > Authentication and enable it.
- [ ] Choose the sign-in type: **Hosted login** (fastest) or **Embedded** (custom UI in React). Recommended: embedded or hosted, invite-only. **(verify)** options on your plan.
- [ ] Turn **off** public sign-up. Users join by invitation only.
- [ ] Configure allowed domains / redirect URLs: the Catalyst-hosted URL and any custom domain. Add both Development and Production URLs.
- [ ] Define Catalyst **roles** to match the app, for example: `Administrator`, `ProjectManager`, `FabManager`, `InstallCoordinator`, `TeamLeader`, `TeamMember`, `ReadOnly`. The app also keeps its own role table, so keep these in sync.
- [ ] Customise invitation/verification email templates and the sender **(verify)** what is configurable.
- [ ] Set password policy and session settings **(verify)**.
- [ ] **Do not invite everyone yet.** First invite 2 to 3 test users (one admin, one manager, one team member) and use them for testing. Invite the rest after migration is verified.
- [ ] Prepare a spreadsheet of all employees: name, `ve_email_address`, role/flags, active or not, so Claude can generate an invitation script or admin screen.
- [ ] Decide who is invited at cutover: active employees only. Contractors from other companies: separate decision.

---

## Phase 5: Zoho CRM, WorkDrive, mail and other connections (YOU)

Creator currently uses four Zoho OAuth connections (`z_creator`, `zoho_crm`, `workdrive_connection`, `workdrive`). All endpoints are Australian (`.com.au`). Catalyst functions will call Zoho APIs directly with their own credentials.

### 5.1 Zoho CRM
- [ ] Create a **Self Client** (or server-based client) in the Zoho API Console for the **AU** data centre: `https://api-console.zoho.com.au`.
- [ ] Scopes needed (adjust after reviewing needs): `ZohoCRM.modules.ALL` (or only the modules below with READ/UPDATE/CREATE), `ZohoCRM.settings.READ`, `ZohoCRM.users.READ`, `ZohoCRM.coql.READ`. Add file/attachment scopes only if used.
- [ ] Generate a grant token, then exchange it for a **refresh token**. Keep it private.
- [ ] Modules used by Creator: **Deals/Potentials**, **Sites** (custom), **Assets**, **Sites_X_Deals**, **Item_Groups**, and a custom module (`CustomModule5001`) used for attachments. List their **API names** and fields from CRM Setup > Developer Hub > APIs > API Names.
- [ ] Provide a **field mapping** (CRM field API name to app column) for Deals to Jobs, Sites, and Item Groups to Sign Groups/Line Items.
- [ ] Decide sync direction and triggers (on demand, scheduled, or CRM webhook). Webhook needs a public Catalyst function URL.
- [ ] Note any CRM-side workflows that call back into Creator (they will break when Creator is retired). List and disable them at cutover.
- [ ] Store credentials only as Catalyst environment variables / secrets (see 5.5).

### 5.2 WorkDrive (if kept)
- [ ] Add WorkDrive scopes (`WorkDrive.files.ALL`, `WorkDrive.teamfolders.READ`, etc.) to the same or a separate client.
- [ ] Provide the **team folder / parent folder IDs** where job and task folders are created.
- [ ] Describe the current folder naming (per job, per task) so Claude can reproduce it.

### 5.3 Zoho Writer (if kept)
- [ ] Provide the Writer **template IDs** and merge-field names used for SWMS or other documents, and a sample output.

### 5.4 Email
- [ ] Choose the provider: **Catalyst Mail** (verify sender domain `visualgrp.com.au`), Zoho ZeptoMail, or Zoho Mail SMTP. **(verify)** Catalyst Mail quotas and verified-sender requirements.
- [ ] Complete domain verification (SPF/DKIM) for the sender, currently `crm@visualgrp.com.au`.
- [ ] Gather the **email templates and recipients** used in Creator (sendmail is used 154 times). Key ones: new job (Fab Manager), design/install/fab pre-job checklist notifications, post-job completion, reject/reopen, expiry reminders (companies, tickets, inductions), weekly hours report, issues report, profit revision email.

### 5.5 ManageEngine MDM (only if kept)
- [ ] Create a new MDM OAuth client (do not reuse the exposed one) and provide scopes and base URL (`mdm.manageengine.com.au`).

### 5.6 Secrets and configuration
- [ ] Add these in the function's environment variables / secret store **(verify)** the exact Catalyst mechanism and whether Development and Production can differ:
  ```
  ZOHO_AU_ACCOUNTS_URL=https://accounts.zoho.com.au
  ZOHO_CLIENT_ID=
  ZOHO_CLIENT_SECRET=
  ZOHO_CRM_REFRESH_TOKEN=
  ZOHO_WORKDRIVE_REFRESH_TOKEN=
  ZOHO_WORKDRIVE_PARENT_FOLDER_ID=
  MAIL_SENDER=
  FILESTORE_FOLDER_IDS_JSON=
  APP_BASE_URL=
  ```
- [ ] Never paste secrets into chat, the repo, or `.env` files that are committed.

---

## Phase 6: Export Creator data (YOU)

The `.ds` file has **no data**. Everything below must be exported.

- [ ] In Creator, record the **record count for every form** (68 forms). Skip empty ones.
- [ ] Export each populated form's data as CSV/JSON including system fields (ID, Added Time, Added User, Modified Time) and subform rows. Options: Creator data export, report export, or the Creator REST API.
- [ ] Priority order: `Employee_Database`, `Companies1`, `Sites`, `Jobs`, `Sign_Groups`/`Line_Items_SF`, `Signs`, `Design_Task`, `Fabrication_Job1`, `Install_Job`, checklists, reject/reopen forms, `SWMS`, `Task`, `Declaration`, `Issues`/history, `Employee_Hours`, tickets/inductions, equipment, `Setup`.
- [ ] Export files and images (attachments, photos, MSDS, ticket images) and note total size.
- [ ] Place exports in a folder outside the repo (for example `C:\VE-Migration\export\`), one file per form, named exactly after the Creator form.
- [ ] Do not edit data in Creator after the final export during cutover (set to read-only when migrating).
- [ ] Also capture: user and profile list, Writer templates, CRM field list, any scheduled report recipient lists.

---

## HANDOFF CHECKPOINT: what to give Claude

When Phases 0 to 6 are done, provide:

1. [ ] Confirmation that credentials were rotated.
2. [ ] Answers to the Phase 0.2 decisions and the filled permission matrix (0.3) and stage-transition table (2.4).
3. [ ] Catalyst: region, project id, environment names, and that the CLI is logged in.
4. [ ] Table definitions as created (export or screenshots), plus any differences from this guide.
5. [ ] File Store folder ids.
6. [ ] Authentication setup details (hosted or embedded, redirect URLs, role names, test users).
7. [ ] CRM module/field API names and mapping, and which integrations are in scope.
8. [ ] Email provider choice and templates.
9. [ ] Location of the exported data and counts per form.

Claude then needs approval to modify the repo and, separately, approval before any deploy or data import.

---

## Phase 7: Backend functions (CLAUDE builds)

In `functions/visual_exposure_function/` (Advanced I/O, Node 22), with unpinned `@latest` dependencies replaced by pinned versions.

- [ ] Project structure: router, middleware (auth via `zcAuth`, role check, record scoping, validation, error handling, logging), services, repositories.
- [ ] Data access layer for ZCQL/Data Store with paging, filtering and parameterised queries.
- [ ] CRUD APIs: employees, companies, documents, sites, jobs, sign groups, signs, design/fab/install tasks, SWMS, issues, equipment, tickets, inductions, hours, settings.
- [ ] **Stage state machine** endpoints (`POST /tasks/:type/:id/transition`) enforcing the transition table, writing `task_events` and `audit_log`.
- [ ] **Checklist engine**: generate per-assignee pre/post checklists when staff are assigned; complete-all rule moves the task to Manager Review.
- [ ] **Roll-up service**: hours, labour cost, % complete and profit for tasks and jobs (formulas confirmed from Creator before coding).
- [ ] Parent and sub-task creation (fab and install).
- [ ] File endpoints: upload, secure download, delete, linking to rows.
- [ ] User endpoints: current user, invitation from an Employee, deactivate, role assignment.
- [ ] Report endpoints: job overview, fab variance, hours vs quoted, booked hours, issues boards, compliance expiries, with CSV export.
- [ ] Integration modules: CRM (fetch Deals/Sites, optional write-back), WorkDrive, Writer, MDM, each behind a feature flag.
- [ ] Notification service and templates.
- [ ] Tests for permissions, transitions and rollups.

Possible additional functions (Cron / Job Scheduling / Event listeners **(verify)** availability):
- [ ] Daily expiry reminders (companies, tickets, inductions).
- [ ] Weekly employee hours recompute and hours report.
- [ ] Issues report and profit revision email.
- [ ] Recurring equipment maintenance task generation (09:00 Melbourne time).
- [ ] CRM sync job.

---

## Phase 8: React web application (CLAUDE builds)

In `react-app/` (React, JavaScript).

- [ ] Routing, auth guard, role-aware sidebar, access-denied page.
- [ ] Login and invitation acceptance flow.
- [ ] Shared components: data table (server paging, search, filters, export), record form, status badges, stage action buttons, file uploader, related lists, dialogs, toasts, loading/empty/error states.
- [ ] Pages: Dashboard (per role), Jobs, Design/Fabrication/Install tasks (list, calendar, kanban), task detail with checklists, SWMS, Issues, People and Compliance, Equipment and Maintenance, Hours and Timesheets, Reports, Settings and Users.
- [ ] Responsive design with mobile-first task, checklist and photo upload screens for field staff.
- [ ] Build config and Catalyst client hosting settings.

---

## Phase 9: Workflows, schedules and notifications (CLAUDE + YOU)

- [ ] CLAUDE: reimplement the active Creator behaviours (list of the 327 active workflows and 8 active schedules supplied in the report), dropping UI-only show/hide scripts in favour of form config.
- [ ] YOU: review each business rule rewritten from Deluge and confirm or correct it.
- [ ] YOU: create Cron/Job Scheduling entries in the console if required **(verify)**, or approve Claude's CLI-based config.
- [ ] YOU: approve email wording and recipient lists.

---

## Phase 10: Data migration (CLAUDE scripts, YOU run and approve)

- [ ] CLAUDE: write import scripts per table (mapping, ID map via `creator_id`, validation, dry-run mode, report).
- [ ] YOU: run the dry-run in **Development** first. Review counts, orphaned lookups and rollup totals against Creator.
- [ ] Load order: reference data, employees, jobs/sites/sign groups/signs, tasks (parents first), checklists/events/SWMS, issues, hours/tickets/inductions, attachments.
- [ ] Upload attachments to File Store and link them to rows.
- [ ] Final delta import at cutover with Creator set to read-only.
- [ ] Keep a rollback plan (backup of exports, ability to clear and reload tables).

---

## Phase 11: Testing, security and deployment (BOTH)

- [ ] Test each role with a real test user against the permission matrix.
- [ ] End-to-end scenarios: job to tasks to checklists to review to reject/reopen to completion to job rollups.
- [ ] Compare KPIs and reports with Creator using the same data.
- [ ] Security review: authorization on every endpoint, no secrets in the client, file access control, input validation, rate limiting where available.
- [ ] Production: create the Production environment, copy config and secrets, run `catalyst deploy` to production (YOU or approved by YOU), set the custom domain if any.
- [ ] Invite all active users and send a short how-to.
- [ ] Cutover: freeze Creator, run the final import, switch users, disable Creator workflows, schedules and CRM callbacks.
- [ ] After go-live: monitor logs, keep Creator read-only for a defined period, then archive.

---

## Quick reference: who does what

| Task | You | Claude |
|---|---|---|
| Rotate credentials, make business decisions | Yes | |
| Catalyst project, region, quotas, CLI login | Yes | |
| Create Data Store tables | Yes (or follow Claude's spec) | Provides spec/script, codes against it |
| Create File Store folders | Yes | Uses the ids |
| Enable authentication, configure roles, invite users | Yes | Builds the app side |
| Zoho API clients, scopes, tokens, secrets | Yes | Builds integration code |
| Export Creator data and files | Yes | Writes import scripts |
| Backend functions, React app, workflows, schedules | Reviews | Yes |
| Run migrations and deploy | Runs/approves | Prepares scripts and commands |
| Testing and sign-off | Yes | Writes tests, fixes defects |
