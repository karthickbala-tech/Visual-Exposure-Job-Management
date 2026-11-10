# DS workflows (reference)

Extracted from `Creator file/Projects.ds`: 423 workflow blocks. Each entry shows the name, the event, any phase (on load, on validate, on success, on user input), and the first lines of its Deluge script. **Inactive** workflows are switched off in Creator. Scripts are cut at 8 lines; the full text is in the DS file.

## Fabrication_Job1 (49)

### Check_Mandatory_field_Fabrication

- Event: on edit; phases: on validate

```
if(input.Set_Mandatory == true)
{
mandatory_value = 0;
if(input.Task_Name.isEmpty())
{
mandatory_value = mandatory_value + 1;
alert(Task_Name,"Please fill the mandatory fields");
}
```

### Update_Url_Fabrication (INACTIVE)

- Event: on add; phases: on success

### Hide and Show Fields

- Event: on edit; phases: on load

```
input.Set_Mandatory = True;
hide Manufacturing_Job_Checklist;
disable Finish_Time;
disable Start_Date_Time;
disable Finish_Date_Time;
disable Quoted_Hours;
hide Repeat;
hide Repeat_Interval;
```

### Team Member Check List Creation and Deletion (INACTIVE)

- Event: on edit; phases: on update of Task_Assigned_to

### PostJob_Checklist_Creation (INACTIVE)

- Event: on edit; phases: on update of Notes

### Teamleader_Teammember_Validation (INACTIVE)

- Event: on edit; phases: on validate

### InAct - Hide_all_Checklist_Fields (INACTIVE)

- Event: on add or edit; phases: on load

### Update the Completed Date on stage is Completed

- Event: on edit; phases: on success

```
if(input.Stage != "In Progress" && input.Stage != "Manager Review" && input.Stage != "Completed" && input.Stage != "Complete - Not used")
{
if(input.Team_Leader1 != Null && input.Task_Assigned_to != Null && input.Scheduled_Date != Null)
{
input.Stage = "Scheduled";
update_job = Jobs[ID == input.Jobs];
update_job.Stage="In Progress";
}
```

### Hide and Show Fab Type

- Event: on edit; phases: on user input of Fab_Type

```
if(Fab_Type == "CCV")
{
show Task_Details;
hide CNC;
hide Channel_Letter_Bender;
hide Repeat;
}
else if(Fab_Type == "CNC Laser" || Fab_Type == "CNC Router")
```

### JD Update Stage (INACTIVE)

- Event: on edit; phases: on user input of Team_Leader1

### JD Update Stage on Team Member (INACTIVE)

- Event: on edit; phases: on user input of Task_Assigned_to

### Update Completion Percentages

- Event: on edit; phases: on update of Stage

```
if(input.Jobs != Null)
{
all_total_fab_Hours = 0;
tota_comp_fab_Hours = 0;
Fab_Count_Un = 0;
Fab_Count_Comp = 0;
Inst_Count_Un = 0;
Inst_Count_Comp = 0;
```

### JD Update the Fab Completed Calculation (INACTIVE)

- Event: on add or edit; phases: on success

### Create Workdrive Folder

- Event: on add; phases: on success

```
thisapp.Zoho_Workdrive.Create_Folder_Workdrive_(input.ID,"Fab_Task");
```

### Hide Fields on Creator

- Event: on add; phases: on load

```
hide Task_Details;
hide CNC;
hide Channel_Letter_Bender;
hide Days;
input.Quoted_Hours = 0;
input.Show_Other_Details = false;
disable Quoted_Hours;
disable Task_Name;
```

### Hide and Show Fields on User Input

- Event: on add; phases: on user input of Fab_Type

```
if(Fab_Type == "CCV")
{
show Task_Details;
hide CNC;
hide Channel_Letter_Bender;
}
else if(Fab_Type == "CNC Laser" || Fab_Type == "CNC Router")
{
```

### Create and Update File to Workdrive

- Event: on add or edit; phases: on success

```
//Calculate Job's "Fab Hours Booked"
if(input.Jobs != null)
{
get_booked_hrs_sum = 0;
get_labour_cost_parent = 0;
get_labour_cost_fab = 0;
get_labour_cost_sum = 0;
//Calculate related Fab Task Booked Hours Sum
```

### Fab Task Check List creation (INACTIVE)

- Event: on edit; phases: on update of Team_Leader1

### AJ_F_Team Member Checklist Creation and Deletion

- Event: on edit; phases: on validate

```
get_old = old.Task_Assigned_to;
get_current_val = input.Task_Assigned_to;
get_new = input.Task_Assigned_to;
for each  valu in get_old
{
for each  val2 in get_new
{
get_old.removeElement(val2);
```

### Update Finish Time - Start time

- Event: on add or edit; phases: on user input of Start_Time

```
if(Proposed_Hours != NULL && Scheduled_Date != NULL)
{
if(Start_Time == NULL)
{
input.Finish_Time = "";
input.Start_Date_Time = NULL;
input.Finish_Date_Time = NULL;
}
```

### Update Finish Time - Proposed Hours

- Event: on add or edit; phases: on user input of Proposed_Hours

```
if(Scheduled_Date != NULL && Start_Time != NULL)
{
if(Proposed_Hours == NULL)
{
input.Finish_Time = "";
input.Start_Date_Time = NULL;
input.Finish_Date_Time = NULL;
}
```

### Update Start Finish time on Date change

- Event: on add or edit; phases: on user input of Scheduled_Date

```
if(Proposed_Hours != NULL && Start_Time != NULL)
{
if(Scheduled_Date == NULL)
{
input.Finish_Time = "";
input.Start_Date_Time = NULL;
input.Finish_Date_Time = NULL;
}
```

### Owner_email_Update

- Event: on add; phases: on success

```
Emaildetaisl = Employee_Database[VE_Email_Address == input.Fab_Manger_Email];
input.Fab_Manager = Emaildetaisl.ID;
```

### Can't delete is quoted hrs exist

- Event: on delete; phases: on validate

```
UserPM = "mick@visualexposure.com.au";
if(zoho.loginuserid != UserPM)
{
if(input.Quoted_Hours != 0 || Null)
{
alert " There are quoted hours against this Task. You cannot delete it. Move it to 'Complete - Not Used' instead";
cancel delete;
}
```

### Update Job Tasks = Yes

- Event: on add; phases: on success

```
get_project = Jobs[ID == input.Jobs];
if(get_project.Job_Has_Fab_Tasks.contains("Yes"))
{
}
else
{
get_project.Job_Has_Fab_Tasks="Yes";
}
```

### Job Contains Fab

- Event: on add or edit; phases: on success

```
if(input.Jobs != null)
{
get_project = Jobs[ID == input.Jobs];
if(get_project.Job_Has_Fab_Tasks.contains("Yes"))
{
}
else
{
```

### Show Repeat Fields

- Event: on edit; phases: on user input of Repeat

```
if(input.Repeat == "Yes")
{
show Repeat_Interval;
show Repeat_Count;
}
else
{
hide Repeat_Interval;
```

### Task Description updated = Yes

- Event: on add; phases: on success

```
input.Task_Desc_Updated = "Yes";
```

### Update repeat days

- Event: on add or edit; phases: on success

```
if(input.Repeat_Interval == "Days")
{
input.Days = input.Repeat_Count;
}
if(input.Repeat_Interval == "Weeks")
{
input.Days = input.Repeat_Count * 7;
}
```

### Create Repeating Task

- Event: on edit; phases: on update of Stage

```
if(Fab_Type == "Workshop" && Stage == "Complete")
{
get_parent_task = Fabrication_Job1[ID == input.ID];
Repeat_Date = get_parent_task.Scheduled_Date.addDay(get_parent_task.Days);
if(get_parent_task.count() == 1)
{
fetch_subform1 = get_parent_task.Attachments;
//Create a collection to store the data of each record in subform1
```

### update workdrive folder name

- Event: on edit; phases: on update of Task_Name

```
thisapp.Folder_Name_Update_FI_SS(input.ID,"Fab_Task");
FabricationDetails = Fab_and_Install_Task[Fabrication_Job_Lookup == input.ID];
if(FabricationDetails.count() > 0)
{
FabricationDetails.Task_Name=input.Task_Name;
}
else
{
```

### update workdrive folder name

- Event: on delete; phases: on success

```
header = Map();
Job_detail = Jobs[ID == input.Jobs];
if(Job_detail.count() > 0)
{
taskname = input.Task_Name;
folderid = input.Folder_Location_on_Server.getsuffix("folder/").getprefix(" ").getprefix("'");
header = Map();
header.put("Accept","application/vnd.api+json");
```

### delete_file_from_workdrive

- Event: on add or edit; phases: on delete row of Attachments

```
docid = row.Document_ID;
thisapp.Zoho_Workdrive.Delete_File_from_workdrive(docid.toString());
```

### SK_update_status

- Event: on edit; phases: on update of Stage; sends mail; CRM

```
if(input.Jobs != Null)
{
if(input.Stage == "Completed" || input.Stage == "Complete - Not Used" || input.Stage == "Cancelled")
{
get_install = Install_Job[Jobs == input.Jobs && Stage != "Completed" && Stage != "Complete - Not Used" && Stage != "Cancelled"];
get_design = Design_Task[Jobs == input.Jobs && Stage != "Completed" && Stage != "Complete - Not Used" && Stage != "Cancelled"];
get_fab = Fabrication_Job1[Jobs == input.Jobs && Stage != "Completed" && Stage != "Complete - Not Used" && Stage != "Cancelled"];
if(get_install.count(ID) != 0 || get_fab.count(ID) != 0 || get_design.count(ID) != 0)
```

### Create Recurring Fabrication Tasks

- Event: on edit; phases: on update of Stage

```
if(input.Stage == "Manager Review" && Fab_Type == "Maintenance")
{
new_record = Equipment_Register_SF[ID == input.Equipment_Register_SF];
new_record.Scheduled_Date=zoho.currentdate.addBusinessday(new_record.Maintenance_Frequency_Days);
// 	setup_fabmanager = Setup[ID != 0];
// 	fabrication_task = insert into Fabrication_Job1
// 	[
// 		Task_Name=input.Task_Name
```

### Show Other Details

- Event: on edit; phases: on user input of Show_Other_Details

```
if(Show_Other_Details == true)
{
show Other_Details1;
}
if(Show_Other_Details == false)
{
hide Other_Details1;
}
```

### K_Update the Jobs URL to Jobs Link field

- Event: on add; phases: on success

```
if(input.Jobs != null)
{
jobRec = Jobs[ID == input.Jobs];
if(jobRec.count() > 0)
{
jobID = jobRec.ID.tostring();
jobStage = ifnull(jobRec.Stage,"");
jobName = ifnull(jobRec.Job_Subject,"");
```

### K Redirect_After_Save (INACTIVE)

- Event: on add or edit; phases: on success

### KK Fab - Update the Link & Deal Based on Jobs

- Event: on add or edit; phases: on user input of Jobs

```
if(input.Jobs != null)
{
jobRec = Jobs[ID == input.Jobs];
if(jobRec.count() > 0)
{
jobID = jobRec.ID.tostring();
jobStage = ifnull(jobRec.Stage,"");
jobName = ifnull(jobRec.Job_Subject,"");
```

### Hide Field Jobs Links and CRM Deal

- Event: on add or edit

### AJ Update the Parent Task to Sub Task Details

- Event: on add or edit; phases: on user input of Copy_details_from_Parent_Task

```
if(input.Copy_details_from_Parent_Task == true)
{
if(input.Parent_Fabrication_Task_ID != Null && input.Parent_Fabrication_Task_ID != 0)
{
get_parent_task = Fabrication_Job1[ID == input.Parent_Fabrication_Task_ID];
if(get_parent_task.count() == 1)
{
input.Task_Description = get_parent_task.Task_Description;
```

### AJ Hide the Fields

- Event: on add or edit; phases: on load

```
hide Attachments.Document_ID;
hide Attachments.Document_Link;
disable Parent_or_Sub;
disable Parent_Fabrication_Task_ID;
input.Copy_details_from_Parent_Task = false;
if(input.Parent_or_Sub == "Parent Task")
{
disable Copy_details_from_Parent_Task;
```

### AJ Updated the Parent ID

- Event: on add; phases: on success

```
if(input.Parent_or_Sub == "Parent Task" || input.Parent_or_Sub == "Workshop")
{
input.Parent_Fabrication_Task_ID = input.ID;
}
```

### AJ Update the Status on Deleted FabricationTask

- Event: on delete; phases: on success; CRM

```
all_total_fab_Hours = 0;
tota_comp_fab_Hours = 0;
for each  fab_rec_ in Fabrication_Job1[Jobs == input.Jobs]
{
all_total_fab_Hours = all_total_fab_Hours + ifnull(fab_rec_.Proposed_Hours,0);
if(fab_rec_.Stage == "Completed")
{
tota_comp_fab_Hours = tota_comp_fab_Hours + ifnull(fab_rec_.Proposed_Hours,0);
```

### Update the Team Leader in Fab and Install task

- Event: on edit; phases: on update of Team_Leader1

```
FabricationDetails = Fab_and_Install_Task[Fabrication_Job_Lookup == input.ID];
if(FabricationDetails.count() > 0)
{
FabricationDetails.Team_Leader=input.Team_Leader;
}
else
{
InsertTaskName = insert into Fab_and_Install_Task
```

### Update Team Member

- Event: on edit; phases: on update of Task_Assigned_to

```
FabricationDetails = Fab_and_Install_Task[Fabrication_Job_Lookup == input.ID];
if(FabricationDetails.count() > 0)
{
FabricationDetails.Team_Member=input.Task_Assigned_to;
}
else
{
InsertTaskName = insert into Fab_and_Install_Task
```

### Update the Schedule Date

- Event: on edit; phases: on update of Scheduled_Date

```
FabricationDetails = Fab_and_Install_Task[Fabrication_Job_Lookup == input.ID];
if(FabricationDetails.count() > 0)
{
FabricationDetails.Date_field=input.Scheduled_Date;
}
else
{
InsertTaskName = insert into Fab_and_Install_Task
```

### JD_Update_Record_URL_in_Fab (INACTIVE)

- Event: -; phases: on start

### Add the Fab Task

- Event: -; phases: on start

## Install_Job (48)

### Check_Mandatory_Fields

- Event: on edit; phases: on validate

```
if(input.Set_Mandatory == true)
{
mandatory_value = 0;
if(input.Task_Name.isEmpty())
{
mandatory_value = mandatory_value + 1;
alert(Task_Name,"Please fill the mandatory fields");
}
```

### Set Mandatory Value

- Event: on edit; phases: on load

```
input.Set_Mandatory = true;
if(input.Disable_the_Team_Leader_and_Member == True)
{
disable Team_Leader;
disable Other_Staff;
}
//input.Rich_Text = "<a href='#Form:Install_Job?ID= "+input.ID+"zc_LoadIn=dialog'> Click Here </a>";
```

### Email_For_Team_Member (INACTIVE)

- Event: on edit; phases: on update of Other_Staff; sends mail

### Prejobcheclist_Creation (INACTIVE)

- Event: on edit; phases: on update of Other_Staff

### NotesUpdation_Postjobchecklisgenrate (INACTIVE)

- Event: on edit; phases: on update of Notes

### Hide and Show Fields

- Event: on add or edit; phases: on load

```
hide Internal_Fields;
disable Created;
disable Completed;
disable Booked_Hours_Double;
disable Actual_Hours_Single;
disable Booked_Hours_Time_and_Half;
disable Install_Type;
hide Folder_Location_ID;
```

