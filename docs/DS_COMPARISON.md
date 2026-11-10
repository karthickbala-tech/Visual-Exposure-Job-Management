# Creator DS reference vs the Visual Exposure app (Phase 2)

Source: `Creator file/Projects.ds` (text export of the Creator application "Projects", 93,688 lines, 68 forms). Field lists were read with a parser run over the export; the parser output is kept outside the repo. The app side was read from `web/src/components/JobForm.tsx`, `web/src/pages/Jobs.tsx`, and `functions/api/lib/services/jobs.js`.

Rules used for this document:
- DS names are kept as the on-screen labels. Backend column names follow `docs/CATALYST_PLAN.md`.
- A row is only marked "missing" after the app code was checked. "Not compared" means the module has not been read yet.
- "Required" means the DS field has `must have` (mandatory).
- Message-only forms (Alert, Awaiting Submission) are UI components, not tables. See `docs/CATALYST_PLAN.md`, section 1.

Legend for the Required action column: **UI** (frontend only), **BE** (needs backend change), **DEC** (needs an owner decision first), **NONE** (matches), **SYS** (system or flag field, shown only if needed).

---

## 1. Jobs (DS form `Jobs`: 53 fields, 1 required)

### 1.1 Fields in the app's job form and grid

| DS field | DS label | DS type | Required in DS | App | Required action |
|---|---|---|---|---|---|
| Job_Subject | Job Name | text | yes | Job Name, required | NONE |
| Stage | Stage | picklist | no | Add: Preparation, In Progress, On Hold. Edit: read-only, worked out from tasks. Grid shows all six values | NONE (DEC: DS lets Completed, Completed - Closed and Cancelled be picked; app derives these from tasks, which is the intended rule) |
| Description | Description | textarea | no | Description | NONE |
| Profit_Email_Schedule_Time | Profit Email Schedule Time | datetime | no | Profit Email Schedule Time (admin) | NONE |
| Closure_Email_Sent | Closure Email Sent | checkbox | no | Closure Email Sent (admin), grid column | NONE |
| Job_Close_Triggered | Job Close Triggered | checkbox | no | Job Close Triggered (admin) | NONE |
| Required_Fab_Finish_Date | Required Fab Finish Date | date | no | Required Fab Finish Date | NONE |
| Expected_Job_Finish | Expected Job Finish | date | no | Expected Job Finish (required on edit) | NONE |
| Agreed_Fab_Finish_Date | Agreed Fab Finish Date | date | no | Agreed Fab Finish Date | NONE |
| Fab_Completed | % Fab Completed | percentage | no | read-only, grid | NONE |
| Install_Completed | % Install Completed | percentage | no | read-only, grid | NONE |
| Job_Completed | % Job Completed | percentage | no | read-only, grid | NONE |
| Project_Manager | Project Manager | picklist | no | Project Manager, grid | NONE |
| Fab_Manager | Fab Manager | picklist | no | Fab Manager, grid | NONE |
| Folder_Location_on_Server | Workdrive Link | text | no | Workdrive Link (admin), grid | NONE |
| File_Location_on_VE_Server | Folder Location on VE Server | text | no | Folder Location on VE Server (required on edit) | NONE |
| Total_Purchases | Total Purchases | decimal | no | Total Purchases (admin) | NONE |
| Stock_Purchases | Stock Purchases | AUD | no | Stock Purchases (admin) | NONE |
| Design_Hours_Booked | Design Hours Booked | decimal | no | not in form or grid | UI (add to grid; value already in the data) |
| Fab_Hours_Booked | Fab Hours Booked | decimal | no | grid | NONE |
| Install_Hours_Booked | Install Hours Booked | decimal | no | grid | NONE |
| Fab_Labour_Cost | Fab Labour Cost | decimal | no | grid | NONE (labour cost is role-restricted; see CLAUDE.md section 4) |
| Install_Labour_Cost | Install Labour Cost | decimal | no | grid | NONE |
| Deal | Deal | picklist | no | Deal (CRM deal ID) | NONE |
| Related_Quote | Related Quote | url | no | Related Quote | NONE |
| Job_Created_Date | Job Created Date | datetime | no | grid (Job Created Date) | NONE |
| Job_Status | Job Status | picklist | no | grid (Job Status) | NONE (DS values Active / Inactive; check the values the backend stores) |

### 1.2 Fields missing from the app

| DS field | DS label | DS type | Required action |
|---|---|---|---|
| Design_Labour_Cost | Design Labour Cost | decimal | UI: add to grid if the backend already returns it; else BE. Role-restricted. |
| Design_Hours_Booked | Design Hours Booked | decimal | UI: grid column (see 1.1) |
| Design_Labour_Cost_Parent | Design Labour Cost - Parent | decimal | DEC: definition needed (open item in `progress.md`) |
| Design_Labour_Cost_Fab | Design Labour Cost - Fab | decimal | DEC: definition needed |
| Fab_Labour_Cost_Parent | Fab Labour Cost - Parent | decimal | DEC: definition needed (open item) |
| Fab_Labour_Cost_Fab | Fab Labour Cost - Fab | decimal | DEC: definition needed (open item) |
| Install_Labour_Cost_Parent | Install Labour Cost - Parent | decimal | DEC: definition needed (open item) |
| Install_Labour_Cost_Fab | Install Labour Cost - Fab | decimal | DEC: definition needed (open item) |
| Job_Completed_Date | Job Completed Date | date | UI: the backend already sets `completed_date` when a job closes (`jobs.js:197`); show it on the job detail and as an optional grid column |
| Owner_Email | Owner Email | email | DEC: the DS puts this under "Not Needed or not visible?" |
| Job_Owner | Job Owner | picklist | DEC: the DS puts this under "Not Needed or not visible?". Needs a schema field, which is blocked until approved. |
| Manufacturing_Owner | Manufacturing Owner | picklist | DEC: the DS puts this under "Not Needed or not visible?" |
| Set_Mandatory | Set Mandatory | checkbox | SYS: an internal flag in the DS. Probably not needed. |
| Way_Sync | 2 Way Sync | checkbox | SYS: CRM sync setting. Belongs in the integration settings, not the job form. |
| Close_all_Task | Close all Task | checkbox | SYS: the app closes a job through the close action (JOB-5), so this is not needed as a field. |
| Job_Has_Fab_Tasks | Job Has Fab Tasks | radio Yes/No | SYS: derived from the tasks. Confirm the app derives it. |
| Job_Has_Install_Tasks | Job Has Install Tasks | radio Yes/No | SYS: derived from the tasks. Confirm. |
| Fab_Profit_Email_Sent | Fab Profit Email Sent | checkbox | SYS: email log flag. Check the outbox table before deciding. |
| Profit_Changed | Profit Changed | checkbox | SYS: email trigger flag |
| CRM_Update_Sync | CRM Update Sync | checkbox | SYS: CRM integration flag |
| View_Record, Edit_Record, Click_to_view_the_Deal | links | url | SYS: Creator record links. Not needed in this app. |

### 1.3 Summary for Jobs

