# Visual Exposure: Workflow Specification

Companion to `FSD.md`. Source: Zoho Creator export `Projects.ds` (app "Projects"). All diagrams are Mermaid and render in GitHub, VS Code and Miro (via the Miro plugin).

Conventions
- Stage names are the exact strings stored in Creator. They become an enum in Catalyst.
- Only **active** Creator workflows are modelled. Inactive ones are listed in FSD section 9 for client confirmation.
- Creator-only UI plumbing (popups, `openUrl`, `parent.refresh`, generated HTML link fields) is dropped and replaced by React routing.
- Items marked **[CONFIRM]** are ambiguous in the export and need a client decision (see FSD section 14).

---

## 1. System context

```mermaid
flowchart LR
  subgraph Users
    PM[Project Manager]
    FM[Fab Manager]
    IC[Install Coordinator / 2IC]
    TL[Team Leader / Team Member<br/>installer, fab worker, workshop, designer, contractor]
    AD[Admin]
  end
  subgraph Catalyst
    WEB[React app<br/>Catalyst Web Client]
    API[api function<br/>REST API + authz middleware]
    EVT[events function<br/>handlers + retry outbox]
    CRON[jobs function<br/>cron + one-off jobs]
    INT[shared integrations module]
    DS[(Data Store)]
    FS[(Stratus / File Store)]
    MAIL[Catalyst Mail]
  end
  CRM[Zoho CRM<br/>Deals, Sites, Signs]
  WD[Zoho WorkDrive<br/>task folders]
  MDM[ManageEngine MDM<br/>device locations]
  Users --> WEB --> API
  API --> DS
  API --> FS
  API --> EVT
  EVT --> DS
  EVT --> MAIL
  CRON --> EVT
  CRON --> DS
  EVT --> INT
  CRON --> INT
  INT <--> CRM
  INT <--> WD
  INT --> MDM
  CRM -- deal won webhook --> API
```

Three functions, decided: `api` answers users, `events` runs side effects and retries, `jobs` runs timed work. CRM, WorkDrive and MDM code is a shared module, not a fourth function.

---

## 2. Job lifecycle (parent record)

A Job is created only from a CRM Deal conversion. Tasks (Design, Fabrication, Install) can only be added from inside a Job.

```mermaid
stateDiagram-v2
  [*] --> JobPreparation: Job created from CRM Deal
  JobPreparation --> InProgress: first task scheduled / design assigned
  InProgress --> OnHold: manual
  OnHold --> InProgress: manual
  InProgress --> Completed: rollup, no task left in an open stage
  InProgress --> Cancelled: manual
  Completed --> CompletedClosed: PM closes job at 100%
  CompletedClosed --> [*]
  Cancelled --> [*]
  note right of Completed
    CRM Deal.Job_Stage mirrors
    Completed / Completed - Closed
  end note
```

Stage values seen in reports: Preparation / Job Preparation, Design, Fabrication, Despatch, Install, In Progress, On Hold, Completed, Completed - Closed, Cancelled. **[CONFIRM]** whether Design, Fabrication, Despatch and Install are still used as job stages or are legacy.

### 2.1 Job stage rollup (`JobStageService.recalculate(jobId)`)

Runs after **every** task stage change (Creator only ran it from a few buttons, which is a gap).

```mermaid
flowchart TD
  A[Task stage changed] --> B[Load all Design, Fab, Install task stages for the Job]
  B --> C{At least one task exists?}
  C -- no --> Z[No change]
  C -- yes --> D{Any task in an open stage?<br/>Awaiting Scheduling, Scheduled, In Progress,<br/>On Hold, Not Started, Client Review, Manager Review}
  D -- yes --> Z
  D -- no --> E[Job.Stage = Completed]
  E --> F[CRM Deal.Job_Stage = Completed]
  F --> G[Recalculate completion percentages]
```

**[CONFIRM]** Pending Review, Reopen and To be Assigned do not block completion in Creator. This is probably unintended.

---

## 3. Adding tasks to a Job

```mermaid
sequenceDiagram
  actor U as PM / Fab Manager
  participant UI as React
  participant API as API
  participant DB as Data Store
  participant WD as WorkDrive
  U->>UI: Add Install / Design / Fab task on Job
  UI->>API: POST /api/jobs/{id}/install-tasks (or design-tasks, fab-tasks)
  API->>DB: Resolve caller to Employee (by login)
  API->>DB: Insert task with defaults
  alt Install task
    API->>DB: Insert SWMS row linked to task and job (status Created, PCBU defaults from config)
  end
  API-->>UI: 201 {id}
  API->>WD: Create task folder (async, retried)
  WD-->>API: folder id and link
  API->>DB: Save folder id and link
```