### Update_Url

- Event: on add; phases: on success

```
url = Map();
//info "test";
url.put("value","View Record");
url.put("url","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Install_Tasks/" + input.ID);
edit_url = Map();
edit_url.put("value","Edit Record");
edit_url.put("url","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/Install_Job/record-edit/Install_Tasks/" + input.ID);
data_map = Map();
```

### Update the Completed Date on stage is Completed

- Event: on edit; phases: on success

```
if(input.Stage == "Completed" || input.Stage == "Complete - Not used")
{
input.Completed = zoho.currenttime;
}
```

### Calculaction for all Stage (INACTIVE)

- Event: on edit; phases: on update of Stage

### Substage_Creation_Post (INACTIVE)

- Event: on edit; phases: on update of Sub_Stages

### Team Leader Checklist Creation and Deletion

- Event: on edit; phases: on update of Team_Leader

```
if(!isNull(input.Team_Leader))
{
fetch_pre_job = Install_Pre_Job_Checklists[Install_Job == input.ID && Team_Leader_Check == "Yes"];
get_owner_email = Employee_Database[ID == fetch_pre_job.Checklist_Owner];
if(get_owner_email.VE_Email_Address == input.Team_Leader.VE_Email_Address)
{
//info "Value Post" ;
}
```

### Create Workdrive Folder

- Event: on add; phases: on success

```
thisapp.Zoho_Workdrive.Create_Folder_Workdrive_(input.ID,"install_Task");
```

### Quoted Hours = 0

- Event: on add; phases: on load

```
input.Quoted_Hours = 0;
disable Task_Name;
openUrl("#Form:Alert_Message?plain=You cannot create a Task here. Please create it from within your job","popup window");
```

### Create and Update File to Workdrive

- Event: on add or edit; phases: on success; sends mail

```
//Calculate Job's "Install Hours Booked"
if(input.Jobs != null)
{
get_booked_hrs_sum = 0;
get_labour_cost_parent = 0;
get_labour_cost_fab = 0;
get_labour_cost_sum = 0;
//Calculate related Install Task Booked Hours Sum
```

### Create and delete checklists

- Event: on edit; phases: on validate

```
get_old = old.Other_Staff;
get_current_val = input.Other_Staff;
get_new = input.Other_Staff;
for each  valu in get_old
{
for each  val2 in get_new
{
get_old.removeElement(val2);
```

### Update Address in form & Push to SWMS

- Event: on edit; phases: on user input of Sites

```
input.Street = Sites[ID == input.Sites].Street;
input.Suburb = Sites[ID == input.Sites].City;
input.State = Sites[ID == input.Sites].State;
input.Country = Sites[ID == input.Sites].Post_Code;
Mappingstring = "https://www.google.com/maps/place/" + input.Street + ",+" + input.Suburb + ",+" + input.State + ",+" + Sites[ID == input.Si
input.Views_in_Map = "<a href='" + Mappingstring + "'   title='Show Map'>Show</a>";
//
swms_rec = SWMS[Install_Task_Details == input.ID];
```

### Create SWMS Record

- Event: on add; phases: on success

```
get_project = Jobs[ID == input.Jobs];
get_ = Employee_Database[ID == input.Team_Leader];
if(input.SWMS_Status != "Not Required")
{
input.SWMS_Status = "Created";
cereate_SWMS = insert into SWMS
[
Company="Michael Harrold"
```

### Update the on stage - Awaiting Scheduling

- Event: on edit; phases: on success

```
if(input.Install_Type == "External Install" || input.Install_Type == "Print Only")
{
if(input.Install_Date != Null)
{
input.Stage = "Scheduled";
update_job = Jobs[ID == input.Jobs];
update_job.Stage="In Progress";
}
```

### Add booked hours (INACTIVE)

- Event: on edit; phases: on success

### Update Team Leader in SWMS Record

- Event: on edit; phases: on update of Team_Leader

```
swms_rec = SWMS[Install_Task_Details == input.ID];
// if(input.SWMS_Status != "Not Required")
// {
if(swms_rec.count() != 0)
{
if(swms_rec.Name == Null)
{
swms_rec.Name=input.Team_Leader;
```

### Owner_email_updation

- Event: on add; phases: on success

```
job_rec = Jobs[ID == input.Jobs];
owner_email = job_rec.Owner_Email;
Emaildetaisl = Employee_Database[VE_Email_Address == owner_email];
input.Project_Manager = Emaildetaisl.ID;
// if(!isNull(input.Owner_Email))
// {
// 	pm_email = input.Quoteowneremail;
// }
```

### Can't delete is quoted hrs exist (INACTIVE)

- Event: on delete; phases: on validate; CRM

### Update Job Tasks = Yes

- Event: on add; phases: on success

```
get_project = Jobs[ID == input.Jobs];
if(get_project.Job_Has_Install_Tasks.contains("Yes"))
{
}
else
{
get_project.Job_Has_Install_Tasks="Yes";
}
```

### Job has Install Task = YES

- Event: on add or edit; phases: on success

```
get_project = Jobs[ID == input.Jobs];
if(get_project.Job_Has_Install_Tasks.contains("Yes"))
{
}
else
{
get_project.Job_Has_Install_Tasks="Yes";
}
```

### Update Task Description (INACTIVE)

- Event: on edit; phases: on load

### Task Description updated = Yes

- Event: on add; phases: on success

```
input.Task_Desc_Updated = "Yes";
```

### update workdrive folder name

- Event: on edit; phases: on update of Task_Name

```
thisapp.Folder_Name_Update_FI_SS(input.ID,"Install_Task");
FabAndInstallName = Fab_and_Install_Task[Install_Job_Lookup == input.ID];
if(FabAndInstallName.count() > 0)
{
FabAndInstallName.Task_Name=input.Task_Name;
}
else
{
```

### update workdrive folder name

- Event: on delete; phases: on success; CRM

```
// thisapp.Zoho_Workdrive.FI_SS_Update_foldername_delete("Install_Task",input.ID);
Job_detail = Jobs[ID == input.Jobs];
if(Job_detail.count() > 0)
{
// 	info "inside if";
taskname = input.Task_Name;
folderid = input.Folder_Location_on_Server.getsuffix("folder/").getprefix(" ").getprefix("'");
// 	info folderid;
```

### Update Completion Percentages

- Event: on edit; phases: on success

```
all_total_fab_Hours = 0;
tota_comp_fab_Hours = 0;
Fab_Count_Un = 0;
Fab_Count_Comp = 0;
Inst_Count_Un = 0;
Inst_Count_Comp = 0;
for each  fab_rec_ in Fabrication_Job1[Jobs == input.ID]
{
```

### Off Hire Show Hide

- Event: on edit; phases: on user input of Equipment_Off_Hire_Required

```
if(Equipment_Off_Hire_Required == "Yes")
{
show Off_Hire_Number;
}
else
{
hide Off_Hire_Number;
}
```

### Email Install Man - Equipment off hire

- Event: on edit; phases: on update of Sub_Stages; sends mail

```
if(input.Sub_Stages == "Finished On site" && !isNull(input.Off_Hire_Number))
{
url = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/Install_Job/record-edit/Page_Jobs_Install_Tasks/" + input.ID;
sendmail
[
from :"crm@visualgrp.com.au"
to :"ali@visualexposure.com.au","mick@visualexposure.com.au"
subject :"Equipment Off Hire - " + input.Task_Name
```

### delete_file_from_workdrive

- Event: on add or edit; phases: on delete row of Attachments

```
docid = row.Document_ID;
thisapp.Zoho_Workdrive.Delete_File_from_workdrive(docid.toString());
```

### SK_update_status

- Event: on edit; phases: on update of Stage; sends mail; CRM

```
if(input.Stage == "Completed" || input.Stage == "Complete - Not Used" || input.Stage == "Cancelled")
{
get_install = Install_Job[Jobs == input.Jobs && Stage != "Completed" && Stage != "Complete - Not Used" && Stage != "Cancelled"];
get_design = Design_Task[Jobs == input.Jobs && Stage != "Completed" && Stage != "Complete - Not Used" && Stage != "Cancelled"];
get_fab = Fabrication_Job1[Jobs == input.Jobs && Stage != "Completed" && Stage != "Complete - Not Used" && Stage != "Cancelled"];
if(get_install.count(ID) != 0 || get_fab.count(ID) != 0 || get_design.count(ID) != 0)
{
}
```

### SK_update_status (INACTIVE)

- Event: on edit; phases: on user input of Stage

### Show Other Details

- Event: on add or edit; phases: on user input of Show_Other_Details

```
if(Show_Other_Details == true)
{
show Other_Details;
}
if(Show_Other_Details == false)
{
hide Other_Details;
}
```

### K_Update the Jobs URL to Jobs Link field

- Event: on add; phases: on success

```
if(input.Jobs != null)
{
jobRec = Jobs[ID == input.Jobs];
if(jobRec.count() > 0)
{
jobID = jobRec.ID.toString();
jobStage = ifnull(jobRec.Stage,"");
jobName = ifnull(jobRec.Job_Subject,"");
```

### KK Install Update the Link & Deal Based on Jobs

- Event: on add or edit; phases: on user input of Jobs

```
if(input.Jobs != null)
{
jobRec = Jobs[ID == input.Jobs];
if(jobRec.count() > 0)
{
jobID = jobRec.ID.toString();
jobStage = ifnull(jobRec.Stage,"");
jobName = ifnull(jobRec.Job_Subject,"");
```

### Install Task Hide Field Jobs Links and CRM Deal

- Event: on add or edit

### AJ Hide the Fields

- Event: on add or edit; phases: on load

```
hide Attachments.Document_ID;
hide Attachments.Document_Link;
disable Parent_Install_Task_ID;
input.Copy_details_from_Parent_Task = false;
if(input.Install_Type != "VE Subtask")
{
disable Copy_details_from_Parent_Task;
hide Parent_Install_Task_ID;
```

### AJ Update the Parent Task to Sub Task - Install

- Event: on add or edit; phases: on user input of Copy_details_from_Parent_Task

```
if(input.Copy_details_from_Parent_Task == true)
{
if(input.Parent_Install_Task_ID != Null && input.Parent_Install_Task_ID != 0)
{
get_parent_task = Install_Job[ID == input.Parent_Install_Task_ID];
if(get_parent_task.count() == 1)
{
input.Task_Description = get_parent_task.Task_Description;
```

### AJ Updated the Parent ID

- Event: on add; phases: on success

```
if(Install_Type != "VE Subtask")
{
input.Parent_Install_Task_ID = input.ID;
}
```

### AJ Update the Status on Deleted Install Task

- Event: on delete; phases: on success; CRM

```
all_total_fab_Hours = 0;
tota_comp_fab_Hours = 0;
for each  fab_rec_ in Fabrication_Job1[Jobs == input.Jobs]
{
all_total_fab_Hours = all_total_fab_Hours + ifnull(fab_rec_.Proposed_Hours,0);
if(fab_rec_.Stage == "Completed")
{
tota_comp_fab_Hours = tota_comp_fab_Hours + ifnull(fab_rec_.Proposed_Hours,0);
```

### New Testing

- Event: on edit; phases: on success

```
thisapp.FI_AJ_Function.Team_Leader_Checklist_Creation_and_Deletion(input.ID);
```

### Open Alert Form

- Event: on add or edit; phases: on success; sends mail

```
InstallTask = Install_Job[ID == input.ID && Install_Date != null];
if(InstallTask.count() > 0 && input.Update_Workers == true)
{
HTMLMessage = thisapp.SendMail.WorkerTicketExpiry(InstallTask.ID,"");
if(HTMLMessage != "")
{
openUrl("#Form:Alert_Message?plain=" + HTMLMessage,"popup window");
HTMLMessage = thisapp.SendMail.WorkerTicketExpiry(InstallTask.ID,"Mail");
```

### Update Team Member

- Event: on edit; phases: on update of Other_Staff

```
FabAndInstallName = Fab_and_Install_Task[Install_Job_Lookup == input.ID];
if(FabAndInstallName.count() > 0)
{
FabAndInstallName.Team_Member=input.Other_Staff;
}
else
{
InsertTaskName = insert into Fab_and_Install_Task
```

### Update Install Date

- Event: on edit; phases: on update of Install_Date

```
FabAndInstallName = Fab_and_Install_Task[Install_Job_Lookup == input.ID];
if(FabAndInstallName.count() > 0)
{
FabAndInstallName.Date_field=input.Install_Date;
}
else
{
InsertTaskName = insert into Fab_and_Install_Task
```

### JD_Update_Record_URL_in_Install (INACTIVE)

- Event: -; phases: on start

### Add the Install Task

- Event: -; phases: on start

## SWMS (36)

### SK_F_auto_populate_value (INACTIVE)

- Event: on add or edit; phases: on user input of Project_Details

### GS_SWMS_Prepared_by_Auto_populate

- Event: on add or edit; phases: on user input of Work_Manager

```
if(input.Work_Manager != null || !input.Work_Manager.isempty())
{
input.Contact_email_Manager = input.Work_Manager.VE_Email_Address;
input.Mobile = input.Work_Manager.Phone_Number;
input.Date_field1 = now;
}
else
{
```

### GS_SWMS_field_disable

- Event: on add or edit; phases: on load

```
disable SWMS_Number;
if(input.Install_Task_Details != null)
{
get_ = Install_Job[ID == input.Install_Task_Details];
input.Project_Details = get_.Jobs;
//input.Project_Description = get_.Task_Description;
//input.Project_Description = "Refer to job sheet for specific work details";
input.Name = get_.Team_Leader;
```

### GS_SWMS_Auto_populate_for_subform

- Event: on add or edit

```
if(row.What_are_the_tasks_involved != null)
{
row.What_are_the_Tasks=row.What_are_the_tasks_involved.What_are_the_tasks_involved;
row.What_are_the_hazards_and_risks_of_this_task=row.What_are_the_tasks_involved.What_are_the_hazards_and_risks_of_this_task;
row.How_will_hazards_and_risks_be_controlled_describe_the_control_measures_and_how_they_will_be_used=row.What_are_the_tasks_involved.How_wil
}
```

### SK_SWMS_others_Name (INACTIVE)

- Event: on add or edit

### SK_F_Declaration

- Event: on add or edit; phases: on add row of Subform

```
if(row.Name != null)
{
get_other = Employee_Database[ID == row.Name];
if(get_other.Name.first_name.toString() == "Other Employees")
{
show row.Name1;
}
else
```

### GS_SWMS_Auto_populate_lookup

- Event: on add or edit; phases: on user input of Install_Task_Details

```
swms_details = SWMS[Install_Task_Details == input.Install_Task_Details];
swms_count = swms_details.count();
if(swms_count <= 0)
{
if(input.Install_Task_Details != null)
{
get_ = Install_Job[ID == input.Install_Task_Details];
input.Project_Details = get_.Jobs;
```

### GS_SWMS_field_show_hide (INACTIVE)

- Event: on add or edit; phases: on user input of SWMS_Type

### GS_SWMS_field_hide

- Event: on add or edit; phases: on load

```
show Install_Task_Details;
hide Fabrication_Task_Details;
hide SWMS_Type;
hide Internal_Development;
Install_Jobid = input.Install_Task_Details;
Installjobrecords = Install_Job[ID == Install_Jobid];
Teamleadercheck = Installjobrecords.Team_Leader;
TL = Teamleadercheck.VE_Email_Address;
```

### GS_SWMS_Auto_populate_for_Works_Supervisor (INACTIVE)

- Event: on add or edit

### GS_SWMS_Auto_populate_for_Works_Supervisor