- Section 1.1 lists 27 DS fields. 26 are shown in the app; Design Hours Booked is the one that is not.
- User-facing gaps the app can close without a decision: Design Hours Booked (grid) and Job Completed Date (display).
- Gaps that need a decision first: the four labour cost Parent / Fab fields, Job Owner, Owner Email, Manufacturing Owner.
- The rest are system flags or Creator links. Probably not needed, but each one should be confirmed.
- Note: the DS puts 14 fields under the section "Not Needed or not visible?", which covers Job_Owner, Owner_Email and Manufacturing_Owner. So the owner may already have decided not to show them.

---


## 2. Task forms (Design_Task, Fabrication_Job1, Install_Job)

App side read: `web/src/components/AddTaskForm.tsx` (create: type, name, required finish, description), `web/src/pages/TaskManage.tsx` (dates, quoted hours, crew, hours), `web/src/lib/taskKinds.ts` (kinds and spec fields), `functions/api/lib/domain/fab.js` (server kinds and spec), `functions/api/lib/services/tasks.js`, `functions/api/lib/domain/stages.js`.

### 2.1 Kind list: resolved (the source was already correct)

- The Add Task form offers `CNC Laser`, `CNC Router`, `General` and `Pack` (`taskKinds.ts`).
- The source list `lib/domain/fab.js` already accepts all four (fixed in commit `7e926f1`). `CNC Laser` and `CNC Router` use the CNC spec.
- The problem was in the generated function copies under `functions/*/lib`, which were out of date. Those copies refused the four kinds. They were regenerated from source with `npm run sync` (ignored build output, not deployed).
- Backend tests after the sync: 298 of 298 pass.
- Still open: the server's CCV, CNC and CLB spec fields are not the DS fields (see 2.4). The kind list is no longer a problem.

### 2.2 Fabrication_Job1 (120 fields, 1 required)

| DS field | DS label | App | Required action |
|---|---|---|---|
| Task_Name | Task Name | name, required | NONE |
| Task_Description | Task Description | description | NONE |
| Fab_Type | Fab Type | kind (picker) | BE: fix kind list (see 2.1). DS also has Workshop and Maintenance, which the server has but the picker omits. Those are created by the system (workshop job, FAB-4), so DEC whether users may pick them. |
| Team_Leader1, Task_Assigned_to | Team Leader, Team Member | crew with roles lead and member | NONE |
| Fab_Manager | Fab Manager | job-level, not on the task | DEC: show on the task, or keep it on the job only |
| Scheduled_Date | Scheduled Date | scheduled_date | NONE |
| Start_Time | Start Time | not stored on the task | DEC: the post-job checklist asks for start and finish times; check whether that replaces this field |
| Quoted_Hours, Proposed_Hours | Quoted Hours, Proposed Hours | quoted hours; Proposed not found | UI: confirm whether "Proposed" is needed |
| Parent_or_Sub, Parent_Fabrication_Task_ID | Parent or Sub, Parent Fabrication Task ID | subtasks (parent_id, parent_or_sub) | NONE |
| Copy_details_from_Parent_Task, Show_Other_Details | UI helper checkboxes | not in app | SYS: a form helper, not needed |
| Repeat, Repeat_Count, Repeat_Interval | Repeat, Every, days/weeks/months | repeat rules (FAB-3) | NONE |
| Maintenance_days | Maintenance days | maintenance tasks (FAB-4) | NONE (confirm) |
| Stage | Awaiting Scheduling, Scheduled, In Progress, Manager Review, Rejected, Reopen, ... | the same stage names in `stages.js` | NONE |
| Sub_Stage | Fabrication Started, Fabrication Done | none found | BE: decide whether the app needs sub-stages for fabrication |
| File_Name, Location_of_files_on_VE_Server | File Name, Location on VE Server | not on the task | DEC: the job already has the VE server path; confirm whether tasks need their own |
| Folder_Location_on_Server, Folder_Location_ID | Workdrive Link, Folder Location ID | 13 files reference folder/Workdrive | confirm on the task screen |
| Jobs, Jobs_Link, CRM_Deal, CRM_Quote_ID | job links and CRM IDs | job-level; CRM ID not on task | DEC: keep at job level |
| Sign_Group, Signs | sign links | sign groups exist (4 files) | confirm the task shows its sign group |
| Group_Description | Group Description from Quote group | none found | BE/CRM: needs the quote group text |
| Width_CCV, Height_CCV, Artwork_CCV, Qty_CCV | Width, Height, Artwork %, Qty | spec: width_mm, height_mm, quantity (no Artwork %) | UI/BE: see 2.4 |
| Reverse_Cut_CCV, Reverse_Weed_CCV | Reverse Cut?, Reverse Weed? (Yes/No) | none | UI/BE: see 2.4 |
| Vinyl_Brand_1..3, Vinyl_Colour_Code_1..3 | Vinyl Brand #1..#3, Colour/Code #1..#3 | spec: material, colour (one each) | UI/BE: see 2.4 |
| Width_CNC, Height_CNC, Artwork_CNC, Qty_CNC | Width, Height, Artwork %, Qty | spec: width_mm, height_mm, quantity | UI/BE: Artwork % missing |
| Material_CNC, Material_Thickness_CNC | Material, Material Thickness | spec: material, thickness_mm | NONE (names differ; keep DS labels on screen) |
| Intracut_Part_Female, Intracut_Part_Male | Intracut Part Female/Male (Yes/No) | none | UI/BE: see 2.4 |
| Width_CLB, Height_CLB, Artwork_CLB | Width, Height, Artwork % | spec: letter_height_mm, depth_mm | DEC: the CLB spec in the app is not the DS spec (see 2.4) |
| CLB_Material_CLB, Return_Height | CLB Return Material, Return Height | spec: illumination, depth_mm | DEC: see 2.4 |
| Actual_Hours_Single, _Time_and_Half, _Double, Total_Labour_Cost | Actual hours split and labour cost | booked hours with pay split (payRules) | confirm the task shows the split |
| OHS and management review: OHS_Reported, Management_Review (Needed / Completed), Were_there_any_OH_S_issues (Yes/No) | | ohs and management_review flags | DEC: the DS uses a Needed / Completed state, the app a yes/no flag |
| Equipment_Register_SF | Equipment register | hired equipment (EQP-2) | BE: partly covered; confirm |
| Post-job questions (start, finish, photos, notes, removed material) | | post-job checklist | NONE (check the checklist covers each one) |
| Attachment_Pdf_Document, Attachement_Main, Attachment_Secondary | files | file_asset | NONE |
| Created, View_Record, Edit_Record, Redirect_Page, Click_to_view_the_Deal, View_Report | links and system | not needed | SYS |
| Set_Mandatory, Visibility_Check, Disable_the_Team_Leader_and_Member, Variance, Task_Desc_Updated, Task_Description2 | flags and old fields | not needed | SYS |

### 2.3 Install_Job (81 fields, 1 required)

