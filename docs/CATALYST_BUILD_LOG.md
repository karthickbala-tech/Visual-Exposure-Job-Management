# Catalyst Build Log (Development)

Project **VisualExposure**, Development environment, **India (.in) data center**. Org 60093485853, project 105747000000013075. Built through the Catalyst MCP on 2026-11-02 from `CATALYST_PLAN.md`.

Production must be an **AU** project. Nothing here hard-codes the project, org or table IDs in application code; read them from configuration.

## 1. What now exists

| Resource | State |
|---|---|
| Data Store | **24 tables**, all columns and foreign keys, empty (the earlier 16 empty tables were deleted first) |
| Stratus | Bucket `ve-files-dev` (created in the console): Authenticated template, encryption on, versioning off, PII flag on. Endpoint `https://ve-files-dev-development.zohostratus.in` |
| Cache | Segments `config` and `kpi` |
| Job Scheduling | Job pool `ve_jobs_pool` (Function type, 256 MB) |
| Authentication | **Embedded login enabled** (Web SDK v4, SDK script `catalystWebSDK.js` 4.6.2). Public sign-up off, social logins off, CSS customization off for now (can be enabled when the login page is styled). User limit 1000. **11 custom roles created** (admin, project_manager, fab_manager, install_coordinator, second_ic, installer, fab_worker, workshop, designer, contractor, viewer) plus the default App Administrator and App User |
| Data Store permissions | **Locked down on all 24 tables**: only App Administrator can select, insert, update and delete. App User and the 11 custom roles have **no** direct table access. By default every role had SELECT, which would have let any signed-in user read tables (for example `person.hourly_rate`) from the browser. All data access goes through the `api` function |
| Functions | **`api` (Advanced I/O), `events` (Event) and `jobs` (Job) deployed to Development.** Base URL `https://visualexposure-60093485853.development.catalystserverless.in/server/api/`. Live endpoints: `GET /health` (public), `GET /me`, `GET /jobs` (both require login). The old starter `visual_exposure_function` still exists in the console (never deployed) and should be deleted by the project owner |

Table IDs (ROWID column ID is always table ID + 1):

| Table | ID | Table | ID |
|---|---|---|---|
| company | 105747000000030007 | checklist_template | 105747000000016861 |
| person | 105747000000021398 | checklist | 105747000000023063 |
| site | 105747000000028365 | hazard_library | 105747000000033788 |
| device | 105747000000028724 | issue | 105747000000038147 |
| job | 105747000000033070 | time_entry | 105747000000020732 |
| sign_group | 105747000000033429 | location | 105747000000029766 |
| sign | 105747000000034088 | register_item | 105747000000023422 |
| swms | 105747000000020373 | file_asset | 105747000000025368 |
| task | 105747000000027010 | activity | 105747000000024740 |
| task_assignee | 105747000000027369 | compliance_type | 105747000000034447 |
| task_sign | 105747000000031720 | compliance_item | 105747000000040125 |
| setting | 105747000000027728 | integration_job | 105747000000025727 |

## 2. Differences from CATALYST_PLAN.md

| Plan | Built | Why |
|---|---|---|
| `person.legacy_id` unique | not unique | A table allows at most **2 unique varchar** columns. `person` keeps `user_id` and `email` unique |
| `priority` on issue | `issue_priority` | `priority` is a reserved column name |
| `version` on templates and settings | `version_no` (template: also `template_version` on checklist) | avoid reserved words |
| `is_mandatory` on compliance_type | `is_mandatory_type` | avoid clash with Catalyst's own `is_mandatory` |
| `os` on device | `os_name` | safer name |
| `sites.contact` JSON | `contacts` | name only |
| `company` rates | `company.rates` (JSON text) | rates (weekday, after hours, Saturday, Sunday, public holiday) were missing from the plan; stored as JSON |
| `job.progress` and `job.totals` JSON | separate numeric columns: `percent_fab`, `percent_install`, `percent_job`, `design_hours`, `fab_hours`, `install_hours`, `design_cost`, `fab_cost`, `install_cost` | dashboards filter and sort on these |
| `sign.stages` JSON | four varchar columns: `deal_stage`, `artwork_stage`, `manufacturing_stage`, `install_stage` | filtering |
| soft references | `bigint` columns, not foreign keys, for: `task.parent_id`, `swms.pdf_file_id`, `file_asset.entity_id`, `file_asset.uploaded_by`, `activity.entity_id`, `activity.actor_id`, `setting.updated_by`, `integration_job.entity_id` | polymorphic or optional links, avoids cycles |
| `device.lat/lng`, `site.lat/lng` six decimals | four decimals (about 11 m) | Catalyst clamped the digits |
| `employee_hours` link on checklist | removed | `time_entry.checklist_id` holds the link |

Foreign key delete rules: `CASCADE` for children owned by a parent (task to job, assignees, checklist to task, time entry to person, device to person); `SET NULL` for optional references.

## 3. Platform limits found while building (affect the design)

1. **Text columns hold at most 10,000 characters.** Columns used for JSON (`checklist.answers`, `checklist_template.definition`, `swms.swms_tasks`, `swms.declarations`, `sign_group.line_items`, `task.spec`) can overflow. Mitigation to decide in the spike: move large JSON bodies to Stratus and keep a pointer, or split answers into a row-per-answer table.
2. **Varchar maximum is 255.**
3. **Max 2 unique varchar columns per table.**
4. **ZCQL returns at most 300 rows and 20 columns per query**, so wide tables (`task`, `job`) need explicit column lists or `SELECT *`.
5. **Booleans come back as the strings `"true"` and `"false"`.** Convert on read.
6. **A parent table cannot be deleted until its child tables are gone**, and Catalyst needs about 10 seconds after a child is deleted.

## 4. Not done, and why

| Item | Status | Needed from you |
|---|---|---|
| **First user** | Not invited | Invite yourself from Authentication, Users, with the `admin` role. Do this after the login page exists |
| **Delete starter function** `visual_exposure_function` | Blocked: deleting is irreversible and was not confirmed | Delete it in the console (Functions) or tell me to |
| **Signals / event listeners** | Console only | Configure after the functions exist |
| **Connectors** (CRM, WorkDrive) | Console only | Rotate the leaked Zoho OAuth client first, in the AU region for production |
| **Mail sender** | Needs a verified domain | Confirm the sender address and DNS access |
| **Seed data** | Not loaded | I load `setting`, `checklist_template`, `hazard_library`, `compliance_type` after the functions exist |

## 5. Verification

- `List_All_Tables` returns exactly the 24 plan tables.
- Every foreign key listed in the plan was created.
- No data has been inserted. All counts are zero.