- Event: on add or edit; phases: on user input of Name

```
if(input.Name != null)
{
get_ = Employee_Database[ID == input.Name];
input.Team_Leader_Email = get_.VE_Email_Address;
input.Team_Leader_Phone = get_.Phone_Number;
input.Team_Leader_Name1 = get_.Name;
}
else
```

### GS_SWMS_Auto_num

- Event: on add or edit; phases: on success

```
if(input.ID != null)
{
input.SWMS_Number = "SWMS-00" + input.Auto_Number;
}
```

### SK_F_ADD_RoW_SWMS

- Event: on add or edit; phases: on add row of task

```
if(input.Install_Task_Details != null)
{
get_rec = Install_Job[ID == input.Install_Task_Details];
row.Person_Responsible=get_rec.Team_Leader;
}
else
{
}
```

### When Signed by PM

- Event: on add or edit; phases: on success

```
if(Signature1 != "")
{
input.SWMS_Status = "PM Signed";
rec_install = Install_Job[ID == input.Install_Task_Details];
rec_install.SWMS_Status=input.SWMS_Status;
list_vali = input.Install_Sub_Task_Details;
if(list_vali.size() >= 1)
{
```

### When Signed by TL

- Event: on add or edit; phases: on success

```
if(Signature_Team_Leader_Acceptance_at_Job_Briefing != "")
{
input.SWMS_Status = "TL Signed";
rec_install = Install_Job[ID == input.Install_Task_Details];
rec_install.SWMS_Status=input.SWMS_Status;
list_vali = input.Install_Sub_Task_Details;
if(list_vali.size() >= 1)
{
```

### SWMS Signed by TL

- Event: on edit; phases: on user input of Signature_Team_Leader_Acceptance_at_Job_Briefing

```
if(input.Signature_Team_Leader_Acceptance_at_Job_Briefing != "")
{
input.Date_field2 = now;
rec_install = Install_Job[ID == input.Install_Task_Details];
rec_install.SWMS_Status=input.SWMS_Status;
}
```

### Update_the_Record_Url

- Event: on add; phases: on success

```
view_urlll = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/SWMS_Project_manager/" + input.ID;
edit_urll = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/#Form:SWMS?recLinkID=" + input.ID + "&viewLinkName=SWMS_Proj
input.Edit_Record = "<a href='" + edit_urll + "' target='_self'>Edit Record </a>";
input.View_Record = "<a href='" + view_urlll + "' target='_blank'>View Record </a>";
get_install_task = Install_Job[ID == input.Install_Task_Details];
if(get_install_task.count() == 1)
{
get_install_task.Edit_SWMS_Record="<a href='" + edit_urll + "' target='_self'>Edit Record </a>";
```

### Update the Record Url

- Event: on edit; phases: on success

```
view_urlll = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/SWMS_Project_manager/" + input.ID;
edit_urll = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/#Form:SWMS?recLinkID=" + input.ID + "&viewLinkName=SWMS_Proj
input.Edit_Record = "<a href='" + edit_urll + "'>Edit Record </a>";
input.View_Record = "<a href='" + view_urlll + "' target='_blank'>View Record </a>";
get_install_task = Install_Job[ID == input.Install_Task_Details];
if(get_install_task.count() == 1)
{
get_install_task.Edit_SWMS_Record="<a href='" + edit_urll + "' target='_self'>Edit Record </a>";
```

### Update Status in Install Task

- Event: on add; phases: on success

```
rec_install = Install_Job[ID == input.Install_Task_Details];
rec_install.SWMS_Status=input.SWMS_Status;
list_vali = input.Install_Sub_Task_Details;
if(list_vali.size() >= 1)
{
for each  sigle_id in list_vali
{
rec_install = Install_Job[ID == sigle_id];
```

### Update Status in Install Task

- Event: on edit; phases: on update of SWMS_Status

```
rec_install = Install_Job[ID == input.Install_Task_Details];
rec_install.SWMS_Status=input.SWMS_Status;
list_vali = input.Install_Sub_Task_Details;
if(list_vali.size() >= 1)
{
for each  sigle_id in list_vali
{
rec_install = Install_Job[ID == sigle_id];
```

### SWMS Generation (INACTIVE)

- Event: on edit; phases: on success; CRM

### Check the SWMS rec

- Event: on add; phases: on validate

```
swms_details = SWMS[Install_Task_Details == input.Install_Task_Details];
swms_count = swms_details.count();
if(swms_count <= 0)
{
// 	if(input.Install_Task_Details != null)
// 	{
// 		get_ = Install_Job[ID == input.Install_Task_Details];
// 		input.Project_Details = get_.Jobs;
```

### otherworkershowingup

- Event: on edit

```
if(row.Name != null)
{
get_other = Employee_Database[ID == row.Name];
if(get_other.Name.first_name.toString() == "Other")
{
show row.Name1;
}
else
```

### swmspdf

- Event: on add or edit; phases: on success; sends mail; CRM

```
// input.Edit_from_URL = false;
thisapp.AJ_SWMS_PDF_creation(input.ID);
// i = input.ID;
// sign_id = SWMS[ID == i];
// resource_id = "87opqab2081f3296246d8b0cd37cab766b3ef";
// // tets = zoho.writer.getMergeFields("rexsz0a2cee1a63834240b68431f47a28fe05", "mailmergee");
// // info tets;
// url = "https://www.zohoapis.com.au/writer/api/v1/documents/" + resource_id + "/fields";
```

### SWMS Record Alert

- Event: on add; phases: on load

```
swms_details = SWMS[Install_Task_Details == input.Install_Task_Details];
swms_count = swms_details.count();
//alert swms_details;
if(swms_count <= 0)
{
}
else
{
```

### Disable Fields

- Event: on add or edit; phases: on load

```
disable Team_Leader_Name1;
```

### FI B Signature Fields UI WF

- Event: on add or edit; phases: on user input of Signature_Team_Leader_Acceptance_at_Job_Briefing

```
if(!input.Signature_Team_Leader_Acceptance_at_Job_Briefing.isEmpty())
{
show Subform;
show plain;
}
else
{
hide Subform;
```

### FI B Field Rule WF (INACTIVE)

- Event: on add or edit

### Check SWMS Signed by TL

- Event: on edit; phases: on load

```
if(!input.Signature_Team_Leader_Acceptance_at_Job_Briefing.isEmpty())
{
show Subform;
show plain;
}
else
{
hide Subform;
```

### Redirect to Jobs page

- Event: on edit; phases: on success

```
UserRole = Employee_Database[VE_Email_Address == zoho.loginuserid];
Install_Rec = Install_Job[ID == input.Install_Task_Details];
Job_ID = Install_Rec.Jobs;
if(UserRole.Project_Manager.contains("Yes") == true)
{
}
else if(UserRole.Fabrication_Manager.contains("Yes") == true)
{
```

### PPE - Falls

- Event: on edit; phases: on user input of There_is_a_risk_of_a_person_falling_more_than_2m

```
if(input.There_is_a_risk_of_a_person_falling_more_than_2m == TRUE)
{
input.Fall_Arrest_Harness = TRUE;
}
```

### PPE - Hot Works

- Event: on edit; phases: on user input of Hot_works

```
if(input.Hot_works == TRUE)
{
input.Safety_Boots = TRUE;
input.Safety_Glasses = TRUE;
input.Hand_Protection = TRUE;
}
```

### PPE - Mobile Plant

- Event: on edit; phases: on user input of There_is_movement_of_powered_mobile_plant

```
if(input.There_is_movement_of_powered_mobile_plant == TRUE)
{
input.Hi_Visibility_Clothing = TRUE;
input.Safety_Boots = TRUE;
}
```

### PPE - Roadways

- Event: on edit; phases: on user input of Work_is_on_or_adjacent_to_roadways_or_railways_used_by_road_or_rail_traffic

```
if(input.Work_is_on_or_adjacent_to_roadways_or_railways_used_by_road_or_rail_traffic == TRUE)
{
input.Hi_Visibility_Clothing = TRUE;
input.Safety_Boots = TRUE;
}
```

### PPE - Dust

- Event: on edit; phases: on user input of Dust_producing_activities

```
if(input.Dust_producing_activities == TRUE)
{
input.Safety_Glasses = TRUE;
input.Face_Mask = TRUE;
input.Hand_Protection = TRUE;
}
```

### PPE - Demolition

- Event: on edit; phases: on user input of Work_involving_demolition

```
if(input.Work_involving_demolition == TRUE)
{
input.Safety_Boots = TRUE;
input.Safety_Glasses = TRUE;
input.Hard_hat = TRUE;
input.Face_Mask = TRUE;
input.Hand_Protection = TRUE;
input.Hearing_Protection = TRUE;
```

## Design_Task (29)

### Check_Mandatory_Fields_DesignTsk

- Event: on edit; phases: on validate

```
if(input.Set_mandatory == true)
{
if(input.Task_Name.isEmpty())
{
alert(Task_Name,"Please fill the mandatory fields");
cancel submit;
}
if(input.Stage.isEmpty())
```

### Update_Url_Design

- Event: on add; phases: on success

```
url = Map();
url.put("value","View Record");
url.put("url","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Design_Task1_Report/" + input.ID);
edit_url = Map();
edit_url.put("value","Edit Record");
edit_url.put("url","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/Design_Task/record-edit/Design_Task1_Report/" + input
data_map = Map();
data_map.put("View_Record",url);
```

### Set Mandatory Value

- Event: on edit; phases: on load

```
input.Set_mandatory = true;
```

### Deasingtask_Email_For_ProjectManager (INACTIVE)

- Event: on add; phases: on success; sends mail

### Email_For_Teammemnber (INACTIVE)

- Event: on edit; phases: on update of Team_Member; sends mail

### DesignTask_Checklistcreation (INACTIVE)

- Event: on edit; phases: on update of Team_Member

### PostJob_Checklist_Creation

- Event: on edit; phases: on update of Notes

```
if(!isNull(input.Team_Leader3))
{
cre_data_map = Map();
cre_data_map.put("Design_Task_Name",input.Task_Name);
cre_data_map.put("Design_Task_ID",input.ID);
cre_data_map.put("Team_Leader_Check","Yes");
cre_data_map.put("Checklist_Owner",input.Team_Leader3);
cre_data_map.put("Check_List_Type","Post Job Checklist");
```

### Teamleader_And_Teammeber_Validation (INACTIVE)

- Event: on edit; phases: on validate

### TeamLeader_And_TeamMember_Validation (INACTIVE)

- Event: on edit; phases: on validate

### Hide_All_Fiels_VM

- Event: on add or edit; phases: on load

```
hide Internal_Field;
hide Team_Member;
hide Task_Assigned_to;
hide Task_Owner;
disable Completed;
disable Created;
disable Quoted_Hours1;
disable Cost_Type;
```

### Update Date and Time

- Event: on add; phases: on load

```
input.Created = zoho.currenttime;
disable Task_Name;
openUrl("#Form:Alert_Message?plain=You cannot create a Task here. Please create it from within your job","popup window");
```

### Update the Completed Date

- Event: on edit; phases: on success

```
if(Stage == "Completed")
{
input.Completed = zoho.currenttime;
}
```

### Update stage for In Progress

- Event: on edit; phases: on update of Team_Leader3

```
if(!isNull(input.Team_Leader3) || !isNull(input.Team_Member))
{
input.Stage = "In Progress";
update_job = Jobs[ID == input.Jobs];
update_job.Stage="In Progress";
}
```

### Create Workdrive Folder

- Event: on add; phases: on success

```
thisapp.Zoho_Workdrive.Create_Folder_Workdrive_(input.ID,"Design_Task");
```

### Create and Update File to Workdrive

- Event: on add or edit; phases: on success; CRM

```
//Calculate Labour Cost - done by FI B
if(input.Project_Manager != null)
{
get_pro_manager = Employee_Database[ID == input.Project_Manager];
if(get_pro_manager.count() == 1 && input.Booked_Hours > 0 && get_pro_manager.Hourly_Rate > 0)
{
input.Labour_Cost1 = input.Booked_Hours * get_pro_manager.Hourly_Rate;
}
```

### Can't Delete Design Tasks

- Event: on delete; phases: on validate

```
UserPM = "mick@visualexposure.com.au";
if(zoho.loginuserid != UserPM)
{
if(input.Quoted_Hours1 != 0 || Null)
{
alert " There are quoted hours against this Task. You cannot delete it. Move it to 'Complete - Not Used' instead";
cancel delete;
}
```

### Task Description updated = Yes

- Event: on add; phases: on success

```
input.Task_Desc_Updated = "Yes";
```

### Update Task Description

- Event: on edit; phases: on load

```
if(input.Task_Desc_Updated != "Yes")
{
input.Task_Description = input.Task_Description2;
input.Task_Desc_Updated = "Yes";
}
```

### Update Task Name in workdrive

- Event: on edit; phases: on update of Task_Name

```
thisapp.Folder_Name_Update_FI_SS(input.ID,"Design_Task");
```

### update workdrive folder name

- Event: on delete; phases: on success

```
// thisapp.Zoho_Workdrive.FI_SS_Update_foldername_delete("Design_Task",input.ID);
Job_detail = Jobs[ID == input.Jobs];
if(Job_detail.count() > 0)
{
taskname = input.Task_Name;
folderid = input.Folder_Location_on_Server.getsuffix("folder/").getprefix(" ").getprefix("'");
// 	info folderid;
header = Map();
```

### delete_file_from_workdrive

- Event: on add or edit; phases: on delete row of Attachments

```
docid = row.Document_Id;
thisapp.Zoho_Workdrive.Delete_File_from_workdrive(docid.toString());
```

### Update the Design Task Status (INACTIVE)

- Event: on add or edit; phases: on success

### SK_update_status

- Event: on edit; phases: on update of Stage; sends mail; CRM

```
if(input.Stage == "Completed" || input.Stage == "Complete - Not Used" || input.Stage == "Cancelled")
{
get_install = Install_Job[Jobs == input.Jobs && Stage != "Completed" && Stage != "Complete - Not Used" && Stage != "Cancelled"];
get_design = Design_Task[Jobs == input.Jobs && Stage != "Completed" && Stage != "Complete - Not Used" && Stage != "Cancelled"];
get_fab = Fabrication_Job1[Jobs == input.Jobs && Stage != "Completed" && Stage != "Complete - Not Used" && Stage != "Cancelled"];
if(get_install.count(ID) != 0 || get_fab.count(ID) != 0 || get_design.count(ID) != 0)
{
}
```

### Close Popup Window

- Event: on edit; phases: on success

```
openUrl("#Script:page.Close ","popup window");
openURL("#Script:page.parent.refresh","parent window");
```

### K_Update the Jobs URL to Jobs Link field

- Event: on add; phases: on success

```
if(input.Jobs != null)
{
jobRec = Jobs[ID == input.Jobs];
if(jobRec.count() > 0)
{
jobID = jobRec.ID.tostring();
jobStage = ifnull(jobRec.Stage,"");
jobName = ifnull(jobRec.Job_Subject,"");
```

### KK Design- Update the Link & Deal Based on Jobs

- Event: on add or edit; phases: on user input of Jobs

```
if(input.Jobs != null)
{
jobRec = Jobs[ID == input.Jobs];
if(jobRec.count() > 0)
{
jobID = jobRec.ID.tostring();
jobStage = ifnull(jobRec.Stage,"");
jobName = ifnull(jobRec.Job_Subject,"");
```

### Design Task Hide Field Jobs Links and CRM Deal

- Event: on add or edit

### AJ Update the Status on Deleted Design Task