| DS field | DS label | App | Required action |
|---|---|---|---|
| Task_Name, Task_Description | Task Name, Task Description | name, description | NONE |
| Install_Type | VE Install, External Install, Print Only, VE Subtask, Minor Task | the same five kinds | NONE |
| Parent_Install_Task_ID | Parent Install Task ID | subtasks | NONE |
| Stage | Awaiting Scheduling, Scheduled, In Progress, Manager Review, Rejected, ... | same names | NONE |
| Sub_Stages | Team Briefed, On Site, Finished On site | On Site and Finished On Site (INS-2) | BE: Team Briefed not built (BACKEND_STATUS) |
| Install_Date | Install Date | scheduled date on the task | DEC: confirm the scheduled date is the install date |
| VE_Start_Time, On_Site_Start_Time | VE Start Time, On Site Start Time | none | DEC: decide whether these are needed on the task |
| Team_Leader, Other_Staff | Team Leader, Team Member | crew (lead, member) | NONE |
| Project_Manager | Project Manager | job-level | DEC: as for Fabrication |
| Quoted_Hours, Proposed_Hours | Quoted Man Hours, Expected Job Hours | quoted hours | UI: confirm Expected Job Hours |
| Equipment_Off_Hire_Required, Off_Hire_Number | Off hire question and number | hired equipment goes off hire (EQP-2) | BE: check the number is stored |
| Vehicles | Vehicle(s): Renae the Renault, Dylan the D-Max, Colin the Crew Cab, Gordon, ... | none | DEC: needs a vehicle list (not in the app) |
| General_Tools, Power_Tools, Ladders, Safety_Tools, Digging_Tools, Other_Tools, Access_Equipment_and_Plant, Supplied_Materials, For_Testing | multi-select kit lists and text | none | DEC: decide whether these are checklist items, equipment, or a text note. Needs owner input on the lists. |
| Sites, Street, Suburb, State, Country (PostCode) | Locations and address | site directory with address | NONE (confirm the install task shows its site) |
| Site_Contact | Site Contact | none | UI/BE: needs a field on the site or task (DEC) |
| Views_in_Map | View in Maps | none | UI: optional link from the site address |
| SWMS_Status, SWMS_PDF, Edit_SWMS_Record | SWMS status and PDF | SWMS status (10 files), SWMS PDF (SW-4) | NONE (confirm the statuses match: Created, PM Signed, TL Signed, Completed, Closed, Not Required) |
| Management_Review (Needed / Completed), WHS_Reported (Needed / Completed) | | management_review flag, OH&S flag | DEC: same as Fabrication. The DS says WHS, the app says OH&S. |
| Actual_Hours_Single, _Time_and_Half, _Double, Total_Labour_Cost | booked hours and labour cost | pay split (payRules) | confirm the task shows the split |
| Notes | Internal Job Notes | notes | NONE |
| Attachments, Attachment_Pdf... | files | file_asset | NONE |
| Update_Workers | Update Workers | none | SYS |
| Folder_Location_on_Server, Folder_Location_ID | Workdrive link and ID | Workdrive (13 files) | confirm on the task screen |
| Rich_Text, Task_Desc_Updated, Set_Mandatory, Visibility_Check, Disable_the_Team_Leader_and_Member, Variance, View_Record, Edit_Record, Quoteowneremail, Created | system and old fields | not needed | SYS |

### 2.4 Fabrication spec fields: the app's spec is not the DS spec

The app's spec panel says it is an assumption (`fab.js:5`: "the spec does not list the fields"). The DS now lists the real fields, and they differ.

| Kind | DS fields | App spec fields | Difference |
|---|---|---|---|
| CCV | Width, Height, Artwork %, Qty, Reverse Cut?, Reverse Weed?, Vinyl Brand #1-3, Vinyl Colour/Code #1-3 | material, colour, width_mm, height_mm, quantity | Missing: Artwork %, Reverse Cut, Reverse Weed, brands 2-3, colour/code 2-3. The app has one colour, the DS has three. |
| CNC (Laser, Router) | Width, Height, Artwork %, Qty, Material, Material Thickness, Intracut Part Female, Intracut Part Male | material, thickness_mm, width_mm, height_mm, quantity | Missing: Artwork %, Intracut Female, Intracut Male |
| CLB | Width, Height, Artwork %, CLB Return Material, Return Height | letter_height_mm, depth_mm, illumination, quantity | Mismatch: the app's CLB fields (letter height, depth, illumination) are not in the DS. The DS has Width, Height, Return Material and Return Height. This needs the owner's decision before any change. |

Notes:
- The DS field labels are kept on screen. The app's internal keys (`width_mm`, `quantity`) can stay as they are, since they are backend keys, but the labels must match the DS (for example, "Qty", not "Quantity").
- The DS spec fields are mostly text, not numbers. The app uses numbers for width and height. This should be confirmed before changing the type.

### 2.5 Design_Task (45 fields, 1 required)

| DS field | DS label | App | Required action |
|---|---|---|---|
| Task_Name | Task Name (required) | name, required | NONE |
| Design_Type | Artwork Sign Off, Install Plan, LED Design, Manufacturing Sign Off, Proof Of Posting, Project Management | the same six kinds (`taskKinds.ts`) | NONE |
| Task_Description | Task Description | description | NONE |
| Required_Finish | Required Finish | required finish | NONE |
| Stage | Not Started, In Progress, Client Review, On Hold, Completed, Cancelled, Complete - Not Used | app design stages: Open, To be Assigned, Assigned, In Progress, Client Review, Completed, Approved & Completed, Complete - Not Used (`stages.js`) | DEC: "Not Started" has no app equivalent, and the app uses Open / To be Assigned / Assigned. Keep the DS names on screen or decide the mapping. |
| Project_Manager | Project Manager | job-level, not on the design task | DEC: as for Fabrication |
| Quoted_Hours1, Quoted_Hours | Quoted Hours (and IA version) | quoted hours | NONE (remove the duplicate DS field) |
| Booked_Hours, Actual_Hours_Single | Booked Hours | booked hours (DES-2: hours must be booked before completion) | NONE |
| Labour_Cost1, Labour_Cost | Labour Cost | labour cost in the backend (6 files) | confirm the task shows it; role-restricted |
| Completed | Completed (datetime) | completed date on the task | confirm |
| Team_Leader3, Team_Member, Task_Owner, Task_Assigned_to | team and owner | crew with roles | NONE (Task_Owner: DEC) |
| Attachments, Attachment_Pdf_Document, Attachment_Secondary, Attachement_Main | files | file_asset | NONE |
| Folder_Location_on_Server, Folder_Location_ID | Workdrive link and ID | Workdrive (13 files) | confirm |
| Group_Description | Group Description | none | BE/CRM: needs the quote group text |
| Notes | Internal Task Notes | notes (10 files) | confirm |
| CRM_Quote_ID, CRM_Deal, Jobs, Jobs_Link | CRM and job links | job-level | DEC: keep at job level |
| Signs, Sign_Group | sign links | sign groups (4 files) | confirm |
| Cost_Type | Fab, Parent | none | DEC: needed for the Parent / Fab labour split (open item) |
| Visibility_Check, Set_mandatory, Variance, Task_Description2, Task_Desc_Updated, Edit_Record, View_Record, Created, customize | system and old fields | not needed | SYS |

### 2.6 Task and Fab_and_Install_Task (6 and 8 fields)

Not compared yet. These look like helper forms. Check with the owner before comparing.

---


## 3. Issues (DS forms `Issues`: 35 fields, 5 required; `Issue_Management_History`: 9 fields, 5 required)