Defaults on creation

| Task | Stage | Other defaults |
|---|---|---|
| Install | Awaiting Scheduling | Install_Type = VE Install, Quoted_Hours = 0, SWMS_Status = Created, Project_Manager = caller |
| Design | To be Assigned | Quoted_Hours = 0, Cost_Type = Parent, Project_Manager = caller |
| Fabrication | Awaiting Scheduling | Quoted_Hours = 0, Fab_Manager = caller |

Do not copy the Creator leftovers: task name "New Fab Task SK", and hard-coded PCBU contact details (move to the settings table).

---

## 4. Install task

### 4.1 State machine

```mermaid
stateDiagram-v2
  [*] --> AwaitingScheduling
  AwaitingScheduling --> Scheduled: TL + crew + date set<br/>(External Install / Print Only: date only)
  Scheduled --> InProgress: pre-job briefing done (sub-stage Team Briefed)
  InProgress --> OnSite: arrival checklist done (sub-stage On Site)
  OnSite --> FinishedOnSite: post-job part 1 done (sub-stage Finished On site)
  FinishedOnSite --> ManagerReview: all post-job closures complete
  ManagerReview --> Completed: PM approves
  ManagerReview --> Rejected: PM rejects with comment
  Rejected --> InProgress: rework
  Completed --> Reopen: PM reopens with comment
  Reopen --> Scheduled
  AwaitingScheduling --> OnHold
  Scheduled --> OnHold
  InProgress --> OnHold
  OnHold --> Scheduled: take off hold
  AwaitingScheduling --> CompleteNotUsed: mark not used
  Scheduled --> CompleteNotUsed: mark not used
  AwaitingScheduling --> Cancelled
  Completed --> [*]
  CompleteNotUsed --> [*]
  Cancelled --> [*]
```

Install_Type: VE Install, VE Subtask, Minor Task, External Install, Print Only.

| Install_Type | Pre-job checklist | Post-job checklist | SWMS |
|---|---|---|---|
| VE Install | yes | yes | yes |
| VE Subtask, Minor Task | no | yes | follows parent |
| External Install, Print Only | no | no | not required; closed by PM via Close Task |

### 4.2 Checklist progression (per crew member)

Canonical rule is `Open_Checklist4`: no waiting on other crew members. **[CONFIRM]** against the older gated variant (`Open_Checklist2`), which blocked until all crew finished each step.

```mermaid
flowchart TD
  S[User opens checklist for install task] --> P{Sub-stage empty or Team Briefed<br/>and Stage Scheduled / In Progress?}
  P -- yes --> P1{Own pre-job checklist exists?}
  P1 -- no --> P2[Create pre-job: Status Not Completed, owner = user]
  P1 -- yes --> P3{OnsiteStage complete?}
  P3 -- no --> P4[Pre-job step 1: briefing]
  P3 -- yes --> P5{Job_Arrival_Stage complete?}
  P5 -- no --> P6[Pre-job step 2: arrival]
  P5 -- yes --> P7[Show completed pre-job]
  P -- no --> Q{Sub-stage On Site or Finished On site?}
  Q -- yes --> Q1{Own post-job checklist exists?}
  Q1 -- no --> Q2[Create post-job: Status Not Completed]
  Q1 -- yes --> Q3{Onsite_Stageteam complete?}
  Q3 -- no --> Q4[Post-job step 1: on-site completion]
  Q3 -- yes --> Q5{Job_Closure_Stage complete?}
  Q5 -- no --> Q6[Post-job step 2: hours, review flag, rating]
  Q5 -- yes --> Q7[Show completed post-job]
```

Exposed as `GET /api/install-tasks/{id}/checklist/next`. The UI renders the returned step.

Pre-job rule: the Team Leader cannot finish the pre-job checklist until the SWMS reaches the required status (see section 8).

### 4.3 Approval chain (all three task types)