- Event: on delete; phases: on success; CRM

```
all_total_fab_Hours = 0;
tota_comp_fab_Hours = 0;
for each  fab_rec_ in Fabrication_Job1[Jobs == input.Jobs]
{
all_total_fab_Hours = all_total_fab_Hours + ifnull(fab_rec_.Proposed_Hours,0);
if(fab_rec_.Stage == "Completed")
{
tota_comp_fab_Hours = tota_comp_fab_Hours + ifnull(fab_rec_.Proposed_Hours,0);
```

### Ak_generate_url (INACTIVE)

- Event: -; phases: on start

## Install_Post_Job_Checklists (26)

### Hide and Show Fields

- Event: on add or edit; phases: on load

```
Role = input.Employee.Role;
hide Total_unbilled_Hours;
Install_Jobid = input.Install_Job;
Installjobrecords = Install_Job[ID == Install_Jobid];
Teamleadercheck = Installjobrecords.Team_Leader;
TL = Teamleadercheck.VE_Email_Address;
Teammembercheck = Installjobrecords.Other_Staff;
TM = Teammembercheck.VE_Email_Address;
```

### Check Mandatory Fields

- Event: on edit; phases: on validate

```
UserPM = Employee_Database[VE_Email_Address == zoho.loginuserid];
Install_Jobid = input.Install_Job;
Installjobrecords = Install_Job[ID == Install_Jobid];
TeamLeaderCheck = Installjobrecords.Team_Leader;
TL = TeamLeaderCheck.VE_Email_Address;
TeamMemberCheck = Installjobrecords.Other_Staff;
TM = TeamMemberCheck.VE_Email_Address;
if(input.Set_Mandatory)
```

### Stage - On Site Finished - All PJC1 Complete

- Event: on edit; phases: on update of Onsite_Stageteam

```
Installtask = Install_Post_Job_Checklists[Install_Task_ID == input.Install_Task_ID];
Addthelist = List();
for each  take in Installtask
{
Fullrec = Install_Post_Job_Checklists[ID == take];
checkvalue = Fullrec.Onsite_Stageteam;
Addthelist.add(checkvalue);
}
```

###   Stage - Manager Review - All PJC2 Complete (INACTIVE)

- Event: on edit; phases: on update of Job_Closure_Stage

### Redirect_to_Installtask

- Event: on edit; phases: on success

```
// installtask_record = Install_Job[ID == input.Install_Job];
// installtask_record.Disable_the_Team_Leader_and_Member=True;
// openUrl("https://creatorapp.zoho.com.au/visualexposureandcreations/projects/#Report:My_Install_Calendar","same window");
// //openUrl("#Form:Install_Pre_Job_Checklists?recLinkID=" + AllInstall.ID + "&viewLinkName=All_Install_Pre_Job_Checklists_Report","popup wi
// Update related Install Job field
// installtask_record = Install_Job[ID == input.Install_Job];
// installtask_record.Disable_the_Team_Leader_and_Member=true;
// // Redirect to the Install Tasks report filtered by the related Install Job
```

### Update the Work drive Link

- Event: on edit; phases: on load

```
fetch_reco = Install_Job[ID == input.Install_Job];
if(fetch_reco.Folder_Location_on_Server != null)
{
val = fetch_reco.Folder_Location_on_Server;
ele = replaceFirst(val,"Click to view","Click to upload Pics, Audio and other files.");
input.Please_upload_good_photos_of_the_completed_job = ele;
//for button style
input.Please_upload_good_photos_of_the_completed_job = input.Please_upload_good_photos_of_the_completed_job + "<style> .notes-field a{  back
```

### Update the Job hours from previous checklists

- Event: on add or edit; phases: on load

```
if(input.Onsite_Stageteam != "Completed")
{
//Get Start time from Pre Job Checlist and put int Post Job Checklist #1
rec_pre_job = Install_Pre_Job_Checklists[Install_Job == input.Install_Job && Checklist_Owner == input.Employee];
input.What_was_your_Job_Start_Time_First = ifNull(rec_pre_job.What_was_your_job_start_time_VE_start_time_or_the_time_you_left_the_previous_j
input.On_Site_Arrival_Time1 = ifNull(rec_pre_job.What_time_did_you_arrive_on_site,Null);
//If first Checklist complete add time to second checklist
}
```

### Check Job Hours !> than 16

- Event: on edit; phases: on user input of What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_when_you_left_site_for_the2

```
rec_pre_job = Install_Pre_Job_Checklists[Install_Job == input.Install_Job && Checklist_Owner == input.Employee];
if(input.What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_when_you_left_site_for_the2 != NULL && input.What_was_your_J
{
difference = input.What_was_your_Job_Start_Time1.timeBetween(input.What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_wh
//alert difference;
remove_ = replaceAll(difference,":",".");
newText = remove_.removeLastOccurence(".");
//Timeadded = input.What_was_your_Job_Start_Time1.addHour(16);
```

### Validate Time entries

- Event: on edit; phases: on user input of What_was_your_on_site_finish_time

```
Timeadded = input.What_was_your_Job_Start_Time_First.addHour(16);
if(input.What_was_your_on_site_finish_time < input.What_was_your_Job_Start_Time_First)
{
alert "The time that you arrived on site is before the time to left the factory. \n This isn't possible, so please review";
}
else if(input.What_was_your_on_site_finish_time > Timeadded)
{
alert "You have indicated that this job took more than 16 hours. \n Please review";
```

### Validate time entries

- Event: on edit; phases: on user input of What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_when_you_left_site_for_the2

```
Timeadded = input.What_was_your_Job_Start_Time1.addHour(16);
if(input.What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_when_you_left_site_for_the2 < input.What_was_your_Job_Start_
{
alert "Your finish time is before your start time. \n This isn't possible, so please review";
}
else if(input.What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_when_you_left_site_for_the2 > Timeadded)
{
alert "You have indicated that this job took more than 16 hours. \n Please review";
```

### Hide Developer Fields

- Event: on add or edit

### FI B Update Edit Record Link

- Event: on add or edit; phases: on success

```
edit_urll = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/Install_Post_Job_Checklists/record-edit/All_Install_Post_Job
input.Edit_Record = "<a href='" + edit_urll + "' target='_blank'>Edit Record </a>";
```

### FI B Success WF

- Event: on add or edit; phases: on success; CRM

```
//Calculate Labour Cost - done by FI B
if(input.Employee != null)
{
get_checklst_owner = Employee_Database[ID == input.Employee];
if(get_checklst_owner.count() == 1 && input.Total_Job_Hours > 0 && get_checklst_owner.Hourly_Rate > 0)
{
input.Labour_Cost = input.Total_Job_Hours * get_checklst_owner.Hourly_Rate;
}
```

### Job Finish Time - Update work hours

- Event: on add or edit; phases: on user input of What_was_your_Job_Start_Time1

```
rec_pre_job = Install_Pre_Job_Checklists[Install_Job == input.Install_Job && Checklist_Owner == input.Employee];
if(!input.What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_when_you_left_site_for_the2.isBlank() && !input.What_was_yo
{
difference = input.What_was_your_Job_Start_Time1.timeBetween(input.What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_wh
//alert difference;
remove_ = replaceAll(difference,":",".");
newText = remove_.removeLastOccurence(".");
remove_ = replaceAll(difference,":",".");
```

### Show Subtask Message

- Event: on add or edit; phases: on load

```
Install_Jobid = input.Install_Job;
Installjobrecords = Install_Job[ID == Install_Jobid];
Teamleadercheck = Installjobrecords.Team_Leader;
TL = Teamleadercheck.VE_Email_Address;
Teammembercheck = Installjobrecords.Other_Staff;
TM = Teammembercheck.VE_Email_Address;
if(Installjobrecords.Install_Type == "VE Subtask" && Onsite_Stageteam != "Completed")
{
```

### Check Job hours are not wrong

- Event: on add or edit; phases: on user input of What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_when_you_left_site_for_the2

```
rec_pre_job = Install_Pre_Job_Checklists[Install_Job == input.Install_Job && Checklist_Owner == input.Employee];
if(!input.What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_when_you_left_site_for_the2.isBlank() && !input.What_was_yo
{
difference = input.What_was_your_Job_Start_Time1.timeBetween(input.What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_wh
//alert difference;
remove_ = replaceAll(difference,":",".");
newText = remove_.removeLastOccurence(".");
remove_ = replaceAll(difference,":",".");
```

### Update Stage to Complete

- Event: on add or edit; phases: on success

```
if(input.What_was_your_Job_Start_Time1 != Null && input.What_was_your_Job_finish_time_The_time_you_finished_unloading_at_VE_or_when_you_left
{
input.Job_Closure_Stage = "Completed";
get_ins_job = Install_Job[ID == input.Install_Job];
if(get_ins_job.count() == 1 && get_ins_job.Jobs != null)
{
get_Job = Jobs[ID == get_ins_job.Jobs];
if(get_Job.count() == 1)
```

### Stage - Manager Review - All PJC2 Complete

- Event: on add or edit; phases: on success

```
if(input.Job_Closure_Stage == "Completed")
{
Installtask = Install_Post_Job_Checklists[Install_Task_ID == input.Install_Task_ID];
Addthelist = List();
for each  take in Installtask
{
Fullrec = Install_Post_Job_Checklists[ID == take];
checkvalue = Fullrec.Job_Closure_Stage;
```

### Send Email to PM (Finished On Site)

- Event: on edit; phases: on success; sends mail

```
Install_Jobid = input.Install_Job;
Installjobrecords = Install_Job[ID == Install_Jobid];
ProjectManager = Installjobrecords.Project_Manager;
PMDetails = Employee_Database[ID == ProjectManager];
PMEmail = PMDetails.VE_Email_Address;
PMName = PMDetails.Name.first_name;
setupdata = Setup[ID != 0];
inst_manager = setupdata.Installation_Manager1;
```

### Update the Issue

- Event: on add; phases: on success; sends mail

```
manager_rec = Setup[ID != null];
input.Install_Job_Lookup = input.Install_Job;
get_workers = Employee_Database[ID == manager_rec.Installation_Manager1];
if(input.Q_PJ_Management_Review == "Yes")
{
InstallTask = Install_Job[ID == input.Install_Job && Management_Review.isEmpty()];
if(InstallTask.count() > 0)
{
```

### Insert the Rate

- Event: on edit; phases: on update of Please_rate_the_quality_of_the_briefing_that_you_received_before_this_job_began

```
if(input.Please_rate_the_quality_of_the_briefing_that_you_received_before_this_job_began != null)
{
InstallTaskDetails = Install_Job[ID == input.Install_Job];
EmployeeRated = Employee_Database[VE_Email_Address == zoho.loginuserid];
if(InstallTaskDetails.count() > 0 && EmployeeRated.count() > 0)
{
EmployeeRatingDetails = Employee_Rating_Details[Install_Post_Job_Checklists_Lookup == input.ID && ID == InstallTaskDetails.Project_Manager &
if(EmployeeRatingDetails.count() == 0)
```

### Update the Issue

- Event: on edit; phases: on update of Q_PJ_Management_Review; sends mail

```
manager_rec = Setup[ID != null];
get_workers = Employee_Database[ID == manager_rec.Installation_Manager1];
if(input.Q_PJ_Management_Review == "Yes")
{
InstallTask = Install_Job[ID == input.Install_Job && Management_Review.isEmpty()];
if(InstallTask.count() > 0)
{
InsertIssue = insert into Issues
```

### Update the Issue for WHS

- Event: on edit; phases: on update of Q_PJ1_TL_OHS; sends mail

```
manager_rec = Setup[ID != null];
get_workers = Employee_Database[ID == manager_rec.Installation_Manager1];
if(input.Q_PJ1_TL_OHS == "Yes")
{
InstallTask = Install_Job[ID == input.Install_Job && WHS_Reported.isEmpty()];
if(InstallTask.count() > 0)
{
InsertIssue = insert into Issues
```

### Validate Unbilled Hours

- Event: on add or edit; phases: on user input of Total_unbilled_Hours

```
if(input.Total_unbilled_Hours < 0 || input.Total_unbilled_Hours > 16)
{
alert "Please Enter the correct billed hours";
input.Total_unbilled_Hours = null;
}
```

### Update Employee Hours

- Event: on edit; phases: on update of Total_Job_Hours

```
if(input.Employee_Hours_Lookup != null)
{
thisapp.Issue.UpdateEmployeeWorkHours(input.Employee_Hours_Lookup);
}
```

### WHS Selection check

- Event: on edit; phases: on user input of Q_PJ1_TL_OHS

```
if(!input.Q_PJ1_TM_OHS.isBlank() || !Q_PJ1_TL_OHS.isblank())
{
alert "You have indicated that there were WHS issue on this site. Did you mean to check this box? If so, Make sure you describe the issue in
}
```

## Jobs (24)

### Validating the Form Fields

- Event: on edit; phases: on validate

```
/* if(input.Expected_Job_Finish == null || input.Stage == null || input.Expected_Job_Finish == null || input.Folder_Location_on_Server == nu
{
alert "Please fill the mandatory fields";
cancel submit;
} */
//&& input.Stage == null && input.Expected_Job_Finish == null && input.Folder_Location_on_Server == null && input.Job_Owner == null && input
if(input.Set_Mandatory == true)
{
```

### Update_Url

- Event: on add; phases: on success

```
if(!input.Owner_Email.isEmpty())
{
get_project_manager = Employee_Database[VE_Email_Address == input.Owner_Email];
if(get_project_manager.count() > 0)
{
input.Project_Manager = get_project_manager.ID;
}
}
```

### Set Mandatory Value

- Event: on edit; phases: on load

```
disable Job_Subject;
input.Set_Mandatory = true;
hide Set_Mandatory;
input.Way_Sync = true;
```

### VE_Email_For_ProjectManager (INACTIVE)

- Event: on add; phases: on success; sends mail

### VE_Email_For_FabManager

- Event: on add; phases: on success; sends mail

```
// Employee_Databas_Id = input.Fab_Manager;
// if(!isNull(input.Fab_Manager))
// {
// 	Emaildetaisl = Employee_Database[ID == Employee_Databas_Id];
if(!isNull(input.Owner_Email))
{
if(input.Owner_Email == "eddy@visualexposure.com.au")
{
```

### on Load Hide the Job Fields

- Event: on add or edit

### LOAD WF

- Event: on add or edit; phases: on load

```
if(zoho.loginuserid == zoho.adminuserid)
{
// 	enable Fab_Completed;
// 	enable Job_Completed;
// 	enable Related_Quote;
enable Deal;
//enable View_Record;
enable Job_Created_Date;
```

### Completed_crm_job_update

- Event: on edit; phases: on user input of Stage; CRM

```
putstage = input.Stage;
if(putstage = "Completed" || putstage = "Cancelled")
{
dealid = input.Deal;
mappping = Map();
mappping.put("related_Job_check",True);
deal_update = zoho.crm.updateRecord("Deals",dealid.toNumber(),mappping);
}
```

### Can't close if tasks open

- Event: on edit; phases: on validate

```
if(Stage == "Completed" || Stage == "Cancelled")
{
AllDesignTasks = Design_Task[Jobs == input.ID];
for each  test in AllDesignTasks
{
stage_ = AllDesignTasks.Stage;
if(stage_ == "Completed" || stage_ == "Complete - Not Used" || stage_ == "Cancelled")
{
```

### FI B Sync Job Name CRM (INACTIVE)

- Event: on edit; phases: on update of Job_Subject

### FI B Sync Closing Date CRM (INACTIVE)