App side read: `web/src/pages/NewIssue.tsx` (raise an issue), `web/src/pages/Issues.tsx` (board, list, update, history), `lib/domain/issues.js` (statuses, rules), `functions/api/lib/services/issues.js` (create, update, history, deal).

### 3.1 Matches

| DS field | DS label | App | Result |
|---|---|---|---|
| Issue_Subject * | Issue Subject | Issue Subject, required | NONE |
| Detailed_Description * | Detailed Description | Detailed Description | NONE |
| Department * | Install, Civic Billboards, Workshop, Management, VT/Digital Screens | the same five | NONE |
| Priority * | High, Medium, Low | the same three | NONE |
| Status | To Be discussed, To Be Quoted, Quoted, Quote Sent, In Progress, On Hold, Completed | the same seven (`issues.js`) | NONE |
| Assigned_to | Assigned to | `assigned_to_id` | NONE |
| Next_Steps_Notes, Due_Date | Next Steps, Due Date | next step and due date, required when the status changes (updateProblems) | NONE |
| Completion_Notes | Completion Notes | work completed, required when the issue is completed | NONE (the app calls it "Work completed"; keep the DS label on screen) |
| Install_Review_For, Fabrication_Review_For | Management Review / WHS Reported; Management Review / OH&S Reported | the same choices by department (`reviewFor`) | NONE |
| Fabrication_Job1_Lookup, Install_Job_Lookup | Fabrication Task, Install Task | `task_id`; the department follows the task type | NONE |
| Deal_URL, Deal_ID | Deal URL, Deal ID | "Create deal" (ISS-4) makes a CRM deal once | NONE (confirm the URL and ID are stored on the issue) |
| Update_Details | Update Details (rich text) | the issue history (`issueHistory`) | NONE |
| Direction | Inbound, Outbound, Middle Panel | `billboard_face`, shown for Civic Billboards only | UI/DEC: see 3.2 |
| Location | (text) | `billboard_site`, shown for Civic Billboards only | UI/DEC: see 3.2 |

### 3.2 Gaps

| DS field | DS label | App | Required action |
|---|---|---|---|
| Reported_By * | Reported By (picklist) | the signed-in user is stored (`reported_by_id`); no picker | DEC: does the DS let someone report on another person's behalf? If not, the app already matches. |
| Date | Date | the created time | NONE (confirm the display) |
| Location and Direction | any department | only for Civic Billboards | DEC: the DS asks for these on every issue. Decide whether to show them for all departments. |
| Sites | Locations (picklist of sites) | none | DEC/BE: link an issue to a site from the directory |
| Images | Images (image) | none. Photo attachments were left out in UI phase 7 (`UI_MERGE_PLAN.md`). | BE/UI: file_asset with entity_type issue |
| Person_Responsible | Person Responsible (picklist) | only Assigned to | DEC: the DS has both. Is "Person Responsible" a second person or the same role? |
| Reported_Email | Reported Email | none | DEC: needed for a reply to the reporter? |
| Manager_Email, Inform_Also_1, Inform_Also_2 | Manager Email, Inform Also 1 and 2 | none | DEC/BE: who is told when an issue is raised. Email is limited to 100 a month (`REQUEST_BUDGET.md`), so one message per event with every recipient in `to`. |
| Date_Completed | Date Completed | none found | BE: set it when the status moves to Completed (the jobs service already does this for completed dates) |
| Edit_in_Management | Edit in Management (checkbox) | none | SYS |
| Issue_Management_History_Subform | Issue Management History (grid) | the history panel | NONE (see 3.3) |
| Issue_Management_History fields: Staff Member*, Date-Time*, Person Responsible, Status, Next Step, Work Completed*, Due Date | | history rows with field changes (`diffIssue`) | NONE for the data; confirm the history shows who made each change, when, and the work completed |

### 3.3 Notes

- Status casing: the Issues form uses "To Be Quoted" and the history form uses "To be Quoted". The app uses the Issues form version. Confirm the history form has no separate values.
- The DS field "Completion Notes" maps to the app's "work completed". Keep the DS label on screen.
- The app's "OH&S Reported" (Workshop) and "WHS Reported" (Install) follow the DS exactly.

---


## 4. SWMS (DS form `SWMS`: 82 fields, 3 required)

App side read: `lib/domain/swms.js` (statuses, signing rules, hazards, PPE), `lib/services/swms.js` (storage), `web/src/pages/SwmsPanel.tsx` (the statement), `web/src/pages/SwmsList.tsx` (the queues).

### 4.1 Matches

| DS field | DS label | App | Result |
|---|---|---|---|
| Work_Manager, Signature1 (PM) | Work Manager and signature | "Sign as project manager" (project manager roles only) | NONE |
| Name, Team_Leader_Name1, Team_Leader_Email, Team_Leader_Phone | Person for ensuring compliance (Team Leader), name, email, phone | the team leader signs (only the lead on the task); the crew panel shows the name | NONE for the name. Email and phone are missing (see 4.2). |
| Signature_Team_Leader_Acceptance_at_Job_Briefing | Team Leader acceptance | "Sign as team leader" | NONE (confirm this is the same step, not a separate briefing signature) |
| Subform (Declaration) | Declaration | "Declarations" with a tick and typed full name | NONE. The UI plan chose typed name and tick, so the signature image is not needed. |
| Address | Address Line 1 | "Site address" | NONE |
| SWMS_Status | Created, PM Signed, TL Signed, Completed, Closed, Not Required | Created, PM Signed, TL Signed, Not Required (`lib/domain/swms.js:8`) | Partly: see 4.2 (Completed and Closed) |
| Install_Task_Details, Install_Sub_Task_Details, Fabrication_Task_Details | task links | a SWMS is made with each install task; sub-tasks follow the parent | NONE for install. Fabrication: see 4.2. |
| Project_Description | Work Activity (textarea) | "Work steps (one per line)" | Partly: see 4.2 |
| task (grid) | Job Tasks and Control Measures | work steps | Partly: see 4.2 |
| SWMS_PDF | SWMS PDF | the real PDF (SW-4) | NONE |
| Date_field1, Date_field2 | Signature dates | when each signing happened | NONE (confirm they are stored) |
| Hazards and PPE checkboxes | 26 hazards and 11 PPE items | 21 hazards and 11 PPE items, see 4.3 and 4.4 | Partly |

### 4.2 Gaps

