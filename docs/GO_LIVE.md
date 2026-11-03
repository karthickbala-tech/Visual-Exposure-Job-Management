# Go-live plan: production on a new Catalyst project in the AU data center

Status: prepared 2026-11-02. Nothing in this document has been run against production. The Development project (India data center) stays the test bed; **production must be a separate AU project** so customer data stays in Australia.

Legend: **[You]** needs your login or a decision. **[Me]** I can do it once the AU project is connected. **[Both]** needs a console action and a check.

---

## 1. What I need from you before anything starts

| # | Item | Why |
|---|---|---|
| 1 | **Rotate the Zoho OAuth client** at `api-console.zoho.com.au` (the old credentials from the Creator export are still valid until you revoke them) | Security. Also needed for the CRM, WorkDrive and MDM connections |
| 2 | **Create the AU Catalyst project** (console.catalyst.zoho.com.au) and connect the Catalyst MCP to it | I build production the same way I built Development |
| 3 | **A Creator data export** per form (CSV or JSON from Zoho Creator, Reports, Export). The `.ds` file we have is the design only, with no records | The migration needs the actual rows |
| 4 | **Sender address for email** and DNS access to its domain | Catalyst Mail only delivers from a verified domain (DKIM and SPF) |
| 5 | **The real checklist wording, SWMS fields and compliance types** from the Creator forms | Everything seeded today is placeholder wording |
| 6 | **A production domain** (for example `projects.visualexposure.com.au`), if wanted | Custom domain and CORS |
| 7 | **Decisions in section 8** (rules I assumed) | Business sign-off |

---

## 2. Create the production project

1. **[You]** Create project `VisualExposure` in the **AU** data center. Note the project id and org id.
2. **[Me]** Create the 24 tables, columns and foreign keys. The definitions live only in Development today, so I will read them from Development through the MCP and create them in AU with a script, rather than retyping them. Then lock table permissions exactly as in Development: only App Administrator may select, insert, update or delete; no other role has table access, because every read and write goes through the `api` function.
3. **[Me]** Create two cache segments (`config`, `kpi`) and one job pool (`ve_jobs_pool`, Function type, 256 MB). Record their ids; they are set as environment variables (section 3).
4. **[You]** Authentication: enable **embedded** login (Web SDK v4), switch public sign-up **off**, create the 11 roles with these exact names: `admin`, `project_manager`, `fab_manager`, `install_coordinator`, `second_ic`, `installer`, `fab_worker`, `workshop`, `designer`, `contractor`, `viewer`. The built-in "App Administrator" also maps to admin.
5. **[You]** Stratus: create a bucket (suggested name `ve-files-prod`), Authenticated template, encryption on, versioning off. Then set the bucket's **CORS**: allow origins = the production app address, methods `PUT` and `GET`, header `content-type`. Without CORS, photo uploads are blocked by the browser.
6. **[Me]** Deploy: `npm run sync`, then `catalyst deploy` for `api`, `events`, `jobs` and the client (`web/dist`).
7. **[Me]** Seed reference data by calling the admin endpoints once each: `POST /admin/seed-templates` and `POST /admin/seed-compliance-types` (repeatable; they only add what is missing).
8. **[You]** Invite the first user with the `admin` role. Then add everyone else, each with the matching role. A person row (by email) is created or linked by the migration or by an admin in the People screen.

## 3. Environment variables (set on the functions in the AU project)

| Variable | Used by | Value |
|---|---|---|
| `STRATUS_BUCKET` | api | the production bucket name |
| `CACHE_SEGMENT_KPI`, `CACHE_SEGMENT_CONFIG` | api, jobs | the production segment ids |
| `MAIL_FROM` | api, jobs | the verified sender address. Email is skipped (and logged) until this is set |
| `APP_URL` | api, jobs | the production app address, used for links in emails |
| `CRM_WEBHOOK_SECRET` | api | a long random secret. The deal-won webhook returns 503 until it is set |
| `BUSINESS_TZ` | api, jobs | optional; default is Australia/Melbourne |

Never put these in the repository. The development ids hard-coded as fallbacks in the code are for Development only, which is why production must set them.

## 4. Scheduled jobs to create in production

All run the `jobs` function, with the parameter `job`.

| Job (`job` parameter) | Schedule | State |
|---|---|---|
| `compliance-due` | daily 07:00 Melbourne | created in Dev 3 Nov 2026 as cron `compliance_due_daily` (expression `0 7 * * *`, Australia/Melbourne); **first run not yet confirmed** |
| `drain-outbox` | every 5 minutes | created in Dev 3 Nov 2026 as cron `drain_outbox_5min` (expression `*/5 * * * *`); **first run not yet confirmed**. The API echoes `cron_detail` hour/minute 0 for both, so check `success_count` in the console after the first interval |
| `weekly-hours-report`, `weekly-issues-report`, `maintenance-tasks`, `profit-digest`, `mdm-sync` | per FSD | **not built** |

## 5. Connections (needs the rotated OAuth client)