- Event: on edit; phases: on update of Expected_Job_Finish

### FI B Sync File Location CRM (INACTIVE)

- Event: on edit; phases: on update of File_Location_on_VE_Server; sends mail

### FI B Sync Jobs to CRM

- Event: on edit; phases: on success; CRM

```
if(input.Way_Sync == true)
{
thisapp.FI_B_Function.FI_B_Sync_Jobs_Data_CRM(input.ID);
}
update_map = Map();
//update_map.put("Job","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/#Page:Job_Details?Job_ID_Var=" + input.ID + "&Job
update_map.put("Job","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/#Page:Job_Details?Job_ID_Var=" + input.ID);
update_response = zoho.crm.updateRecord("Deals",input.Deal.toLong(),update_map);
```

### Check if job has tasks

- Event: on edit; phases: on load

```
Fabtask = Fabrication_Job1[Jobs == input.ID];
FabYes = 0;
Installtask = Install_Job[Jobs == input.ID];
InstallYes = 0;
for each  take in Fabtask
{
FabYes = FabYes + 1;
}
```

### Can't delete jobs

- Event: on delete; phases: on validate

```
UserPM = "mick@visualexposure.com.au";
if(zoho.loginuserid != UserPM)
{
alert "You are not authoised to delete jobs. Please see you Manager if you need it deleted.";
cancel delete;
}
```

### Update Completion Percentages

- Event: on edit; phases: on success; sends mail

```
all_total_fab_Hours = 0;
tota_comp_fab_Hours = 0;
Fab_Count_Un = 0;
Fab_Count_Comp = 0;
Inst_Count_Un = 0;
Inst_Count_Comp = 0;
design_Count_Un = 0;
design_Count_comp = 0;
```

### sk_update

- Event: on edit; phases: on update of Stage; sends mail; CRM

```
// if(input.Way_Sync == true)
// {
// 	thisapp.FI_B_Function.FI_B_Sync_Jobs_Data_CRM(input.ID);
// }
if(input.Stage == "Completed - Closed")
{
update_map = Map();
update_map.put("Job_Stage","Completed - Closed");
```

### AJ_Cancelled_the_All_the_task (INACTIVE)

- Event: on edit; phases: on update of Close_all_Task

### send email on job completion

- Event: on add or edit; phases: on success; sends mail; CRM

```
if(input.Stage == "Completed - Closed" && input.Closure_Email_Sent != true)
{
thisapp.SendMailForJob(input.ID);
input.Job_Close_Triggered = false;
// 	jname = input.Job_Subject;
// 	dealid = input.Deal;
// 	dealdata = zoho.crm.getRecordById("Deals",dealid.toLong());
// 	// 	info dealdata;
```

### Disable project manager

- Event: on add or edit; phases: on load

```
disable Project_Manager;
```

### K Send Profit Revision Email (INACTIVE)

- Event: on edit; phases: on success

### K Reset Closure Email Flag on Stage Change

- Event: on edit; phases: on success

```
if(input.Stage != "Completed" && input.Stage != "Completed - Closed" && input.CRM_Update_Sync != true)
{
input.Closure_Email_Sent = false;
}
```

### Refresh Page

- Event: on add; phases: on load

```
disable Job_Subject;
openUrl("#Form:Alert_Message?plain=You cannot create a New job here. Please create new jobs by converting a Deal in CRM","popup window");
```

### K Profit Revision Email Digest

- Event: -; phases: on start

## Install_Pre_Job_Checklists (20)

### Update The Install Task Module (INACTIVE)

- Event: on add; phases: on success

### Hide and Show Fields (INACTIVE)

- Event: on add; phases: on user input of Team_Leader_Check

### On Load Fields Hide (INACTIVE)

- Event: on add; phases: on load

### SendEmail_To_Member_And_Owners (INACTIVE)

- Event: on add; phases: on success; sends mail

### Update_the_Installtype_Stage (INACTIVE)

- Event: on edit; phases: on update of Status

### Show and Hide Fields

- Event: on add or edit; phases: on load

```
Role = input.Checklist_Owner.Role;
hide Install_Job_Name;
hide Install_Job;
hide Set_Mndatory;
hide Status;
hide Checklist_Owner;
hide Check_List_Type;
hide Team_Leader_Check;
```

### JobClosure_Completed

- Event: on edit; phases: on success

```
installtask_record = Install_Job[ID == input.Install_Job];
if(input.OnsiteStage == "Completed")
{
input.Status = "PreJob Completed";
input.Internal_Stage = True;
}
if(input.Job_Arrival_Stage == "Completed")
{
```

### Final_Mandatory_set

- Event: on edit; phases: on validate

```
Role = input.Checklist_Owner.Role;
//input.Set_Mndatory = "True";
Install_Jobid = input.Install_Job;
Installjobrecords = Install_Job[ID == Install_Jobid];
Teamleadercheck = Installjobrecords.Team_Leader;
TL = Teamleadercheck.VE_Email_Address;
fach_swms_rec = SWMS[Install_Task_Details == input.Install_Job];
//tl_email = fach_swms_rec.Team_Leader_Email;
```

### Completed_Popup (INACTIVE)

- Event: on edit; phases: on update of OnsiteStage

### VM_New_Stage1 (INACTIVE)

- Event: on edit; phases: on update of OnsiteStage

### VM_Newstage2 (INACTIVE)

- Event: on edit; phases: on update of Job_Arrival_Stage

### Submitactions

- Event: on add; phases: on success

```
openUrl("#Script:page.Close ","popup window");
```

### Redirectto_InstallTask

- Event: on edit; phases: on success

```
openUrl("https://creatorapp.zoho.com.au/visualexposureandcreations/projects/#Page:Installer_Dashboard","same window");
//openUrl("https://creatorapp.zoho.com.au/visualexposureandcreations/projects/#Report:My_Install_Calendar","same window");
//openUrl("https://creatorapp.zoho.com.au/visualexposureandcreations/projects/#Report:Install_Job_TL_and_TM","same window");
//openUrl("#Form:Install_Pre_Job_Checklists?recLinkID=" + AllInstall.ID + "&viewLinkName=All_Install_Pre_Job_Checklists_Report","popup windo
```

### Update the Work drive Link for Install

- Event: on edit; phases: on load

```
fetch_reco = Install_Job[ID == input.Install_Job];
if(fetch_reco.Folder_Location_on_Server != null)
{
val = fetch_reco.Folder_Location_on_Server;
ele = replaceFirst(val,"Click to view","Click to upload Pics, Audio and other files");
input.Please_upload_good_photos_of_the_completed_job = ele;
//for button style
input.Please_upload_good_photos_of_the_completed_job = input.Please_upload_good_photos_of_the_completed_job + "<style> .notes-field a{  back
```

### SWMS_Declaration

- Event: on edit; phases: on validate

```
if(input.Job_Arrival_Stage == "Completed")
{
SWMSDETAILS = SWMS[Install_Task_Details == input.Install_Job];
declaration = SWMSDETAILS.Subform;
if(declaration == null)
{
alert "The SWMS has not been signed on site. Please complete the SWMS Declartion for all staff on site and comne back to complete this check
cancel submit;
```

### SWMS Declartion Completed check

- Event: on edit; phases: on load

```
if(input.OnsiteStage == "Completed" && input.Job_Arrival_Stage != "Completed")
{
SWMSDETAILS = SWMS[Install_Task_Details == input.Install_Job];
declaration = SWMSDETAILS.Subform;
if(declaration == null)
{
alert "The SWMS has not been signed on site. Please complete the SWMS Declaration for all staff on site and come back to complete this check
}
```

### Updatre the stage to In Progress

- Event: on edit; phases: on update of OnsiteStage

```
Installtask = Install_Pre_Job_Checklists[Install_Task_ID == input.Install_Task_ID];
installtask_record = Install_Job[ID == input.Install_Job];
if(input.OnsiteStage == "Completed" && installtask_record.Stage == "Scheduled")
{
job_record = Jobs[ID == installtask_record.Jobs];
job_record.Stage="In Progress";
installtask_record.Stage="In Progress";
installtask_record.Sub_Stages="Team Briefed";
```

### Update to \"On Site\"

- Event: on edit; phases: on update of Job_Arrival_Stage

```
Installtask = Install_Pre_Job_Checklists[Install_Task_ID == input.Install_Task_ID];
installtask_record = Install_Job[ID == input.Install_Job];
if(input.Job_Arrival_Stage == "Completed" && installtask_record.Stage == "In Progress")
{
installtask_record.Stage="In Progress";
installtask_record.Sub_Stages="On Site";
}
```

### Validate time entries

- Event: on edit; phases: on user input of What_was_your_job_start_time_VE_start_time_or_the_time_you_left_the_previous_job

```
Previous_Date1 = zoho.currentdate.subDay(1);
Previous_Date15 = zoho.currentdate.subDay(15);
Future_Date = zoho.currentdate.addDay(1);
if(input.What_time_did_you_arrive_on_site < input.What_was_your_job_start_time_VE_start_time_or_the_time_you_left_the_previous_job)
{
alert "The time that you arrived on site is before the time to left the factory. \n This isn't possible, so please review";
}
else if(input.What_was_your_job_start_time_VE_start_time_or_the_time_you_left_the_previous_job <= zoho.currentdate)
```

### Validate time entries

- Event: on edit; phases: on user input of What_time_did_you_arrive_on_site

```
Previous_Date1 = zoho.currentdate.subDay(1);
Previous_Date15 = zoho.currentdate.subDay(15);
Future_Date = zoho.currentdate.addDay(1);
if(input.What_time_did_you_arrive_on_site < input.What_was_your_job_start_time_VE_start_time_or_the_time_you_left_the_previous_job)
{
alert "The time that you arrived on site is before the time to left the factory. \n This isn't possible, so please review";
}
else if(input.What_time_did_you_arrive_on_site <= zoho.currentdate)
```

## Fabrication_Post_Job_Checklists (20)

### Fab_Send_Email (INACTIVE)

- Event: on add; phases: on success; sends mail

### Update Workdrive Link (INACTIVE)

- Event: on edit; phases: on load

### Jobclosure

- Event: on edit; phases: on success

```
Fabtask = Fabrication_Post_Job_Checklists[Fabrication_Task_ID == input.Fabrication_Task_ID];
fabtask_record = Fabrication_Job1[ID == input.Fabrication_Job1];
fabtask_record.Disable_the_Team_Leader_and_Member=True;
Addthelist = List();
for each  take in Fabtask
{
Fullrec = Fabrication_Post_Job_Checklists[ID == take];
checkvalue = Fullrec.Status;
```

### Validation of mandatory fields

- Event: on edit; phases: on validate

```
UserPM = Employee_Database[VE_Email_Address == zoho.loginuserid];
Fab_Jobid = input.Fabrication_Job1;
Fabjobrecords = Fabrication_Job1[ID == Fab_Jobid];
Teamleadercheck = Fabjobrecords.Team_Leader1;
TL = Teamleadercheck.VE_Email_Address;
Teammembercheck = Fabjobrecords.Task_Assigned_to;
TM = Teammembercheck.VE_Email_Address;
PMcheck = Fabjobrecords.Fab_Manager;
```

### Calculate Labour Costs

- Event: on add or edit; phases: on success; CRM

```
//Calculate Labour Cost - done by FI B
if(input.Checklist_Owner != null)
{
get_checklst_owner = Employee_Database[ID == input.Checklist_Owner];
if(get_checklst_owner.count() == 1 && input.Total_Job_Hours > 0 && get_checklst_owner.Hourly_Rate > 0)
{
input.Labour_Cost = input.Total_Job_Hours * get_checklst_owner.Hourly_Rate;
}
```

### Update Edit Button

- Event: on add or edit; phases: on success

```
edit_urll = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/Fabrication_Post_Job_Checklists/record-edit/Fabrication_Post
input.Edit_Record = "<a href='" + edit_urll + "' target='_blank'>Edit Record </a>";
// edit_url = Map();
// edit_url.put("value","Edit Record");
// edit_url.put("url","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/Fabrication_Post_Job_Checklists/record-edit/Fabric
// data_map = Map();
// data_map.put("Edit_Record",edit_url);
// other_map = Map();
```

### Hide and Show Fields (INACTIVE)

- Event: on add or edit; phases: on load

### Check Mandatory fields for PM

- Event: on add; phases: on validate

```
UserPM = Employee_Database[VE_Email_Address == zoho.loginuserid];
if(UserPM.Project_Manager.contains("Yes") == true || UserPM.Fabrication_2IC.contains("Yes") == true)
{
if(input.Status == Null)
{
if(input.Fabrication_Job_Lookup.Fab_Type != "Workshop")
{
if(input.Total_Job_Hours == NULL || input.Total_Job_Hours <= 0 || input.Total_Job_Hours > 16)
```

### Send Email to Fab Manager

- Event: on edit; phases: on success; sends mail

```
Fab_Jobid = input.Fabrication_Job1;
Fabjobrecords = Fabrication_Job1[ID == Fab_Jobid];
FabManager = Fabjobrecords.Fab_Manager;
FMDetails = Employee_Database[ID == FabManager];
FMEmail = FMDetails.VE_Email_Address;
FMName = FMDetails.Name.first_name;
employ = input.Checklist_Owner;
employname = Employee_Database[ID == employ];
```

### Hide and Show Fields

- Event: on edit; phases: on load

```
UserPM = Employee_Database[VE_Email_Address == zoho.loginuserid];
Fab_Jobid = input.Fabrication_Job1;
Fabjobrecords = Fabrication_Job1[ID == Fab_Jobid];
Teamleadercheck = Fabjobrecords.Team_Leader1;
TL = Teamleadercheck.VE_Email_Address;
Teammembercheck = Fabjobrecords.Task_Assigned_to;
TM = Teammembercheck.VE_Email_Address;
PMcheck = Fabjobrecords.Fab_Manager;
```

### Hide and Show Fields

- Event: on add; phases: on load

```
UserPM = Employee_Database[VE_Email_Address == zoho.loginuserid];
Fab_Jobid = input.Fabrication_Job1;
Fabjobrecords = Fabrication_Job1[ID == Fab_Jobid];
Teamleadercheck = Fabjobrecords.Team_Leader1;
TL = Teamleadercheck.VE_Email_Address;
Teammembercheck = Fabjobrecords.Task_Assigned_to;
TM = Teammembercheck.VE_Email_Address;
PMcheck = Fabjobrecords.Fab_Manager;
```

### Show Workshop Task Message

- Event: on edit; phases: on load

```
Fab_Task_ID = input.Fabrication_Job1;
Fab_Rec = Fabrication_Job1[ID == Fab_Task_ID];
if(Fab_Rec.Fab_Type == "Workshop" && Status != "Completed")
{
alert "This is a WORKSHOP TASK. Pre Job checklists are not required to be completed.\n\nDo not complete this Checklist until AFTER you have 
}
```

### Redirect to pages

- Event: on edit; phases: on success

```
UserRole = Employee_Database[VE_Email_Address == zoho.loginuserid];
Fab_Rec = Fabrication_Job1[ID == input.Fabrication_Job1];
Job_ID = Fab_Rec.Jobs;
if(UserRole.Project_Manager.contains("Yes") == true)
{
openUrl("https://creatorapp.zoho.com.au/visualexposureandcreations/projects#Page:Job_Details?Job_ID_Var=" + Job_ID,"same window");
}
else if(UserRole.Fabrication_Manager.contains("Yes") == true)
```

### Update the Issue

- Event: on add; phases: on success; sends mail