| DS field | DS label | App | Required action |
|---|---|---|---|
| SWMS_Number, Auto_Number | SWMS Number (text) and Auto Number | none | BE: generate a number. Needs the numbering format from the owner (DEC). |
| SWMS_Type | Install Task, Fabrication Task | SWMS only for install tasks (`needsSwms`) | DEC/BE: the DS has a fabrication SWMS. Decide whether fabrication tasks get one. |
| Completed, Closed (SWMS_Status) | Completed, Closed | the app stops at Fully signed (TL Signed) | DEC: what Completed and Closed mean, and who sets them |
| Team_Leader_Email, Team_Leader_Phone | Team Leader email and phone | none | UI/BE: from the team leader's person record |
| Contact_email_Manager, Mobile | Contact email and phone (Manager) | none | UI/BE: from the work manager's person record |
| Company, Direct_Employers_Company_Name, Contact_Email_PCBU, Contact_Phone_PCBU | Direct Employer (PCBU), its name, email and phone | the app stores a PCBU name and address (`pcbu`, `company`); contact fields are not shown | DEC: confirm what PCBU means here, and which contact fields are needed. Company is required in the DS. |
| Principal_Contractor_If_not_Visual_Exposure, Contact_Email_PC, Contact_Phone_PC | Principal Contractor and contacts | none | DEC: needed only when the principal contractor is not VE |
| Contact_email_Company, Contact_Phone_Company | Company contact | none | DEC: as above |
| Project_Details | Project Details (picklist) | none | DEC: list of project types |
| Work activity (Project_Description) | Work Activity (textarea) | the app has work steps, one per line, but no separate work-activity description | UI/BE: add a work activity field, or confirm the work steps replace it |
| task grid (Job Tasks and Control Measures) | a grid of task, hazard and control | work steps (text) | DEC: the DS grid has columns for each step. Decide whether the app needs more than one line per step. |
| Signature1_Image | signature image | typed name (owner's choice) | NONE (per the UI plan) |
| Edit flags: editswms, pmdashboard, installdashboard, allinstalltask, Edit_from_URL, Redirection_URL, Edit_Record, View_Record | Creator navigation | none | SYS |

### 4.3 Hazards: the DS list and the app list differ

The DS has 26 hazard checkboxes. The app has 21, and some are worded differently or missing.

| Topic | DS wording | App | Result |
|---|---|---|---|
| Fall more than 2 m | Risk of a person falling more than 2m | Risk of a fall of more than 2 metres | Same. Use the DS wording on screen. |
| Mobile plant | Movement of powered mobile plant (EWP, cranes, excavators) | Movement of powered mobile plant in the area | Same topic. Use the DS wording. |
| Electrical | Work on or near energised electrical installations or services (power lines) | On or near energised electrical installations | Same topic. Use the DS wording. |
| Hot works | Hot works | Hot works (welding, cutting, grinding) | Same |
| Roads and rail | On or adjacent to roadways or railways used by traffic | On or near a road, railway or other traffic corridor in use | Same topic |
| Dust | Dust producing activities | Dust, fumes or airborne particles | Same topic |
| Telecom tower | Work on telecommunication towers | Work on a telecommunication tower | Same |
| Excavation | Excavation of a hole or trench using mechanical equipment (underground assets) | Excavation deeper than 1.5 metres | DEC: the DS has no depth limit for mechanical excavation. The app's 1.5 m threshold is a different rule. |
| Trench, shaft, tunnel | Trench or shaft deeper than 1.5 m; tunnel (two checkboxes) | Shaft, trench deeper than 1.5 metres, or tunnel (one item) | Partly: the DS keeps them apart |
| Water | In, over or adjacent to water or liquids, risk of drowning | In or near water or liquid that could cause drowning | Same topic |
| Asbestos | Removal or likely disturbance of asbestos | Likely to disturb asbestos | Same topic. The DS also says a control plan counts as a SWMS. |
| Structural temporary support | Structural alterations that require temporary support | Structural alterations that need temporary support | Same |
| Confined space | Work involves a confined space | Confined space | Same |
| Demolition | Work involving demolition | Demolition of a load-bearing part of a structure | Different scope: DS is all demolition |
| Gas mains | On or near pressurised gas distribution mains or piping | On or near pressurised gas mains or piping | Same |
| Chemical, fuel, refrigerant lines | On or near chemical, fuel or refrigerant lines | same | Same |
| Extreme temperature | In an area with artificial extremes of temperature | In an area of artificial extreme temperature | Same |
| Tilt-up / precast | Tilt-up or precast concrete | same | Same |
| Public access | none in DS | Work near the public or an occupied area | App extra (not in the DS) |
| Lifting | none in DS | Crane or lifting operations | App extra (not in the DS). The domain file says this is an assumption. |
| Explosives | none in DS | Use of explosives | App extra (not in the DS) |
| Hazardous substances | Use, storage and disposal of hazardous substances and dangerous goods | none | Missing: add |
| Flammable atmosphere | Work in an area that may have a contaminated or flammable atmosphere | none | Missing: add |

### 4.4 PPE: the DS list and the app list differ

| DS PPE | App PPE | Result |
|---|---|---|
| Hi Visibility Clothing | Hi-vis vest | Same item. Use the DS label. |
| Safety Boots | Safety boots | Same |
| Hand Protection | Gloves | Same item. Use the DS label. |
| Hearing Protection | Hearing protection | Same |
| Safety Glasses | Safety glasses | Same |
| Full Face Shield | Welding mask or face shield | Different: the DS has a full face shield for any task |
| Face Mask | Dust mask or respirator | Different: the DS has a face mask. The app merges dust and respirator. |
| Breathing Apparatus | none | Missing: add |
| Hard Hat | Hard hat | Same |
| Sun Protection | Sun protection | Same |
| Fall Arrest Harness | Harness and fall arrest | Same item. Use the DS label. |
| none | Long sleeves and pants | App extra (not in the DS) |
| none | Welding mask or face shield | App extra. The DS has Full Face Shield. |

### 4.5 Status and queues

- The list queues (All, My open, My completed, Awaiting PM, Awaiting team leader, Fully signed) cover the DS statuses Created, PM Signed and TL Signed.
- Completed and Closed are not in the app. See 4.2.
- The rule that subtasks have no SWMS of their own (`NO_OWN_SWMS_KINDS`) is an app rule. The DS has a sub-task list on the SWMS, so confirm that the DS also treats sub-tasks as covered by the parent.

---


## 5. Hours (DS forms `Employee_Hours`: 14 fields, 1 required; `Staff_Timesheet`: 9 fields; `Employee_Rating_Details`: 12 fields)

App side read: `lib/domain/hours.js` (weekly totals, pay period, not-filled rule), `lib/domain/payRules.js` (single, time-and-half and double split), `lib/services/hours.js`, `web/src/pages/Hours.tsx`, and the rating rules in `docs/BACKEND_STATUS.md` (HRS-5).

### 5.1 Matches

| DS field | DS label | App | Result |
|---|---|---|---|
| Date_field | Date | the week, one column per day (Mon to Sun) | NONE |
| Employee_Database (required) | Workers | the person in each row | NONE |
| Installation_Hours, Fabrication_Hours, Workshop_Hours | Install, Fab, Workshop hours | summary tiles and the weekly totals | NONE |
| Total_Hours | Total Work Hours | Total | NONE |
| Unbilled_Hours | Total Unbilled Hours | Unbilled (total) | NONE |
| Final_Hours | Total Billed Hours | Final (total minus unbilled, from the weekly roll-up HRS-1) | NONE |
| Work_Date, Start_Time, End_Time, Break_Minutes, hours split | Staff Timesheet fields | a past shift can be added (task, day, hours, unbilled) | Partly: see 5.2 |
| Employee rating: Task_Name, Task_Type, Rating, Staff Member | rating of a person on a task | `POST /tasks/{id}/ratings` (1 to 5 with a comment) and the person's average | Partly: see 5.2 |

### 5.2 Gaps

| DS field | DS label | App | Required action |
|---|---|---|---|
| Installation_Unbilled_Hours | Install Unbilled Hours | one unbilled total, not per type | UI/BE: show unbilled for install and fab separately, or decide the total is enough |
| Fabrication_Unbilled_Hours | Fab Unbilled Hours | one unbilled total | as above |
| Start_Time, End_Time, Break_Minutes | Start, End, Break | a past shift takes hours only | DEC/BE: the shift clock needs a timesheet table (UI plan, Hours phase 8). Decide if start, end and break are needed on a past shift. |
| Single_Time_hrs, Time_Half_hrs, Double_Time_hrs | Single, time and a half, double | the pay split is worked out in `payRules.js` but not shown on the shift or on the weekly table | UI: show the split on the shift form and in the timesheet. Owner's rule: 8 h single, 2 h half, then double (UI plan). |
| Work_Date (timesheet) | Work Date | the shift date | NONE |
| Role | Team Member or Project Manager | not stored with the rating | DEC/BE: store the role the person had on the task |
| Rated_By | Rated By | the rater is the signed-in manager (implied) | UI: show who rated |
| Rating (decimal) | Rating | 1 to 5 (BACKEND_STATUS: "ASSUMPTION: a 1 to 5 scale") | DEC: the DS gives no scale. Confirm 1 to 5, and whether decimals are allowed. |
| Install_Post_Job_Checklists_Lookup, Fabrication_Post_Job_Checklists, Project_Manager_Checklist_Lookup, Project_Manager_Checklist_for_Fab_Lookup | links to checklists | the rating is made on a finished task | NONE (the rating is on the task, not the checklist) |
| Task_Type: Fab, Install | Fab or Install | a rating works on any task | NONE for the data. DEC: the DS has no design rating. Confirm that is intended. |
| Design hours | not in Employee_Hours | the app shows design hours (Design tile and column) | App extra: keep (design hours are booked on design tasks, DES-2) |

### 5.3 Notes

- The app's "Hours not filled in" list (HRS-4) is an app rule, not a DS form. It was taken from the colleague's demo, not the DS. Keep it as an app feature, and confirm the owner wants it.
- Hours are checked against the 14 h confirm and 16 h hard stop (UI plan). The DS has no such limit, so confirm the owner's rule.

---


## 6. Module status for the other forms

Status: **Compared** (section in this document), **Not compared** (field lists are extracted; the app side has not been read yet), **Config / UI** (the plan already decided this is a UI component or a settings value, so no table).

| DS form | Fields (required) | Module in the app | Status |
|---|---|---|---|
| Jobs | 53 (1) | Jobs | Compared (section 1) |
| Design_Task | 45 (1) | Tasks, design | Compared (section 2.5) |
| Fabrication_Job1 | 120 (1) | Tasks, fabrication | Compared (sections 2.2 and 2.4) |
| Install_Job | 81 (1) | Tasks, installation | Compared (section 2.3) |
| Fab_and_Install_Task | 8 (0) | Tasks | Not compared (section 2.6) |
| Task | 6 (0) | Tasks | Not compared (section 2.6) |
| Task_Template | 5 (0) | Settings (task templates) | Not compared |
| Design_Pre_Job_Checklists, Design_Post_Job_Checklists, Design_Task_Checklists | 63, 60, 37 (1 each) | Checklists | Not compared (plan: one JSON template per checklist) |
| Fabrication_Pre_Job_Checklists, Fabrication_Post_Job_Checklists, Fabrication_Job_Checklists | 30, 32, 17 (1 each) | Checklists | Not compared |
| Install_Pre_Job_Checklists, Install_Post_Job_Checklists, Install_Job_Checklists | 95, 90, 37 (0-1) | Checklists | Not compared |
| Project_Manager_Checklist, Project_Manager_Checklist_for_Fab, Project_Manager_Checklist_Design_Task, Project_Manager_Checklist1 | 8, 8, 5, 4 | Checklists (PM review) | Not compared |
| Maintenance_Checklists, Maintenance_Checklist_S_F | 7, 9 | Equipment (maintenance) | Not compared |
| Design_Reject_Form, Fabrication_Reject_Form, Install_Reject_Form, Reject_Design_Tasks, Reject_Install_Form | 3 each (1 required) | Tasks (reject, activity rows) | Not compared (plan: activity rows, not tables) |
| Reopened_Comments, Reopened_Comments_for_Design | 3 each | Tasks (reopen, activity rows) | Not compared |
| Issues | 35 (5) | Issues | Compared (section 3) |
| Issue_Management_History | 9 (5) | Issues (history) | Compared (section 3) |
| SWMS | 82 (3) | SWMS | Compared (section 4) |
| Sites | 29 (6) | Jobs (sites) | Not compared |
| Signs | 59 (1) | Jobs / tasks (signs) | Not compared |
| Sign_Groups | 14 (1) | Jobs / tasks (sign groups) | Not compared |
| Employee_Hours | 14 (1) | Hours | Compared (section 5) |
| Staff_Timesheet | 9 (0) | Hours (timesheet) | Compared (section 5) |
| Employee_Rating_Details | 12 (0) | Tasks (ratings) | Compared (section 5) |
| Employee_Database | 30 (6) | People | Not compared |
| Workers_Inductions | 20 (3) | Compliance (inductions) | Not compared |
| Workers_Inductions_Type | 8 (1) | Compliance (induction types) | Not compared |
| Workers_Tickets | 20 (2) | Compliance (tickets) | Not compared |
| Worker_Ticket_Types | 10 (1) | Compliance (ticket types) | Not compared |
| Companies1 | 21 (9) | Directory (companies) | Not compared |
| Companies_OLD | 3 (0) | Retired | Not compared (check nothing refers to it) |
| Company_Documents | 10 (2) | Directory (documents) | Not compared |
| Copmpany_Document_Types | 6 (2) | Directory (document types) | Not compared |
| Devices | 20 (1) | Devices | Not compared |
| Equipment_Register | 15 (0) | Equipment | Not compared |
| Equipment_Register_SF | 11 (5) | Equipment (sub-form) | Not compared |
| Equipment_Type | 3 (0) | Equipment (types) | Not compared |
| Chemical_Register | 20 (0) | Equipment (chemicals) | Not compared |
| Workshop_Locations | 5 (0) | Settings | Not compared |
| Primary_Role_Master | 1 (0) | Settings (roles, fixed to 11) | Config / UI |
| Setup | 34 (0) | Settings | Config / UI (plan: settings keys) |
| Mail_Templates | 3 (0) | Settings (email templates) | Config / UI (plan: `template.<key>` settings) |
| Declaration | 5 (0) | Unknown; check | Not compared |
| Sheet1 | 78 (0) | Unknown; check | Not compared |
| Line_Items_SF | 8 (0) | Sub-form (of which form?) | Not compared |
| Alert, Alert_Install, Alert_Install_New, Alert_Message | 2-3 each | Messages | Config / UI (done: `Messages.tsx`) |
| Awaiting_Submission3, Awaiting_Submission4 | 2 and 5 | Messages | Config / UI (done: submit-for-review confirm) |
| Design_Task_Attachment_SF, Fabrication_Task_Attachment_SF, Install_Tasks_Attachment_SF | 5 each | Files (`file_asset`) | Not compared |

Several of these forms are sub-forms or extra variants (`_SF`, `_OLD`, `Sheet1`, `Declaration`, `Line_Items_SF`). Their purpose needs confirming with the owner before any work is planned for them.

---


## 7. Next steps

1. Kind list: done (2.1). Regenerate the function copies after every change to `lib/` (`npm run sync`) so they don't go stale again.
2. **Owner decisions**, grouped so one answer closes many rows:
   - Issues: who is told when an issue is raised (Manager Email, Inform Also 1 and 2), and whether Person Responsible is a second person (3.2).
   - Issues: whether Location, Direction and Sites apply to every department, not just Civic Billboards (3.2).
   - Fabrication spec: which CCV, CNC and CLB fields are real. The app's CLB spec is not the DS spec (2.4).
   - Install kit lists (tools, ladders, vehicles, supplied materials) and site contact (2.3).
   - Stage names for design: "Not Started" against the app's Open / To be Assigned / Assigned (2.5).
   - Labour cost Parent / Fab definitions, and Cost_Type (open item from before).
   - Job Owner, Owner Email, Manufacturing Owner (Jobs section 1.2, the DS "Not Needed" section).
   - OH&S and WHS: a Needed / Completed state or a yes/no flag (2.2, 2.3).
3. Issues: done (section 3). SWMS: done (section 4). Hours: done (section 5). All three operational priorities are compared.
   - Hours: confirm the rating scale, whether roles are stored with ratings, and whether the shift needs start, end and break times (5.2).
   - SWMS: decide the hazard and PPE wording, the missing hazards and PPE items, the excavation rule, and whether fabrication tasks get a SWMS (4.2 to 4.4).
4. Ask the owner about the unknown forms: Declaration, Sheet1, Line_Items_SF, Companies_OLD, Task, Fab_and_Install_Task, and which form each `_SF` belongs to.

---

## 8. Changes made after the comparison

Done, with tests passing (298 of 298 backend tests) and the web type check, lint and build passing:

- **Jobs list (section 1):** design hours booked and design labour cost (role-gated) are returned by the existing job list. No new request. Grid columns added: Design Hours Booked, Design Labour Cost (admin), Job Completed Date.
- **Fabrication spec (section 2.4):** the DS fields are added as optional keys in both the backend rules and the picker. Existing keys are kept, so saved specs still validate. CCV gains artwork %, reverse cut and weed, vinyl brands 1 to 3 and colour codes 1 to 3. CNC gains artwork % and intracut female and male. CLB gains width, height, artwork %, return material and return height. Labels use the DS wording.
- **SWMS hazards (section 4.3):** labels changed to the DS wording. Stored keys are unchanged, so saved statements still work. Added: hazardous substances, and flammable or contaminated atmosphere. These two have no automatic PPE, because the PPE rule for them is not in the DS.
- **SWMS PPE (section 4.4):** added Breathing apparatus and Full face shield. Existing PPE names are unchanged, because they are stored as text.

Not done, and why:

- **Labour cost Parent and Fab fields:** the definitions are not in the DS or the app.
- **Job Owner, Owner Email, Manufacturing Owner:** the DS puts these under "Not Needed or not visible?", so they stay hidden.
- **Issue notification recipients and Person Responsible:** need new stored fields, which I can't create without a schema change.
- **Issue Date Completed:** needs a stored column.
- **SWMS Completed and Closed statuses:** change the stored status set.
- **Hours rating scale and role, shift start, end and break times:** need stored fields, and the rating scale is the owner's decision.
- **Install kit lists, vehicles and site contact:** need a decision on where the data lives.
- **Fabrication CCV and CNC spec labels and types:** the DS types for some spec fields are text, not numbers. Changing them would change how saved specs are validated, so they are unchanged.
- **Checklists, compliance, equipment, people, directory, sites and signs, settings, and the reports and workflows:** not yet compared.

---

## 9. Compliance and people (Workers_Tickets, Workers_Inductions, Worker_Ticket_Types, Workers_Inductions_Type, Employee_Database)

App side read: `lib/services/compliance.js`, `lib/seed/complianceTypes.js`, `lib/services/people.js`, `web/src/pages/People.tsx`, `web/src/pages/Compliance.tsx`.

### 9.1 Matches

| DS field | DS label | App | Result |
|---|---|---|---|
| Active_Ticket | Active Ticket? | is_active on the compliance item | NONE |
| Company, Worker | Add New (company or worker) | person or company (one of the two) | NONE |
| Ticket_Types, Workers_Inductions Induction_Types | ticket and induction types | compliance types, with kind ticket, induction or document | NONE |
| Reference_Number | Reference Number | reference_no | NONE |
| Issue_Date, Expiry_Date | Issue Date, Expiry Date | issue_date, expiry_date | NONE |
| Name (Ticket Name) | Ticket Name | type name | NONE |
| Active (worker) | Active / Not Active | is_active (person) | NONE |
| Employer_new | Employer | company_id | NONE |
| Hourly_Rate | Hourly Rate (required) | hourly_rate, admin only, 0 to 1000 | NONE |
| Role / Primary_Role_Lookup | Project Manager, Trade Staff, Fab Manager, Install Coordinator | roles (11 app roles) | Partly: see 9.2 |
| In_MDM | In MDM | mdm_enabled | NONE |
| Employee_Rating_Subform | Employee Rating | ratings (section 5) | NONE |
| Phone_Number, Personal_Email_Address | phone and email | phone, email | NONE |

### 9.2 Gaps

| DS field | DS label | App | Required action |
|---|---|---|---|
| Description_and_notes | Description and notes | none | BE: a notes column on the compliance item (schema). Decision needed. |
| Image_of_Ticket_Card, _2, Image_of_card, _2 | ticket card photos | the file store has a ticket_image kind | confirm the compliance form attaches the card photos |
| Training_Authority | Training Authority | none | BE: schema column (decision) |
| Normal_Years_before_expiry | Normal years before expiry | not stored on the type | BE: schema column. The P2 rule is in the UI (below). |
| Prefered_Trainer, Course_Training_duration, Training_Costs | trainer, duration and cost | none | BE: schema columns (decision). Training costs are sensitive, so role-gate them if stored. |
| Description (ticket types) | Description | none on the type | BE: schema column (decision) |
| Required_for_VE_Workers, Required_for_non_VE_Workers, Required_for_VE_Worker (inductions) | required-for flags | is_mandatory_type (one flag, not split by VE and non-VE) | DEC: split the flag, or keep one. |
| Centre (inductions) | Centre | none | BE: schema column (decision) |
| Induction_Name picklist (Crown, FED Square, JLL, Melbourne Museum, OCEANA GLASS, Vicinity) | site picklist | the sites directory | NONE for the link. Confirm the seed list matches the sites in use. |
| Sites_Lookup (list) | Locations | a site or several | confirm inductions can link more than one site |
| Do_not_contact_Worker_about_this, Do_not_contact_Manager_about_this, _worker_ | do not contact flags | none | DEC: these stop reminder emails for one item. Needs a stored flag and a check in the reminder job. |
| Login, Password (tickets and inductions) | portal login and password | none | NOT COPIED. The DS stores passwords as plain text. Do not add. Ask the owner whether the portal login is needed at all. |
| Edit, Edit_From_URL, Check_the_Edit, z_w_id, Worked_App_ID | Creator navigation and IDs | none | SYS |
| Address, Date of Birth, Sex, Emergency Contact, Skills, Photo, Start Date, Cessation Date | personal and employment details | none | DEC/BE: sensitive personal data. Each needs a schema decision and a privacy check (Sex, Emergency Contact). |
| Zoho_CRM_User_ID | CRM user id | none | SYS (integration; the CRM connection is separate) |
| Trades_Person (checkbox) | Trades Person | roles | DEC: map to a role, or leave out |
| Project_Manager, Fabrication_Manager, Fabrication_2IC (checkboxes) | manager flags | roles | NONE (confirm the roles cover the 2IC) |
| Name prefix (title) | Name | first and last name | DEC: add a title field if needed |
| Worker_Type (for example Employee - FT Installer) | worker type | person_kind (staff or subcontractor) | DEC: the DS has a finer type list |
| Employer (old) | Employer_OLD | none | SYS (retired, check nothing refers to it) |

### 9.3 Expiry rule (P2)

- The add-ticket form on the People page already checks: the issue date is not in the future, and the expiry is after the issue date.
- Added in this batch: a "Set expiry N years after issue" button for the three types that have a rule in the UI plan (`REACT_APP_EXTRACTION.md`, P2): Working at Heights 2 years, Elevated Work Platform (EWP) licence 5 years, Public liability insurance 1 year. The rule is matched by type name, so it stops working if a type is renamed.
- Not added: the plan's other years (First Aid 3, Dogging 5, WorkCover 1, subcontractor agreement 3). These types are not in the app's seed list, so there is nothing to attach the rule to.
- The years should be stored on the type, not in the code. That needs a schema change (see 9.2 "Normal years before expiry").

### 9.4 Login and password

The DS stores a login and a password on each ticket and induction. This app does not copy them. Storing passwords in plain text is a security risk, and the owner should confirm whether this data is needed at all.

---

## 10. Equipment, chemicals and devices (Equipment_Register, Equipment_Register_SF, Equipment_Type, Chemical_Register, Devices, Maintenance_Checklists)

App side read: `lib/services/registers.js` (equipment, chemicals, locations, devices), `lib/domain/registers.js` (status, due dates, tool code, SDS review, devices).

### 10.1 Matches

| DS field | DS label | App | Result |
|---|---|---|---|
| Is_Active | Is Active | status: In service, Off hire, Out of service | Partly: the DS has one tick. The app has three states, which is more. Keep the app's states. |
| Equipment_Name | Equipment Name | name | NONE |
| Equipment_Type | Equipment Type | type (free text) | Partly: see 10.2 |
| Workshop_Locations | Workshop Locations | location_id | NONE (the values differ, see 10.2) |
| Auto_Number, Tool_Code | Auto Number, Tool Code | `nextToolCode` (domain) | NONE |
| Maintenance_Frequency_Days | Maintenance Frequency (Days) | frequency_days | NONE |
| Create_Fabrication_Task, Scheduled_Date | create a maintenance task | maintenance tasks (FAB-4) | NONE |
| Equipment_Register | link to the equipment | equipment id on the maintenance task | NONE |
| Issue_Date_of_SDS | Issue Date of SDS | review_date and SDS review rule | Partly: confirm the review rule uses the issue date |
| Name_Of_Chemical | Name Of Chemical | name | NONE |
| Current_Qty_in_Stock, Max_Stock_Holding | stock levels | stock and unit | Partly: no max stock holding |
| MSDS_Location | MSDS Location (link) | sds_url | NONE |
| Hazard_Clasification | Hazard Classification | hazard_class | NONE (the DS has several classification fields, see 10.2) |
| Serial_Number | Serial Number (device, required) | not stored | BE: schema |
| Device model, OS | Model, OS | model, os | NONE |
| Device location | Address and position | last position, address, last seen | App extra. Position data is sensitive; see 10.2. |

### 10.2 Gaps

| DS field | DS label | App | Required action |
|---|---|---|---|
| Image | equipment photo | none | BE/UI: file_asset with an equipment kind (decision) |
| Model, Serial_Number | Model, Serial Number | model is stored for devices only; equipment has none | BE: schema (decision) |
| Tool_Notes | Tool Notes | none | BE: schema (decision) |
| Entered_By | Entered By | none | BE: schema (decision). Use the signed-in user if added. |
| Purchase_Date, Warranty_Expiry_Date | Purchase and warranty dates | none | BE: schema (decision) |
| Checklist_Details (grid) | Checklist Details | maintenance tasks have a checklist | DEC: the DS grid is per-item. Decide whether the maintenance task checklist replaces it. |
| Equipment_Type (form) | a type list with a description | free-text type on each item | DEC/BE: a type master list, if the owner wants a fixed list. Adding a list is a schema change. |
| Checklist (richtext), Maintenance_Checklist, Maintenance_Checklists form | checklist text per equipment type | none as a template | DEC: the plan (CATALYST_PLAN) keeps checklists as JSON templates. Choose where the maintenance checklist text lives. |
| Assigned | Assigned | the maintenance task's crew | NONE for the task; the DS also picks a person on the plan. DEC. |
| Zoho_Learn, Zoho_Learn_2 | training links | none | DEC: links to training. Low value; decide whether to keep. |
| Proposed_Hours | Proposed Hours | none on the plan | DEC: decide whether maintenance hours need an estimate |
| Workshop_Locations (values) | Paint Prep Area, SAV Room, Metal Fab Area, Letter Fab Mezanine, Kitchen, and others | the app's workshop location list | DEC: confirm the locations match. Seed data changes write to the live Data Store, so do this with the owner. |
| Chemical: Location | a fixed list of chemical locations | the workshop location list | as above |
| Chemical: MSDS (upload) | upload file | a link (sds_url) | DEC: keep the link, or add a file (file_asset) |
| Storage, Handling, General_Details | three text areas | none | BE: schema (decision) |
| Flammable_Code, Hazchem_Code, Dangerous_Good_Clasification, U_N_Number, Poison_Clasification, Emergency_Response_Guide_No, Product_Code | chemical codes | none (one hazard_class) | BE: schema (decision). Safety data: confirm the owner needs these on screen. |
| Max_Stock_Holding | Max Stock Holding | none | BE: schema (decision) |
| Devices: Device_Id, Device_Name, Device_Type, Product_Name, Platform_Type, OS_Version, Device_Capacity, UDID, Wifi_Mac, Owned_By, Customer_Name, Customer_ID | device details | model, os only | BE: schema and MDM sync (decision). The MDM sync needs credentials (EQP-4 in BACKEND_STATUS). |
| Devices: User_Email, User_ID, User_Name, Worker_Name, Address | the person using the device | person_id (linked person) | DEC: the DS stores the same person's details again. The app links to the person record instead, which is better. Keep the link. |
| Devices: Serial_Number (required) | Serial Number | none | BE: schema (decision). Serial numbers are sensitive (the app's own comment), so the grant stays devices-only. |

### 10.3 Notes

- Devices are gated by their own grant (`devices` view). That matches the app's rule for sensitive positions.
- The app's maintenance flow (FAB-4) already covers the DS "Create Fabrication Task" behaviour.
- No code change was made in this section. Every gap here needs a stored field or an owner decision.