1. **[You]** In the AU Zoho API console, create a new server-based client; add the scopes for CRM (deals, assets), WorkDrive (files, folders) and MDM.
2. **[Both]** Create a Catalyst **Connection** for each, authorise it, and I add one client function per integration to `lib/integrations/handlers.js` (the queue, retry rules and tests exist).
3. **[You]** In Zoho CRM, create the "deal won" webhook: `POST <production api>/server/api/webhooks/crm/deal-won`, header `x-webhook-token: <CRM_WEBHOOK_SECRET>`, JSON body with `deal_id`, `deal_name` and optionally `owner_email`, `description`, `quote_ref`, `expected_finish`. **Confirm these field names against the real CRM**; they are assumptions.

## 6. Data migration (Creator to Catalyst)

Order follows the FSD (parents before children):

1. Reference data: companies, compliance types, equipment types, task templates.
2. People (workers and subcontractors). **Passwords and the plaintext Login/Password fields in tickets and inductions are never migrated.**
3. Sites, sign groups, signs.
4. Jobs, then tasks, task assignees.
5. Checklists (answers mapped to question keys), SWMS, issues, time entries.
6. Compliance items (tickets, inductions), files (re-upload to Stratus, keep a link to the original).

Rules I will build the script to follow:
- **Idempotent**: every migrated row stores its Creator id in `legacy_id`, and a rerun skips what exists. The 2 allowed unique varchar columns per table are already used by other fields, so `legacy_id` is a plain lookup column.
- **Dry run first**: report what would be created, changed or rejected, with reasons, before writing anything.
- **Reconciliation report** after every run: per table, source row count, migrated count, rejected count with reasons, and totals that should match (jobs by stage, hours and cost per task, open issues, expiring tickets).
- **Soft failures**: a bad row is written to a rejects file and skipped; it never stops the run.
- **Dates and time zones**: Creator dates become Melbourne dates; datetimes become UTC.
- **Limits**: Catalyst text columns hold 10,000 characters, 300 rows per query, 20 columns per SELECT. Wide Creator checklists are mapped to a JSON answers column and checked against the limit.
- Run it first against **Development with a copy of production data**, review the report with you, then run it against production in a quiet window.

Remove all test data (rows whose `legacy_id` starts `seed-`, and jobs, tasks, issues, checklists and compliance records named `TEST`) from Development before using it as a rehearsal target.

## 7. Acceptance testing (UAT) and cut-over

**UAT, one person per role, on a phone and a desktop:**

| Role | Must be able to |
|---|---|
| Project manager | See the dashboard figures, create a job, add tasks, assign a crew, sign the SWMS, approve or reject a task, see overdue items |
| Installer / team leader | See only their own tasks, sign the SWMS as team leader, complete the pre-job checklist (blocked until the SWMS is signed), book hours on the post-job checklist, upload a photo, raise an issue |
| Fab worker, workshop, designer, contractor | See only their own work; cannot see costs or pay rates |
| Viewer | Read only; cannot add anything (including files on issues) |
| Admin | Manage people and compliance records, load templates, change the permission matrix |

**Cut-over:**
1. Freeze Creator (read-only) at an agreed time.
2. Final export, run the migration, review the reconciliation report with you.
3. Switch on the integrations (CRM webhook, schedules).
4. Tell the crews. Keep Creator read-only for an agreed period as the fallback.

**Rollback:** until Creator is switched off, rollback is "go back to Creator". The Catalyst data can be wiped and re-migrated, because the migration is repeatable.

## 8. Rules I assumed that need your sign-off

| Rule | Assumption |
|---|---|
| Pay hours | Weekday 06:00-18:00: first 8 h single, next 2 h at x1.5, rest x2; outside that window x2; Saturday first 2 h x1.5 then x2; Sunday and public holidays x2; breaks come off double time first |
| Labour cost | Hours x hourly rate, with no overtime loading. Variance uses the multipliers |
| Shift limit | A shift over 16 hours is refused |
| SWMS | A team leader cannot finish the pre-job checklist until the SWMS is TL Signed or Not Required |
| Issues | Four statuses (Open, In Progress, Resolved, Closed); routed to the department that owns the task type |
| Reminders | 30, 14, 7 and 0 days before expiry (each type can override); sent to the person and every project manager |
| Files | JPEG, PNG, WebP, HEIC up to 15 MB; PDF up to 25 MB |
| Retries to other systems | After 1 min, 5 min, 15 min, 1 h, 6 h, then parked as Failed |
| Permissions | The default matrix in `lib/authz.js`; an admin can override roles through the API (Admin screen) |

## 9. Known gaps (not built)

- Real Zoho CRM, WorkDrive and MDM connections (blocked on credentials).
- SWMS PDF; hazard library; photo answers inside checklists.
- Companies, sites and signs screens. (Equipment, chemicals, workshop locations and devices are built; devices stay empty until the MDM sync exists, and the off-hire rule exists as an endpoint but is not yet tied to an install task finishing.)
- Weekly reports, profit digest, maintenance tasks.
- A screen for editing the permission matrix and for the outbox.
- Role-specific dashboards beyond the single role-aware one.
- Design and fabrication checklists use placeholder wording.