```
manager_rec = Setup[ID != null];
input.Fabrication_Job_Lookup = input.Fabrication_Job1;
if(input.Q_T_Management_Review == "Yes")
{
FabricationTask = Fabrication_Job1[ID == input.Fabrication_Job1 && Management_Review.isEmpty()];
if(FabricationTask.count() > 0)
{
InsertIssue = insert into Issues
```

### update Rating

- Event: on edit; phases: on update of Please_rate_the_quality_of_the_briefing_that_you_received_before_this_job_began

```
if(input.Please_rate_the_quality_of_the_briefing_that_you_received_before_this_job_began != null)
{
FabTaskDetails = Fabrication_Job1[ID == input.Fabrication_Job1];
EmployeeRated = Employee_Database[VE_Email_Address == zoho.loginuserid];
if(FabTaskDetails.count() > 0 && EmployeeRated.count() > 0)
{
EmployeeRatingDetails = Employee_Rating_Details[Fabrication_Post_Job_Checklists == input.ID && Employee_Database1_BiLookup == FabTaskDetails
if(EmployeeRatingDetails.count() == 0)
```

### Update the Issue by Team Member

- Event: on edit; phases: on update of Q_T_Management_Review; sends mail

```
manager_rec = Setup[ID != null];
if(input.Q_T_Management_Review == "Yes")
{
FabricationTask = Fabrication_Job1[ID == input.Fabrication_Job1 && Management_Review.isEmpty()];
if(FabricationTask.count() > 0)
{
InsertIssue = insert into Issues
[
```

### Update the Issue for OH&S

- Event: on edit; phases: on update of Q_T_OHS; sends mail

```
manager_rec = Setup[ID != null];
if(input.Q_T_OHS == "Yes")
{
FabJobTask = Fabrication_Job1[ID == input.Fabrication_Job1 && OHS_Reported.isEmpty()];
if(FabJobTask.count() > 0)
{
InsertIssue = insert into Issues
[
```

### Validate Unbilled Hours

- Event: on add or edit; phases: on user input of Total_unbilled_hours

```
if(input.Total_unbilled_hours < 0 || input.Total_unbilled_hours > 16)
{
alert "Please Enter the correct billed hours";
input.Total_unbilled_hours = null;
}
```

### Update Employee Hours

- Event: on edit; phases: on update of Total_Job_Hours

```
if(input.Employee_Hours_Lookup != null)
{
thisapp.Issue.UpdateEmployeeWorkHours(input.Employee_Hours_Lookup);
}
```

### Update Employee Unbilled Hours

- Event: on edit; phases: on update of Total_unbilled_hours

```
if(input.Employee_Hours_Lookup != null)
{
thisapp.Issue.UpdateEmployeeWorkHours(input.Employee_Hours_Lookup);
}
```

## Issues (19)

### Hide fields for non PMs (INACTIVE)

- Event: on add or edit; phases: on load

### New Issue (INACTIVE)

- Event: on add; phases: on success; sends mail

### Issue Edited (INACTIVE)

- Event: on edit; phases: on success; sends mail

### Mandatory Fields

- Event: on add or edit; phases: on validate

```
mandatory_value = 0;
if(input.Status == "Completed")
{
if(input.Date_Completed == Null)
{
mandatory_value = mandatory_value + 1;
alert(Date_Completed,"You must fill out the date completed field");
}
```

### Show Completed Notes

- Event: on add or edit; phases: on user input of Status

```
if(input.Status == "Completed")
{
disable Completion_Notes;
disable Date_Completed;
}
if(input.Status != "Completed")
{
hide Completion_Notes;
```

### K_Notify (Issues) (INACTIVE)

- Event: on add or edit; phases: on success; sends mail

### Edit - Department

- Event: on add or edit

### Update History

- Event: on add; phases: on success; sends mail

```
if(input.Person_Responsible != null)
{
thisapp.Issue.AddIssueMangementHistory(input.ID);
}
if(input.Edit_in_Management == true)
{
IssueManagemenSubform = Issue_Management_History[Issues_BiLookup == input.ID] sort by Added_Time desc;
if(IssueManagemenSubform.count() > 0)
```

### Enable Fields

- Event: on add or edit; phases: on add row of Issue_Management_History_Subform

```
EmployeeDetails = Employee_Database[VE_Email_Address == zoho.loginuserid];
if(EmployeeDetails.count() > 0)
{
WorkersID = EmployeeDetails.ID;
}
else
{
WorkersID = 34000000296314;
```

### Show and Hide Fields

- Event: on add; phases: on load

```
UserPM = Employee_Database[VE_Email_Address == zoho.loginuserid];
hide plain;
disable Assigned_to;
disable Status;
hide Date_Completed;
hide Sites;
hide Direction;
hide Management;
```

### Hide and Show Fields

- Event: on edit; phases: on load

```
UserPM = Employee_Database[VE_Email_Address == zoho.loginuserid];
disable Date_field;
disable Reported_By;
show Management;
disable Next_Steps_Notes;
disable Person_Responsible;
disable Due_Date;
hide Completion_Notes;
```

### Assign Manager

- Event: on add; phases: on success

```
manager_rec = Setup[ID != null];
if(input.Department == "Install")
{
get_workers = Employee_Database[ID == manager_rec.Installation_Manager1];
input.Manager_Email = get_workers.VE_Email_Address;
input.Assigned_to = manager_rec.Installation_Manager1;
input.Inform_Also_1 = manager_rec.Installation_Manager_inform_Also.VE_Email_Address;
input.Inform_Also_2 = manager_rec.Installation_Manager_inform_Also_2.VE_Email_Address;
```

### Disable Fields

- Event: on add or edit

```
if(row.Status == "Completed")
{
disable row.Next_Step;
disable row.Due_Date;
}
else
{
enable row.Next_Step;
```

### Hide and Show Date Completed

- Event: on add or edit; phases: on load

```
if(input.Status == "Completed")
{
show Date_Completed;
}
else
{
hide Date_Completed;
}
```

### Update Email Addresses

- Event: on edit; phases: on success; sends mail

```
manager_rec = Setup[ID != null];
if(input.Department == "Install")
{
get_workers = Employee_Database[ID == manager_rec.Installation_Manager1];
input.Manager_Email = get_workers.VE_Email_Address;
input.Inform_Also_1 = manager_rec.Installation_Manager_inform_Also.VE_Email_Address;
input.Inform_Also_2 = manager_rec.Installation_Manager_inform_Also_2.VE_Email_Address;
}
```

### Disable the Status

- Event: on add or edit

### Update CHanges in a New Field

- Event: on edit; phases: on validate

```
Message = "";
if(input.Reported_By != old.Reported_By)
{
if(old.Reported_By == null)
{
ReportedBy = "-";
}
else
```

### Send Mail for Issue Completed

- Event: on add or edit; phases: on success; sends mail

```
manager_rec = Setup[ID != null];
if(input.Edit_in_Management == true)
{
IssueManagemenSubform = Issue_Management_History[Issues_BiLookup == input.ID] sort by Added_Time desc;
// 	input.Person_Responsible = IssueManagemenSubform.Person_Responsible;
// 	input.Status = IssueManagemenSubform.Status;
// 	input.Next_Steps_Notes = IssueManagemenSubform.Next_Step;
// 	input.Due_Date = IssueManagemenSubform.Due_Date;
```

### Update the Issue History (INACTIVE)

- Event: -; phases: on start

## Fabrication_Pre_Job_Checklists (13)

### Set Hide Fields

- Event: on add; phases: on load

```
// hide Team_Leader;
// hide Have_you_taken_good_photos_of_the_completed_job;
// hide What_was_your_job_start_time;
// hide What_was_your_on_site_finish_time;
// hide Are_there_any_issues_for_this_job_that_you_need_to_inform_us_of;
// hide Do_you_have_any_other_notes_on_this_job;
// hide Non_Team_Leader;
// hide Were_there_any_OH_S_issues_in_completing_the_job;
```

### Hide and Show Fields for Team Leader Check (INACTIVE)

- Event: on add; phases: on user input of Team_Leader_Check

### Update to Fab Task Module (INACTIVE)

- Event: on add; phases: on success

### Checklistemail_send (INACTIVE)

- Event: on add; phases: on success; sends mail

### design_Job_Checklist (INACTIVE)

- Event: on add; phases: on success; sends mail

### Update_Fab_Job_type (INACTIVE)

- Event: on edit; phases: on update of Status

### Hide_Team_LeaderndTeamMember

- Event: on edit; phases: on load

```
//Role = input.Checklist_Owner.Role;
//hide test;
hide Fabrication_Task_Name;
hide Set_Mandatory;
hide Team_Leader_Check;
hide Fabrication_Job1;
hide Team_Type;
hide Status;
```

### Fabrication_Job_Closure (INACTIVE)

- Event: on edit; phases: on success

### Fabrication_Prejob_Checklist_Mandatoryfields (INACTIVE)

- Event: on edit; phases: on validate

### Set Hide Fields (INACTIVE)

- Event: on edit; phases: on user input of Team_Leader_Check

### Update_workdrivelink

- Event: on edit; phases: on load

```
fetch_reco = Fabrication_Job1[ID == input.Fabrication_Job1];
if(input.Team_Leader_Check == "Yes")
{
if(fetch_reco.Folder_Location_on_Server != null)
{
val = fetch_reco.Folder_Location_on_Server;
ele = replaceFirst(val,"Click to view","Click to upload Pics, Audio and other files");
input.Please_upload_good_photos_of_the_completed_job = ele;
```

### Update status

- Event: on edit; phases: on success

```
fabtask_record = Fabrication_Job1[ID == input.Fabrication_Job1];
fabtask_record.Disable_the_Team_Leader_and_Member=True;
input.Status = "Completed";
fabtask_record.Stage="In Progress";
fabtask_record.Sub_Stage="Fabrication Started";
openUrl("#Page:Fab_Worker_Dashboard","same window");
```

### Validation of mandatory fields

- Event: on edit; phases: on validate

```
Fab_Jobid = input.Fabrication_Job1;
Fabjobrecords = Fabrication_Job1[ID == Fab_Jobid];
Teamleadercheck = Fabjobrecords.Team_Leader1;
TL = Teamleadercheck.VE_Email_Address;
if(input.Set_Mandatory)
{
if(zoho.loginuserid == TL)
{
```

## Design_Post_Job_Checklists (12)

### Update The Design Task Module

- Event: on add; phases: on success

### Hide and Show Fields Team Leader Check (INACTIVE)

- Event: on add; phases: on user input of Team_Leader_Check

### On Load Fields Hide (INACTIVE)

- Event: on add; phases: on load

### Update_Post_Awaiting_Scheduing (INACTIVE)

- Event: on edit; phases: on update of Status

### Design_Task_Creation_Stage_Email

- Event: on add; phases: on success; sends mail

```
Employee_Databas_Id = input.Checklist_Owner;
//info "w";
Emaildetaisl = Employee_Database[ID == Employee_Databas_Id];
if(!isNull(Emaildetaisl.VE_Email_Address))
{
// 		task_name = input.Task_Name;
// 		type = "Pre Job Checklist";
// 		fnail_task_name = replaceAll(task_name," ","+");
```

### Hide_Teamleade_And_Teammember_Final

- Event: on edit; phases: on load

```
Role = input.Checklist_Owner.Role;
hide Pre_Job_Check_List;
hide Job_Arrival_Check_List;
hide What_was_your_job_start_time;
hide Team_Leader_Check;
hide Design_Task_ID;
hide Design_Task;
hide Set_Mandatory;
```

### Design_Jobclosurestage

- Event: on edit; phases: on success

```
if(input.Onsite_Stage == "Completed")
{
input.Status = "Onsite Completed";
input.Internal_Stage = True;
}
if(input.Job_Closure_Stage == "Completed")
{
input.Status = "Completed";
```

### Design_All_MandatoryFields

- Event: on edit; phases: on validate

```
Role = input.Checklist_Owner.Role;
if(input.Set_Mandatory)
{
if(Role == "Team Leader")
{
// show What_was_your_job_start_time;
//reche
if(input.Have_you_taken_good_photos_of_the_completed_job == Null || input.Was_the_work_area_cleaned_tidied_after_the_job_completed == Null |
```

### 1stwere

- Event: on edit; phases: on user input of Were_there_any_OH_S_issues_in_completing_the_job

```
if(input.Were_there_any_OH_S_issues_in_completing_the_job == "Yes")
{
show Please_share_the_details;
}
```

### 2ndwere

- Event: on edit; phases: on user input of Were_there_any_OH_S_issues_in_completing_the_job1

```
if(input.Were_there_any_OH_S_issues_in_completing_the_job1 == "Yes")
{
show Please_share_the_details1;
}
```

### Please_SHARE_Mandatory

- Event: on edit; phases: on validate

```
if(input.Set_Mandatory)
{
if(input.Were_there_any_OH_S_issues_in_completing_the_job == "Yes")
{
if(input.Please_share_the_details.isEmpty())
{
alert " Please fill all the field information to complete the checklist";
cancel submit;
```

### Completedpopup

- Event: on edit; phases: on update of Onsite_Stage

```
if(input.Onsite_Stage != "Completed")
{
info "Please fill the next job checklist";
}
```

## Design_Pre_Job_Checklists (9)

### Update The Design Task Module

- Event: on add; phases: on success

```
// Design_Task_rec = Design_Task[ID == input.Design_Task_ID.toLong()];
// if(input.Team_Leader_Check == "Yes" && Check_List_Type == "Pre Job Checklist")
// {
// 	Design_Task_rec.Removed_Material_Destroy=input.Removed_Material_Destroy;
// 	Design_Task_rec.Team_Leader_Check=input.Team_Leader_Check;
// 	Design_Task_rec.Are_you_clear_on_the_scope_of_works_for_the_job=input.Are_you_clear_on_the_scope_of_works_for_the_job;
// 	Design_Task_rec.Are_you_clear_about_what_location_each_of_the_printed_materials_needs_to_be_installed=input.Are_you_clear_about_what_loc
// 	Design_Task_rec.Are_you_clear_about_where_you_can_park_in_close_proximity_to_your_work_site=input.Are_you_clear_about_where_you_can_park
```

### Hide and Show Fields Team Leader Check (INACTIVE)

- Event: on add; phases: on user input of Team_Leader_Check

### On Load Fields Hide (INACTIVE)

- Event: on add; phases: on load

### designjob_send_email

- Event: on add; phases: on success; sends mail

```
Employee_Databas_Id = input.Checklist_Owner;
//info "w";
Emaildetaisl = Employee_Database[ID == Employee_Databas_Id];
if(!isNull(Emaildetaisl.VE_Email_Address))
{
// 		task_name = input.Task_Name;
// 		type = "Pre Job Checklist";
// 		fnail_task_name = replaceAll(task_name," ","+");
```

### Update-design_task_stage (INACTIVE)

- Event: on edit; phases: on update of Status

### Hide_Teamleader_and_TeamMembe

- Event: on edit; phases: on load

```
Role = input.Checklist_Owner.Role;
hide Job_Closure_Check_List;
hide On_Site_Job_Completion_Check_List;
//info "test";
hide Design_Task_ID;
hide Design_Task;
hide Check_List_Type;
hide Team_Leader_Check;
```

### Design_PostJob_Stage_Closure

- Event: on edit; phases: on success

```
if(input.Satge1 == "Completed")
{
input.Status = "PreJob Completed";
input.Internal_Stage = True;
}
if(input.Job_Arrival_Stage == "Completed")
{
input.Status = "Completed";
```

### Design_All_Mandatory_Fields

- Event: on edit; phases: on validate