```mermaid
sequenceDiagram
  actor TL as Team Leader
  actor PM as Project / Fab Manager
  participant API as API
  participant DB as Data Store
  participant MAIL as Mail
  TL->>API: POST /{type}-tasks/{id}/submit-for-approval
  API->>DB: Stage = Manager Review (install: sub-stage Finished on site)
  API->>MAIL: "Install / Fabrication / Design Task Approval" to PM (install, design) or Fab Manager (fab)
  PM->>API: GET approval form (PM checklist: comment, OH&S question default No)
  alt Approve
    PM->>API: POST /{type}-tasks/{id}/approve
    API->>DB: Stage = Completed, stamp Completed date, post hours and labour cost
    API->>DB: JobStageService.recalculate
    opt Management review or WHS flag raised
      API->>MAIL: Notify installation manager plus Setup "inform also" list
    end
  else Reject
    PM->>API: POST /{type}-tasks/{id}/reject {comment}
    API->>DB: Stage = Rejected, save comment, reset post-job checklists to Not Completed
    API->>MAIL: Notify assignee (Creator sent this to a test address; fix)
  else Reopen
    PM->>API: POST /{type}-tasks/{id}/reopen {comment}
    API->>DB: Stage = Reopen, save comment in Reopened_Comments
  end
```

Design differs in naming: its approved terminal is "Approved & Completed" and it has an extra Awaiting Submission step before Manager Review. Completing a Design task requires booked hours.

---

## 5. Fabrication task

```mermaid
stateDiagram-v2
  [*] --> AwaitingScheduling
  AwaitingScheduling --> Scheduled: TL + members + Scheduled_Date<br/>(checklists auto-created per person)
  Scheduled --> InProgress: pre-job checklist done (sub-stage Fabrication Started)
  InProgress --> ManagerReview: all post-job checklists done (sub-stage Fabrication Done)
  ManagerReview --> Completed: Fab Manager approves
  ManagerReview --> Rejected: reject with comment
  Rejected --> InProgress: post-job checklists reset
  Completed --> Reopen
  Reopen --> Scheduled
  AwaitingScheduling --> OnHold
  Scheduled --> OnHold
  OnHold --> Scheduled
  AwaitingScheduling --> CompleteNotUsed
  Scheduled --> CompleteNotUsed
  AwaitingScheduling --> Cancelled
  Scheduled --> Cancelled
  Completed --> [*]
```

Rules
- Fab_Type values: CCV, CNC, CLB, General/Pack, Metal, Paint, Maintenance, LED, Workshop. Spec panels exist for CCV (vinyl), CNC and CLB.
- Workshop tasks skip the pre-job checklist and go straight to post-job. **[CONFIRM]** (the Creator code has a bug here).
- Parent/sub tasks: all subtasks hang off the root parent task.
- Repeating workshop task: on Complete, next Scheduled_Date = previous + Days (Weeks x 7, Months x 30).
- Maintenance type: on creation or review, equipment next-due = today + Maintenance_Frequency_Days. **[CONFIRM]** calendar vs business days (Creator uses both).
- Mark Complete - Not Used: delete TL and member checklists, clear TL and assignees, rollup.
- Cancel: Stage = Cancelled, Scheduled_Date null, assignees cleared, Quoted_Hours = 0. It does **not** delete checklists in Creator. **[CONFIRM]**.

### 5.1 Fab checklist selection

```mermaid
flowchart TD
  A[Open fab checklist] --> B{Pre-job checklist exists for user?}
  B -- no --> X1[Message: no checklist assigned to you]
  B -- yes --> C{Pre-job status}
  C -- Not Completed --> D[Open pre-job]
  C -- Completed --> E{Post-job status}
  E -- Not Completed --> F[Open post-job]
  E -- Completed --> X2[Message: already complete]
  C -- other --> X3[Message: not available yet]
```

---

## 6. Design task

```mermaid
stateDiagram-v2
  [*] --> ToBeAssigned
  ToBeAssigned --> Assigned: PM assigns
  Assigned --> InProgress: TL or member selected (Job also moves to In Progress)
  InProgress --> Open: all pre-job checklists Completed
  Open --> AwaitingSubmission: all post-job checklists Completed
  AwaitingSubmission --> ManagerReview: Submit for Approval
  ManagerReview --> ApprovedCompleted: PM approves
  ManagerReview --> Reopen: PM rejects / reopens with comment
  Reopen --> InProgress
  InProgress --> OnHold
  OnHold --> InProgress
  InProgress --> ClientReview
  ClientReview --> InProgress
  ToBeAssigned --> CompleteNotUsed
  ToBeAssigned --> Cancelled
  ApprovedCompleted --> [*]
```

---

## 7. Subtask creation

