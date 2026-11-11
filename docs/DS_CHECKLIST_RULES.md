# Checklist question rules from the Creator file (for owner review)

Source: the workflow scripts in `Creator file/Projects.ds` (the on-load "Show and Hide Fields" blocks of the four checklist forms) and the field wording in the same file. Read on 11 Nov 2026. Nothing in the app was changed: the templates in `lib/seed/checklistTemplates.js` are still the short placeholders. This file says what the DS does, what it does not say, and what the owner must confirm before the templates are replaced.

## How the DS decides who sees a question

- **Team leader** = the person logged in is the Team Leader of the task (`zoho.loginuserid == TL`). **Team member** = the logged-in person is one of the task's team members. Anyone else (for example a manager opening the record) falls into the "else" branch, which in the Install forms shows the member questions and in the Fabrication post form shows a reduced set.
- Fabrication pre-job uses the checklist owner's role (`Team Leader` or `Team Member`) instead of the login.
- One DS form holds both roles. The app already has separate lead and member templates, so the split below maps onto the existing `assignee_role` values `lead` and `member`.

## 1. Install pre-job (two steps: pre-job, then job arrival)

| Step | Team leader sees | Team member sees |
|---|---|---|
| Pre-job | Scope of works clear? · Printed material locations clear? · Parking clear? · Reviewed the tools list? · Vehicle/jobs bay loaded? · Cards, PPE and clothing checked? · Access equipment suitable? · Aware of the subcontractors on site and their role? | Checked in with team leader? · Vehicle loaded (help the leader if they are not back)? · Cards, PPE and clothing checked? |
| Job arrival (after the pre-job step is completed) | Read the SWMS, briefed the other staff and collected signatures? · Job start time · Arrival time on site · photos | Read the SWMS and signed it? · Job start time · Arrival time on site · photos |

- All questions are Yes/No in `DS_CHECKLISTS.md`; the times are date-times.
- The DS blocks the team leader from completing the pre-job checklist until the SWMS exists and the project manager has signed it (two alert messages: "Created" and "PM Signed"). Check that the app enforces the same.

## 2. Install post-job (two steps)

| Step | Team leader | Team member |
|---|---|---|
| Post-job 1 (on site) | WHS issues? (describe in notes) · Work area cleaned and tidied? · On-site finish time · Other notes · Photos of the completed job | Same questions as the leader |
| Post-job 2 (closure) | Job start time · On-site finish time · Job finish time · Management review wanted? · Total job hours · **Rate the briefing, 1 (poor) to 10 (excellent)** | Same, **without the briefing rating** |

- **Minor Task** installs skip post-job 1 for everyone. Closure then asks only for the start time, the job finish time, hours and notes (no on-site finish time, no management review, no briefing rating).
- The briefing rating tells the project manager how well the job was briefed. Do not confuse it with the 1 to 5 site-manager rating of a person.

## 3. Fabrication pre-job (one step)

| Team leader | Team member |
|---|---|
| Scope of works clear? · Finish quality required clear? · Completion date clear? | Checked in with team leader? · Completion date clear? |

## 4. Fabrication post-job (one step)

| Who and job type | Questions |
|---|---|
| The checklist owner, **Workshop or Maintenance** job | Notes for this task · Photos · Total unbilled hours |
| The checklist owner, **any other fab type** | Notes · Photos · Total hours · Management review wanted? · Briefing rating 1 to 10 · OH&S issue question |
| Someone else (a manager opening the checklist) | Notes · hours only; no photos, review or rating |

## 5. Not covered here

- **Design** checklists: the app has none, by an earlier decision (DES-2).
- **Project manager** checklists (install, fab, design): they are the approval panel on the task in the app.
- The old fields marked "OLD" in the DS forms are left out on purpose.

## What the scripts do NOT say (owner to confirm)

1. **Which answers raise an issue** (the app's `raiseIssueOn`), and whether a "No" blocks completion. Not found in these scripts.
2. **Which questions are mandatory.** Only the generic "Set Mandatory" helper appears; the exact required list is not in the visibility scripts.
3. **The Yes/No wording** is taken from the DS question list; the DS also has an "Ask Manager" option on a few questions.
4. Whether the "else" case (a manager) should be able to open a checklist at all in the app.
5. The workshop job type in the app: is it the DS "Workshop" fab type?

## Proposed next step

When the owner confirms the tables above (or corrects them), replace the placeholder templates with new template rows at version 2 (open checklists keep the version they started on, per the note in `checklistTemplates.js`). That is a Data Store write in Development and needs a sync, a test run and a deploy, so it is held until you say go.