```
Role = input.Checklist_Owner.Role;
if(input.Set_Mandatory)
{
if(Role == "Team Leader")
{
//info "test";
if(input.Are_you_clear_about_what_location_each_of_the_printed_materials_needs_to_be_installed == Null || input.Are_you_clear_on_the_scope_o
{
```

### Completed popup

- Event: on edit; phases: on update of Satge1

```
if(input.Satge1 == "Completed")
{
info "Please fill the next job checklist";
}
```

## Project_Manager_Checklist (9)

### Update the Install Task Status

- Event: on add; phases: on success; sends mail

```
rec_install = Install_Job[ID == input.Install_Task_Name];
rec_install.Stage="Completed";
job_id = rec_install.Jobs;
url = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Approved_Completed_Install_Tasks/" + input.Install_
list_balur = List();
for each  rec_install in Install_Job[Jobs == job_id]
{
//info rec_install.Stage ;
```

### Send Email - Form Properties (INACTIVE)

- Event: -; phases: on start; sends mail

### Hide Fields

- Event: on add or edit; phases: on load

```
hide Install_Task_Name;
hide Not_Needed;
```

### Update the status

- Event: on add or edit; phases: on success; CRM

```
rec_install = Install_Job[ID == input.Install_Task_Name];
rec_install.Stage="Completed";
job_id = rec_install.Jobs;
thisapp.FI_AJ_Function.Update_Completion_Percentages(job_id);
url = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Approved_Completed_Install_Tasks/" + input.Install_
list_balur = List();
for each  rec_install in Install_Job[Jobs == job_id]
{
```

### Validation of mandatory fields

- Event: on add or edit; phases: on validate

```
mandatory_value = 0;
if(input.Do_you_believe_a_management_level_review_should_be_held_on_this_job.isEmpty())
{
mandatory_value = mandatory_value + 1;
alert(Do_you_believe_a_management_level_review_should_be_held_on_this_job,"Please fill the mandatory fields");
}
if(input.Install_Rating_TL.isEmpty())
{
```

### Redirect to Jobs page (INACTIVE)

- Event: on add or edit; phases: on success

### update Rating

- Event: on edit; phases: on update of Install_Rating_TL

```
if(input.Install_Rating_TL != null)
{
ProjectManger = Employee_Database[VE_Email_Address == zoho.loginuserid];
InstallTaskDetails = Install_Job[ID == input.Install_Task_Name];
if(InstallTaskDetails.count() > 0 && ProjectManger.count() > 0)
{
EmployeeRatingDetails = Employee_Rating_Details[Project_Manager_Checklist_Lookup == input.ID && Employee_Database1_BiLookup == InstallTaskDe
if(EmployeeRatingDetails.count() == 0)
```

### Disable Fields (INACTIVE)

- Event: on edit; phases: on load

### Update the Issue which is done by Manger

- Event: on edit; phases: on update of Do_you_believe_a_management_level_review_should_be_held_on_this_job; sends mail

```
if(input.Do_you_believe_a_management_level_review_should_be_held_on_this_job == "Yes")
{
Workers = Employee_Database[VE_Email_Address == zoho.loginuserid];
InstallTask = Install_Job[ID == input.Install_Task_Name && Management_Review.isEmpty()];
if(InstallTask.count() > 0 && Workers.count() > 0)
{
manager_rec = Setup[ID != null];
get_workers = Employee_Database[ID == manager_rec.Installation_Manager1];
```

## Equipment_Register (9)

### Create Tool ID

- Event: on add; phases: on success

```
//Number = input.Auto_Number + 1;
//input.Tool_Code = "VE - " + Number;
input.Tool_Code = "VE - " + input.Auto_Number;
```

### Hide and Show Fields

- Event: on add or edit; phases: on load

```
disable Tool_Code;
hide Checklist_Details.Create_Fabrication_Task;
hide Checklist_Details.Scheduled_Date;
```

### Required Fields

- Event: on add or edit; phases: on validate

```
mandatory_value = 0;
if(input.Equipment_Name.isEmpty())
{
mandatory_value = mandatory_value + 1;
alert(Equipment_Name,"Please fill the mandatory fields");
}
if(input.Entered_By.isEmpty())
{
```

### Auto Fill Fields

- Event: on add; phases: on load

```
login_user = Employee_Database[VE_Email_Address = zoho.loginuserid];
input.Entered_By = login_user.ID;
input.Is_Active = TRUE;
```

### Update the Sub From

- Event: on add or edit

```
rec_data = Maintenance_Checklists[ID == row.Equipment_Type];
row.Checklist=rec_data.Maintenance_Checklist;
row.Zoho_Learn=rec_data.Zoho_Learn;
row.Zoho_Learn_2=rec_data.Zoho_Learn_2;
row.Proposed_Hours=rec_data.Proposed_Hours;
```

### Recurring Maintenance Task

- Event: on edit; phases: on success

```
// Fetch the previous version of the record
previous_record = Equipment_Register[ID == input.ID];
// info "previous_record :" +previous_record;
setup_fabmanager = Setup[Fabrication_Manager == input.Entered_By];
previous_items = previous_record.Checklist_Details;
// info "previous_items : "+previous_items.Maintenance_Checklist_Name;
for each  newrec in previous_items
{
```

### Create Fabrication Tasks

- Event: on add; phases: on success

```
setup_fabmanager = Setup[ID != 0];
for each  new_record in input.Checklist_Details
{
if(new_record.Create_Fabrication_Task == false)
{
// Map the fields to create a new Fabrication Task
edit_urll = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/Equipment_Register/record-edit/Equipment_Register_Report/" +
fabrication_task = insert into Fabrication_Job1
```

### Update the SubForm Value

- Event: on add or edit; phases: on add row of Checklist_Details

```
fetch_equipment = Maintenance_Checklists[Equipment_Type == input.Equipment_Type];
ls = List();
for each  sig_var in fetch_equipment
{
ls.add(sig_var);
}
row.Equipment_Type:ui.add(ls);
```

### AJ Clear

- Event: on add or edit; phases: on user input of Equipment_Type

```
input.Checklist_Details.clear();
```

## (no form) (9)

### Send Work Hours (INACTIVE)

- Event: -; phases: on start; sends mail

### Send Issues Reports (INACTIVE)

- Event: -; phases: on start; sends mail

### send_email_for_companies_document

- Event: -; phases: on start; sends mail

### send_email_for_worker_ticket

- Event: -; phases: on start; sends mail

### send_email_for_worker_induction

- Event: -; phases: on start; sends mail

### K _VE Combined Project Reports (INACTIVE)

- Event: -; phases: on start; sends mail

### K_VE_Hours_Report_Schedule

- Event: -; phases: on start; sends mail

### K_VE_Issues_Report_Schedule

- Event: -; phases: on start; sends mail

### Employee Hours

- Event: -; phases: on start

## Sites (8)

### Update Record in Zoho CRM Sites Module (INACTIVE)

- Event: on edit; phases: on success; CRM

### On Edit check

- Event: on edit; phases: on load

```
// input.Check_on_the_on_Edit = true;
// hide Check_on_the_on_Edit;
// OutcomeUrl = "https://zfrmz.com/jON09LCwS3h2l93PgHiz";
// input.Rich_Text = "<html><head><style></style></head><body><a href=" + OutcomeUrl + ">Click here to P & C Form</a> </body></html>";
```

### Update Record in Zoho CRM Sign Module

- Event: on add; phases: on load

```
// OutcomeUrl = "https://zfrmz.com/jON09LCwS3h2l93PgHiz";
// input.Rich_Text = "<html><head><style></style></head><body><a href=" + OutcomeUrl + ">Click here to P & C Form</a> </body></html>";
input.Country = "Australia";
hide Check_on_the_on_Edit;
```

### Update_Url_Signs

- Event: on add; phases: on success

```
url = Map();
url.put("value","View Record");
url.put("url","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Sites_Report/" + input.ID);
//https://creatorapp.zoho.com.au/visualexposureandcreations/projects/Jobs/record-edit/Jobs_Report/34000000486584/
edit_url = Map();
edit_url.put("value","Edit Record");
edit_url.put("url","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/Sites/record-edit/Sites_Report/" + input.ID);
data_map = Map();
```

### Hide Value

- Event: on add or edit; phases: on load

```
hide Z_CRM_site_ID;
```

### SAddress_Updates_in_InstallJob (INACTIVE)

- Event: on edit; phases: on update of Street; CRM

### Address_Field_UpdateinInstalljob

- Event: on edit; phases: on success; CRM

```
//Test=input.id;
Installjobsites = Install_Job[Sites == input.ID];
cre_data_map = Map();
cre_data_map.put("Street",input.Street);
cre_data_map.put("Suburb",input.City);
cre_data_map.put("State",input.State);
cre_data_map.put("Country",input.Post_Code);
Mappingstring = "https://www.google.com/maps/place/" + input.Street + ",+" + input.City + ",+" + input.State + ",+" + input.Post_Code + ",+"
```

### Can't Delete Locations

- Event: on delete; phases: on validate

```
alert "You can't delete Location from here. Please delete the record in CRM";
cancel delete;
```

## Employee_Database (8)

### Set Value (INACTIVE)

- Event: on edit; phases: on load

### FI B Success WF (INACTIVE)

- Event: on edit; phases: on success

### Hide Fields

- Event: on add; phases: on load

```
hide z_w_id;
hide Check_the_Edit;
```

### Hide Internal fields

- Event: on add or edit; phases: on load

```
hide z_w_id;
hide Check_the_Edit;
hide Employer;
hide Employee_Rating_Subform;
if(input.Employer_new.Company_Name == "Visual Exposure")
{
show Primary_Role_Lookup;
}
```

### FI B Success WF (INACTIVE)

- Event: on add; phases: on success

### create worker ticket

- Event: on add; phases: on success

```
compid = input.Employer_new;
compdata = Companies1[ID == compid];
compname = compdata.Company_Name;
if(compname == "Visual Exposure")
{
worktypedoc = Worker_Ticket_Types[Required_for_VE_Workers == true];
for each  var in worktypedoc
{
```

### Show and Hide Primary Roles

- Event: on add or edit; phases: on user input of Employer_new

```
if(input.Employer_new.Company_Name == "Visual Exposure")
{
show Primary_Role_Lookup;
input.Primary_Role_Lookup = null;
}
else
{
hide Primary_Role_Lookup;
```

### Validate the Primary Roles

- Event: on add or edit; phases: on validate

```
if(input.Employer_new.Company_Name == "Visual Exposure" && input.Primary_Role_Lookup == null && input.Active == "Active")
{
alert(Primary_Role_Lookup,"Kindly fill the Mandatory Field");
cancel submit;
}
```

## Project_Manager_Checklist_for_Fab (7)

### Set Hide Fields in On Load

- Event: on add or edit; phases: on load

```
hide Fabrication_Task_Name;
hide Not_Needed;
```

### Update the Fab Task on stage is Completed

- Event: on add or edit; phases: on success; sends mail; CRM

```
rec_fab = Fabrication_Job1[ID == input.Fabrication_Task_Name];
rec_fab.Stage="Completed";
job_id = rec_fab.Jobs;
thisapp.FI_AJ_Function.Update_Completion_Percentages(job_id);
// 	Calculation Start
// Fab Calculation
all_total_fab_Hours = 0;
tota_comp_fab_Hours = 0;
```

### Validation of mandatory fields

- Event: on add or edit; phases: on validate

```
mandatory_value = 0;
if(input.Do_you_believe_that_a_Management_Level_review_should_be_held_on_this_job.isEmpty())
{
mandatory_value = mandatory_value + 1;
alert(Do_you_believe_that_a_Management_Level_review_should_be_held_on_this_job,"Please fill the mandatory fields");
}
if(input.Rating_TL.isEmpty())
{
```

### K Trigger Profit Changed Email After Fab Complete

- Event: on add or edit; phases: on success

```
fabTask = Fabrication_Job1[ID == input.Fabrication_Task_Name];
if(fabTask.count() > 0)
{
if(fabTask.Stage == "Completed")
{
parentJobID = fabTask.Jobs.ID;
thisapp.K_SendProfitChangedAfterFab(parentJobID);
}
```

### Update in Issue

- Event: on add; phases: on success; sends mail

```
manager_rec = Setup[ID != null];
if(input.Do_you_believe_that_a_Management_Level_review_should_be_held_on_this_job == "Yes")
{
Workers = Employee_Database[VE_Email_Address == zoho.loginuserid];
FabricationTask = Fabrication_Job1[ID == input.Fabrication_Task_Name && Management_Review.isEmpty()];
if(FabricationTask.count() > 0 && Workers.count() > 0)
{
InsertIssue = insert into Issues
```

### update rate

- Event: on edit; phases: on update of Rating_TL

```
if(input.Rating_TL != null)
{
ProjectManger = Employee_Database[VE_Email_Address == zoho.loginuserid];
InstallTaskDetails = Fabrication_Job1[ID == input.Fabrication_Task_Name];
if(InstallTaskDetails.count() > 0 && ProjectManger.count() > 0)
{
EmployeeRatingDetails = Employee_Rating_Details[Project_Manager_Checklist_for_Fab_Lookup == input.ID && ID == InstallTaskDetails.Fab_Manager
if(EmployeeRatingDetails.count() == 0)
```

### Update the Issue by Manger

- Event: on edit; phases: on update of Do_you_believe_that_a_Management_Level_review_should_be_held_on_this_job; sends mail

```
if(input.Do_you_believe_that_a_Management_Level_review_should_be_held_on_this_job == "Yes")
{
Workers = Employee_Database[VE_Email_Address == zoho.loginuserid];
FabricationTask = Fabrication_Job1[ID == input.Fabrication_Task_Name && Management_Review.isEmpty()];
if(FabricationTask.count() > 0 && Workers.count() > 0)
{
manager_rec = Setup[ID != null];
InsertIssue = insert into Issues
```

## Signs (4)

### Update Record in Zoho CRM Sign Module

- Event: on edit; phases: on success; CRM

```
if(input.Check_on_the_on_Edit == true)
{
thisapp.Zoho_CRM.Update_sign_module(input.ID);
}
```

### Disable Fields

- Event: on add or edit; phases: on load

```
disable Sign_Number;
disable Revision_Number;
hide View_Record;
```

### update Check Email field

- Event: on edit; phases: on load

```
input.Check_on_the_on_Edit = true;
hide Check_on_the_on_Edit;
```

### Update URL

- Event: on add or edit; phases: on success

```
url = Map();
url.put("value","View Record");
url.put("url","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Signs_Report/" + input.ID);
edit_url = Map();
edit_url.put("value","Edit Record");
edit_url.put("url","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/Signs/record-edit/Signs_Report/" + input.ID);
data_map = Map();
data_map.put("View_Record",url);
```

## Project_Manager_Checklist1 (4)

### Close the Window

- Event: -; phases: on click

### Create the Record

- Event: -; phases: on click; sends mail

### Hide Value for Project Manager

- Event: on add

### Submit_Close

- Event: -; phases: on click

## Project_Manager_Checklist_Design_Task (4)

### Update the Design Task Status (INACTIVE)

- Event: on add; phases: on success; sends mail

### Send Email - Form Properties (INACTIVE)

- Event: -; phases: on start; sends mail

### On Load Hide Fields

- Event: on add or edit

### Update the Design Task Status

- Event: on add or edit; phases: on success

```
rec_install = Design_Task[ID == input.Design_Task_Name];
job_id = rec_install.Jobs;
rec_install.Stage="Completed";
thisapp.FI_AJ_Function.Update_Completion_Percentages(job_id);
url = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Approved_Completed_Design_Task_PM/" + input.Design_
list_balur = List();
for each  rec_install in Install_Job[Jobs == job_id]
{
```