```mermaid
flowchart TD
  A[Create Subtask on parent] --> B{Job.Stage = Completed - Closed?}
  B -- yes --> X[Reject with error]
  B -- no --> C[Resolve root parent id<br/>if parent is a subtask use its parent]
  C --> D[Copy parent attachments]
  D --> E[Insert new task<br/>name = parent name + ' - Subtask'<br/>Stage = Awaiting Scheduling<br/>Quoted_Hours = 0, hours counters = 0]
  E --> F{Type}
  F -- Install --> G[Install_Type = VE Subtask<br/>clear TL, crew, sub-stage<br/>copy site, tools, vehicles, signs, sign group]
  F -- Fab --> H[Parent_or_Sub = Sub Task<br/>copy Fab_Type and CCV/CNC/CLB specs, times, sign group<br/>clear assignees]
  G --> I[Append new id to latest parent SWMS Install_Sub_Task_Details]
  G --> J
  H --> J[Create WorkDrive folder for the NEW task and copy attachments]
```

**[CONFIRM]** Creator's fab variants pass the parent id when creating the WorkDrive folder. The spec above uses the new task id.

---

## 8. SWMS (Safe Work Method Statement)

```mermaid
stateDiagram-v2
  [*] --> Created: auto-created with VE Install task
  Created --> PMSigned: PM signs (Work Manager)
  PMSigned --> TLSigned: Team Leader signs
  Created --> NotRequired: task marked not used
  TLSigned --> [*]
```

- SWMS holds signatures, PPE tick-boxes, a task table (Task rows from Task_Template) and a Declaration subform per crew member.
- PPE auto-ticking rules only add ticks, never remove them.
- A PDF is generated from the SWMS (Creator used Zoho Writer merge). Replacement: generate the PDF from an HTML template with Catalyst SmartBrowz **(verify availability)**, called from the `api` or `events` function.
- `GS_SWMS_edit_button` and `Edit_SWMS` are navigation only.

---

## 9. Issues module

```mermaid
flowchart TD
  A[Issue raised manually, or auto-created from a checklist question] --> B[Route by Department<br/>Install, Workshop, Management, VT/Digital Screens, Civic Billboards]
  B --> C[Resolve manager and inform-also list from Settings by department]
  C --> D[Email: Issue Reported]
  D --> E[Status: To Be discussed]
  E --> F[In Progress]
  F --> G[Completed]
  F --> H[Add Issue_Management_History row on every change]
  H --> I[Email: Issue Updated with old and new value table]
  G --> J[Email: Issue Completed to reporter, assignee, person responsible]
  J --> K[Clear parent task flag]
  A -. optional .-> L[Create CRM Deal from issue]
```

Status values: To Be discussed, In Progress, Completed (full list to be confirmed against the dropdown). Priority defaults to Low when auto-created.

---

## 10. Hours, labour cost and completion

```mermaid
flowchart LR
  PJ[Post-job checklist<br/>Total_Job_Hours, unbilled hours] --> TH[Task actual hours = SUM of checklist hours]
  TH --> LC[Labour cost = hours x employee Hourly_Rate]
  LC --> JT[Job hours and cost rollups<br/>Fab / Install / Design x Parent / Sub]
  JT --> CRM[Push cost fields to CRM Deal]
  TS[Employee_Hours daily record] --> PAY[Pay-hours calculation]
  PAY --> WR[Weekly hours report email]
```

Calculations (to be implemented as unit-tested pure functions)

| Calculation | Rule |
|---|---|
| Install Total_Job_Hours | (finish - start) in decimal hours. Warn above 14 h (16 h in shift validators). Hard limit on fab post-job: 0 < hours <= 16. |
| Fab Finish_Time | Start_Time + Proposed_Hours |
| Completion % (Fab, Install, Job) | completed quoted hours / total quoted hours x 100, integer. Done set = Completed, Complete - Not Used, Manager Review, Cancelled. If total hours are 0: 100 if all tasks done, else 0. Job version includes Design. **[CONFIRM]** Proposed vs Quoted basis (Creator mixes them). |
| Repeat interval | Days = count; Weeks x 7; Months x 30 |
| Timesheet pay hours | Mon-Fri window 06:00-18:00: first 8 h single, next 2 h x1.5, rest x2. Outside window x2. Saturday: first 2 h x1.5 then x2. Sunday x2. Breaks are deducted from double first, then x1.5, then single. |
| Fab variance | Quoted - single - 1.5 x time-and-half - 2 x double |
| Profit and profit % | Not calculated in Creator. Read from CRM Deal (Job_Profit, Job_Profit1). |

Pay-period windows are computed three different ways in Creator. Replace with one pay-period configuration (**[CONFIRM]** period start day and length).

---

## 11. Scheduled jobs (run by the `jobs` function, time zone Australia/Melbourne)

