# What we need from you to finish Visual Exposure Projects

The new system is built and running. Five things are still needed from you before it can go live. They are listed from most to least urgent. Please reply to each, even if only to say "not needed".

## 1. Your Zoho Creator data (needed to move your real jobs across)

We will load your real jobs, tasks, workers, companies and issues into the new system. For that we need an export of each form.

**How to export:** in Zoho Creator open the app "Projects", open each report below, then use **Export** (top right) and choose **CSV**. Please include every column and every record (clear any filter first).

Please send one file for each of these:
- Jobs
- Design tasks, Fabrication tasks, Install tasks
- Employee Database (workers), including subcontractors
- Companies
- Issues
- Tickets and inductions (with expiry dates)
- Equipment and chemicals registers

Put the files in one folder and share it with us (a Zoho WorkDrive link is fine). If any file contains data you do not want us to see, tell us which columns to leave out.

## 2. The real wording of your checklists and SWMS

At the moment the system uses placeholder questions. Please send, for each of Design, Fabrication and Install:
- the pre-job checklist questions (for team leaders and for team members)
- the post-job checklist questions (what is asked about hours, photos and anything unsafe)
- for Install: the **"Team Briefed"** step, exactly as your crews do it today

For the Safe Work Method Statement (SWMS) please send:
- the standard work steps and the PPE list you start from
- a filled-in example of a recent SWMS (a PDF is fine)

## 3. Your issue print layouts

The old system prints issues in 7 layouts. The new system has 2 (a one-page summary, and a full version with the history). Please tell us either:
- "The 2 layouts are fine", or
- "We need all 7 exactly", and send a printed sample of each.

## 4. Device tracking (ManageEngine MDM)

To show where company phones and tablets are, the system needs read-only access to ManageEngine MDM. Please send:
- the **data center** your MDM account is on (for example .com, .in, .eu, .com.au)
- the **client ID, client secret and refresh token** of an API client with permission to **read** devices. Create it in the Zoho API Console (a "Self Client") using an administrator account.

Please send the secret and token privately (not in a group chat or a shared document). The system only reads device names, models and last known locations.

## 5. Two reports we need rules for

- **Profit digest:** what should it contain (for example profit per job, per week), and who should receive it, and how often?
- **Job closure report:** what should it contain, and who receives it when a job is closed?

## Also, please confirm these four settings

- **Pay period:** which day does a pay period start, and how long is it (we have assumed it starts on a Monday and lasts 14 days)?
- **Email sender:** the system sends alerts and weekly reports by email. For the live version, please give us an address on your own domain (for example `noreply@visualexposure.com.au`) and ask whoever manages your domain to add the DNS records we will send. Until then, emails come from a temporary address.
- **Who gets the weekly hours report** (every Wednesday morning).
- **Which manager should hear about issues** for each department (Management, Design, Fabrication, Install, Civic Billboards). If you do not say, all project managers are told.

Thank you. Once we have these, we can load your data and finish the checklists, so the system is ready for your team to try.