## Reject_Install_Form (4)

### Hide Fields

- Event: on add

### Close the Window

- Event: -; phases: on click

### Create Install rec for Reject

- Event: -; phases: on click; sends mail

### Create_Reject-Stage_Updation (INACTIVE)

- Event: -; phases: on click

## Workers_Tickets (4)

### Hide Fields

- Event: on add or edit; phases: on load

```
hide Developer_Section;
```

### Update Edit

- Event: on add; phases: on success

```
EditURL = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/#Form:Workers_Tickets?recLinkID=" + input.ID + "&viewLinkName=
input.Edit = "<a href='" + EditURL + "'>Edit Record </a>";
```

### Refresh Page

- Event: on add or edit; phases: on success

```
input.Edit_From_URL = false;
openUrl("#Script:page.parent.back","same window");
```

### Close Dialog

- Event: on edit; phases: on load

```
if(input.Edit_From_URL == true)
{
openUrl("#Script:dialog.close","same window");
}
```

## Workers_Inductions (4)

### Hide Section

- Event: on add or edit; phases: on load

```
hide Developer_Section;
```

### Refresh Page

- Event: on add or edit; phases: on success

```
input.Edit_From_URL = false;
openUrl("#Script:page.parent.back","same window");
```

### Edit URL update

- Event: on add; phases: on success

```
EditURL = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/#Form:Workers_Inductions?recLinkID=" + input.ID + "&viewLinkNa
input.Edit = "<a href='" + EditURL + "'>Edit Record </a>";
```

### Close Dialog

- Event: on edit; phases: on load

```
if(input.Edit_From_URL == true)
{
openUrl("#Script:dialog.close","same window");
}
```

## Sign_Groups (3)

### Hide Value

- Event: on add or edit; phases: on load

```
hide Product_Item_Groups;
hide Sub_Total_AU;
hide Grand_Total_AU;
hide Total_Cost_Amount_AU;
hide Tax;
hide Profit_Margin;
```

### Update_Url_Sites

- Event: on add; phases: on success

```
url = Map();
url.put("value","View Record");
//url.put("url","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/#Form:Task?recLinkID=" + input.ID + "&viewLinkName=Task_
url.put("url","https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Task_Report/" + input.ID);
data_map = Map();
data_map.put("View_Record",url);
other_map = Map();
update = zoho.creator.updateRecord("visualexposureandcreations","projects","Task_Report",input.ID,data_map,other_map,"z_creator");
```

### Testing (INACTIVE)

- Event: on add or edit; phases: on validate

## Install_Job_Checklists (3)

### Update The Install Task Module

- Event: on add; phases: on success

```
// Install_Task_rec = Install_Job[ID == input.Install_Task_ID.toLong()];
// if(input.Team_Leader_Check == "Yes" && Check_List_Type == "Pre Job Checklist")
// {
// 	Install_Task_rec.Removed_Material_Destroy=input.Removed_Material_Destroy;
// 	Install_Task_rec.Team_Leader_Check=input.Team_Leader_Check;
// 	Install_Task_rec.Are_you_clear_on_the_scope_of_works_for_the_job=input.Are_you_clear_on_the_scope_of_works_for_the_job;
// 	Install_Task_rec.Are_you_clear_about_what_location_each_of_the_printed_materials_needs_to_be_installed=input.Are_you_clear_about_what_lo
// 	Install_Task_rec.Are_you_clear_about_where_you_can_park_in_close_proximity_to_your_work_site1=input.Are_you_clear_about_where_you_can_pa
```

### Hide and Show Fields

- Event: on add; phases: on user input of Team_Leader_Check

```
if(input.Team_Leader_Check == "Yes" && Check_List_Type == "Pre Job Checklist")
{
show Pre_Job_Check_List;
show plain;
show Are_you_clear_on_the_scope_of_works_for_the_job;
show Are_you_clear_about_what_location_each_of_the_printed_materials_needs_to_be_installed;
show Are_you_clear_about_where_you_can_park_in_close_proximity_to_your_work_site;
show Have_you_checked_the_SWMS_to_see_what_High_Risk_Activities_are_listed;
```

### On Load Fields Hide

- Event: on add; phases: on load

```
//disable Check_List_Type ;
hide Pre_Job_Check_List;
hide Job_Arrival_Check_List;
hide On_Site_Job_Completion_Check_List;
hide Job_Closure_Check_List;
```

## Design_Task_Checklists (3)

### Update The Design Task Module

- Event: on add; phases: on success

```
// Design_Task_rec = Design_Task[ID == input.Design_Task_ID.toLong()];
// if(input.Team_Leader_Check == "Yes" && Check_List_Type == "Pre Job Checklist")
// {
// 	Design_Task_rec.Removed_Material_Destroy=input.Removed_Material_Destroy;
// 	Design_Task_rec.Team_Leader_Check=input.Team_Leader_Check;
// 	Design_Task_rec.Are_you_clear_on_the_scope_of_works_for_the_job=input.Are_you_clear_on_the_scope_of_works_for_the_job;
// 	Design_Task_rec.Are_you_clear_about_what_location_each_of_the_printed_materials_needs_to_be_installed=input.Are_you_clear_about_what_loc
// 	Design_Task_rec.Are_you_clear_about_where_you_can_park_in_close_proximity_to_your_work_site=input.Are_you_clear_about_where_you_can_park
```

### Hide and Show Fields Team Leader Check

- Event: on add; phases: on user input of Team_Leader_Check

```
if(input.Team_Leader_Check == "Yes" && Check_List_Type == "Pre Job Checklist")
{
show Pre_Job_Check_List;
show plain;
show Are_you_clear_on_the_scope_of_works_for_the_job;
show Are_you_clear_about_what_location_each_of_the_printed_materials_needs_to_be_installed;
show Are_you_clear_about_where_you_can_park_in_close_proximity_to_your_work_site;
show Have_you_checked_the_SWMS_to_see_what_High_Risk_Activities_are_listed;
```

### On Load Fields Hide

- Event: on add; phases: on load

```
//disable Check_List_Type;
hide Pre_Job_Check_List;
hide Job_Arrival_Check_List;
hide On_Site_Job_Completion_Check_List;
hide Job_Closure_Check_List;
```

## Fabrication_Job_Checklists (3)

### Set Hide Fields

- Event: on add; phases: on load

```
hide Team_Leader;
hide Have_you_taken_good_photos_of_the_completed_job;
hide What_was_your_job_start_time;
hide What_was_your_on_site_finish_time;
hide Are_there_any_issues_for_this_job_that_you_need_to_inform_us_of;
hide Do_you_have_any_other_notes_on_this_job;
hide Non_Team_Leader;
hide Were_there_any_OH_S_issues_in_completing_the_job;
```

### Hide and Show Fields for Team Leader Check

- Event: on add; phases: on user input of Team_Leader_Check

```
if(Team_Leader_Check == "Yes")
{
show Team_Leader;
show Have_you_taken_good_photos_of_the_completed_job;
show What_was_your_job_start_time;
show What_was_your_on_site_finish_time;
show Are_there_any_issues_for_this_job_that_you_need_to_inform_us_of;
show Do_you_have_any_other_notes_on_this_job;
```

### Update to Fab Task Module

- Event: on add; phases: on success

```
update_rec = Fabrication_Job1[ID == input.Fabrication_Task_ID.toLong()];
update_rec.Removed_Material_Destroy1=input.Removed_Material_Destroy;
update_rec.Team_Leader_Check=input.Team_Leader_Check;
update_rec.Have_you_taken_good_photos_of_the_completed_job=input.Have_you_taken_good_photos_of_the_completed_job;
update_rec.What_was_your_job_start_time=input.What_was_your_job_start_time;
update_rec.What_was_your_on_site_finish_time=input.What_was_your_on_site_finish_time;
update_rec.Are_there_any_issues_for_this_job_that_you_need_to_inform_us_of=input.Are_there_any_issues_for_this_job_that_you_need_to_inform_u
update_rec.Do_you_have_any_other_notes_on_this_job=input.Do_you_have_any_other_notes_on_this_job;
```

## Awaiting_Submission4 (3)

### Formtrigger_Submit

- Event: -; phases: on click; sends mail

### Cancel_Actions

- Event: -; phases: on click

### Hide_Internal

- Event: on add; phases: on load

```
hide Install_Task_Name;
hide Fabrication_Job1;
hide Design_Task;
```

## Reject_Design_Tasks (3)

### Set Hide Fields

- Event: on add

### Close the Window

- Event: -; phases: on click

### Create Reject Record

- Event: -; phases: on click; sends mail

## Staff_Timesheet (3)

### K Calculate_Timesheet_Hours

- Event: on add or edit; phases: on success

```
// ================= INITIALIZE =================
singleTime = 0.0;
timeAndHalf = 0.0;
doubleTime = 0.0;
// ================= INPUT =================
startDT = input.Start_Time;
endDT = input.End_Time;
breakMins = ifnull(input.Break_Minutes,0);
```

### K disable fields

- Event: on add or edit

### K Set default date

- Event: on add; phases: on load

```
input.Work_Date = zoho.currentdate;
```

## Install_Reject_Form (2)

### Update the Install Task  Stage

- Event: on add; phases: on success; sends mail

```
rec_install = Install_Job[ID == input.Install_Task_Name];
rec_install.Stage="Rejected";
// url = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Rejected_Install_Tasks/" + input.Install_Task_Na
// sendmail
// [
// 	from :zoho.adminuserid
// 	to :"arun@fristinetech.com"
// 	subject :"Design Task is Reject - " + input.Install_Task_Name.Task_Name
```

### Hide Fields

- Event: on add or edit

## Design_Reject_Form (2)

### Update the Install Task  Stage

- Event: on add; phases: on success

```
rec_design = Design_Task[ID == input.Design_Task_Name];
rec_design.Stage="Reopen";
openUrl("#Script:page.Close ","popup window");
```

### On Load Hide Fields for Design

- Event: on add or edit

## Awaiting_Submission3 (2)

### Update the Install Task  Stage

- Event: on add; phases: on success; sends mail

```
rec_install = Install_Job[ID == input.Install_Task_Name];
Emaildetaisl = Employee_Database[ID == rec_install.Project_Manager];
// if(!isNull(Emaildetaisl.Email_Adreess))
// {
// 	// 		task_name = input.Task_Name;
// 	// 		type = "Pre Job Checklist";
// 	// 		fnail_task_name = replaceAll(task_name," ","+");
// 	// 		fnail_type = replaceAll(type," ","+");
```

### Hide_Intenal_Fields

- Event: on add; phases: on load

```
hide Install_Task_Name;
```

## Reopened_Comments (2)

### Update the Install Task  Stage

- Event: on add; phases: on success; sends mail

```
rec_install = Install_Job[ID == input.Install_Task_Name];
rec_install.Stage="Reopen";
// url = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Reopened_Install_Tasks/" + input.Install_Task_Na
// sendmail
// [
// 	from :zoho.adminuserid
// 	to :"arun@fristinetech.com"
// 	subject :"Install Task is Reject - " + input.Install_Task_Name.Task_Name
```

### Hide Fields

- Event: on add or edit

## Reopened_Comments_for_Design (2)

### Update the Install Task  Stage

- Event: on add; phases: on success; sends mail

```
rec_install = Install_Job[ID == input.Design_Task_Name];
rec_install.Stage="Reopen";
// url = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Reopened_Install_Tasks/" + input.Install_Task_Na
// sendmail
// [
// 	from :zoho.adminuserid
// 	to :"arun@fristinetech.com"
// 	subject :"Install Task is Reject - " + input.Install_Task_Name.Task_Name
```

### Hide Fields

- Event: on add or edit

## Employee_Hours (2)

### Disable All Fields

- Event: on add; phases: on load

```
disable Date_field;
disable Employee_Database;
disable Installation_Hours;
disable Installation_Unbilled_Hours;
disable Fabrication_Unbilled_Hours;
disable Fabrication_Hours;
disable Workshop_Hours;
```

### Disable Fields

- Event: on edit; phases: on load

```
disable Date_field;
disable Employee_Database;
disable Installation_Hours;
hide Installation_Unbilled_Hours;
disable Fabrication_Unbilled_Hours;
disable Fabrication_Hours;
disable Workshop_Hours;
```

## Fabrication_Reject_Form (1)

### Update the Install Task  Stage

- Event: on add; phases: on success; sends mail

```
rec_fab = Fabrication_Job1[ID == input.Fabrication_Task_Name];
rec_fab.Stage="Rejected";
rec_fab.Sub_Stage="Fabrication Started";
rec_fab_post = Fabrication_Post_Job_Checklists[Fabrication_Job1 == input.Fabrication_Task_Name];
//info rec_fab_post ;
rec_fab_post.Status="Not Completed";
// url = "https://creatorapp.zoho.com.au/visualexposureandcreations/projects/record-summary/Reopen_Fabrication_Task_Report/" + input.Fabrica
// sendmail
```

## Alert (1)

### Set Alert

- Event: on add; phases: on load

```
hide Number;
if(input.Number == 1)
{
input.plain = "<div> <b> <span class='font' style='font-family: Heuristica, sans-serif;'>You've already filled Pre-Job Checklist. Please wai
}
if(input.Number == 2)
{
input.plain = "<div><b><span class='font' style='font-family: Heuristica, sans-serif;'> The checklist has not been assigned to you.</span><s
```

## Alert_Install (1)

### Setalert

- Event: on add or edit; phases: on load

```
hide Number;
if(input.Number == 1)
{
input.plain = "<div> <b> <span class='font' style='font-family: Heuristica, sans-serif;'>You've already filled Pre-Job Checklist 1  . Please
}
if(input.Number == 2)
{
input.plain = "<div><b><span class='font' style='font-family: Heuristica, sans-serif;'> You've already filled Pre-Job Checklist 2  . Please 
```

## Alert_Install_New (1)

### Setalert

- Event: on add; phases: on load

```
hide Number;
if(input.Number == 1)
{
input.plain = "<div> <b> <span class='font' style='font-family: Heuristica, sans-serif;'>You've already filled Pre-Job Checklist 1  . Please
}
if(input.Number == 2)
{
input.plain = "<div><b><span class='font' style='font-family: Heuristica, sans-serif;'> You've already filled Pre-Job Checklist 2  . Please 
```

## Task_Template (1)

### Direct to - Form Properties

- Event: -; phases: on start

## Workshop_Locations (1)

### Direct to - Form Properties

- Event: -; phases: on start

## Chemical_Register (1)

### Show and Hide Fields

- Event: on add or edit; phases: on load

```
hide Not_Needed;
```

## Companies1 (1)

### create record in company document

- Event: on add; phases: on success

```
compid = input.ID;
// doctye = input.Company_Document_Types;
doctypedata = Copmpany_Document_Types[ID != 0];
for each  var in doctypedata
{
docdata = Copmpany_Document_Types[ID == var];
reqforcomp = docdata.This_is_required_for_new_companies;
// 	doctye = docdata.Document_Type;
```

## Setup (1)

### SK_Validate

- Event: on add; phases: on load

```
get_setup = Setup[ID != null].count(ID);
if(get_setup != 0)
{
alert "You can’t create a new setup record. Please update the existing setup record instead.";
openUrl("#Report:All_Setups","same window");
}
else
{
```

## Alert_Message (1)

### Refresh Page

- Event: -; phases: on click

## Equipment_Register_SF (1)

### Create  Recurring Fabrication Tasks

- Event: -; phases: on start