| Job | Schedule | Logic |
|---|---|---|
| `compliance-due` | daily 07:00 | One job for company documents, worker tickets and inductions: select `compliance_item` rows with `next_reminder_at <= now`, publish `compliance.due`, email on the configured offsets (before, on, after expiry) to the installation manager and the company or worker; honour opt-out flags; then advance `next_reminder_at` |
| `weekly-hours-report` | Wed 07:00 | Build the booked-hours report from `time_entry`, email recipients from settings |
| `weekly-issues-report` | Thu 07:00 | One email per department manager listing open issues |
| `maintenance-tasks` | daily 09:00 | For `register_item` rows whose maintenance `next_due` is today or earlier, create a Maintenance fab task and advance `next_due` |
| `profit-digest` | hourly | Send the queued profit-revision digest for jobs whose scheduled time has passed |
| `mdm-sync` (optional) | daily | Pull device locations from the MDM system |

The Creator "weekly employee hours" job is no longer needed: daily, weekly and pay-period hours are queries over `time_entry`.

Dropped: the two one-shot "mirror to calendar" schedules (S9, S10). In Catalyst the unified calendar is a query, not a copied record. Seven inactive schedules are out of scope unless the client confirms.

```mermaid
flowchart TD
  C[Cron 07:00] --> Q[Query records where expiry date = today + offset for each configured offset]
  Q --> R{Opt-out flag set?}
  R -- yes --> S[Skip]
  R -- no --> M[Send email to manager and to company / worker]
  M --> L[Write notification log row]
```

---

## 12. CRM and WorkDrive integration points

| Event | Direction | Action |
|---|---|---|
| Deal converted to Job | CRM to app | Create Job, set Project Manager from Deal owner |
| Job completed or closed | app to CRM | Deal.Job_Stage = Completed / Completed - Closed; Deal.related_Job_check = true |
| Task hours changed | app to CRM | Update Deal labour-cost fields (Design, Fab, Install; Parent and Sub split) |
| Sign edited | app to CRM | Update the CRM Assets module (the Sign module) |
| Issue "Create Deal" | app to CRM | Create Deal from issue |
| Job closure | CRM to app | Read Total_Revenue, Total_Purchases, Design_Labour_Cost, Job_Profit, Job_Profit1 for the closure email |
| Task created | app to WorkDrive | Create folder under the Deal's parent folder for that task type, named from the task; rename on name change; rename "(DELETED)" on delete |
| Attachment added or deleted | app to WorkDrive | Upload or delete file |

All integration calls run inside the `events` and `jobs` functions through the shared integrations module, with credentials from environment secrets and connectors, never in the browser. Calls go through the `integration_job` outbox with idempotency keys and retry.

---

## 13. Notifications catalogue

Sender is a configured address. Recipients are resolved by role from Settings, never hard-coded.

| Event | Recipient role | Subject pattern |
|---|---|---|
| New Job created | Fab Manager (PM mail is inactive in Creator) | Job Checklist: {job} |
| Checklist assigned (design) | Checklist owner | Design Job Checklist |
| Submit for approval | PM (install, design) or Fab Manager (fab) | {Install/Fabrication/Design} Task Approval |
| Reject | Assignee | {Type} Task is Rejected: {name} |
| Fab checklist submitted | Fab Manager | Fab Checklist Submitted: {task} - {employee} |
| Install finished on site | PM, installation manager | Install Finished On Site: {task} - {employee} |
| Equipment off hire | Equipment managers | Equipment Off Hire: {task} |
| Job closure report (once) | Directors, PM, Fab Manager | job profitability and hours tables |
| Profit changed after fab complete | PM / directors | profit-change notice |
| Issue reported / updated / completed | Department manager, reporter, inform-also list | Issue Reported / Record Updated / Issue Completed |
| Expiry reminders | Installation manager, company, worker | by document type |
| Weekly reports | Settings recipients | hours report, issues report |

Drop all debug and test mails sent to developer addresses.

---

## 14. Defects in Creator not to be copied

1. Design reject email went to a test address and its text said "Install Task".
2. `Reopened_Comments_for_Design` updated Install_Job instead of Design_Task.
3. Site Post_Code was written into the install `Country` field.
4. Completion percentages mixed Proposed and Quoted hours.
5. Report criteria such as `Stage != Completed || Stage != Cancelled` were always true. Rebuild filters with correct AND logic.
6. Checklist create and delete logic ran in on-validate (before save). In Catalyst run it after a successful save, idempotently.
7. Hard-coded cutoff date, company-name checks ("Visual Exposure" used to detect internal staff) and a fixed "Workshop" job id. Use an is-internal flag and configuration.
8. Role scoping by email comparison only. Use user id plus role claims enforced server-side on every endpoint.
