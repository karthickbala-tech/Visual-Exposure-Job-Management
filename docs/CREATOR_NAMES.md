# Creator field names (reference)

Taken from the Creator export (`Creator file/Projects.ds`, not in the repo). Only form and field names, types and pick-list values are listed here. Use these words on screens so staff do not have to relearn them. `*` marks a required field. Format: key | name on screen | type | values.


```
## Jobs
* Job_Subject | Job Name | text
  Stage | (Stage) | picklist | "Preparation","In Progress","Completed","Completed - Closed","On Hold","Cancelled"
  Description | (Description) | textarea
  Profit_Email_Schedule_Time | Profit Email Schedule Time | datetime
  Closure_Email_Sent | Closure Email Sent | checkbox
  Job_Close_Triggered | Job Close Triggered | checkbox
  Design_Labour_Cost | Design Labour Cost | decimal
  Required_Fab_Finish_Date | Required Fab Finish Date | date
  Expected_Job_Finish | Expected Job Finish | date
  Agreed_Fab_Finish_Date | Agreed Fab Finish Date | date
  Fab_Completed | % Fab Completed | percentage
  Install_Completed | % Install  Completed | percentage
  Job_Completed | % Job Completed | percentage
  Project_Manager | Project Manager | picklist
  Fab_Manager | Fab Manager | picklist
  Folder_Location_on_Server | Workdrive Link | text
  File_Location_on_VE_Server | Folder Location on VE Server | text
  Total_Purchases | Total Purchases | decimal
  Stock_Purchases | Stock Purchases | AUD
  Design_Hours_Booked | Design Hours Booked | decimal
  Design_Labour_Cost_Parent | Design Labour Cost - Parent | decimal
  Design_Labour_Cost_Fab | Design Labour Cost - Fab | decimal
  CRM_Update_Sync | CRM Update Sync | checkbox
  Fab_Profit_Email_Sent | Fab Profit Email Sent | checkbox
  Profit_Changed | Profit Changed | checkbox
  Fab_Hours_Booked | Fab Hours Booked | decimal
  Fab_Labour_Cost_Parent | Fab Labour Cost - Parent | decimal
  Fab_Labour_Cost_Fab | Fab Labour Cost - Fab | decimal
  Fab_Labour_Cost | Fab Labour Cost | decimal
  Install_Hours_Booked | Install Hours Booked | decimal
  Install_Labour_Cost_Parent | Install Labour Cost - Parent | decimal
  Install_Labour_Cost_Fab | Install Labour Cost - Fab | decimal
  Install_Labour_Cost | Install Labour Cost | decimal
  Deal | (Deal) | picklist
  Related_Quote | Related Quote | url
  Set_Mandatory | Set Mandatory | checkbox
  Manufacturing_Owner | Manufacturing Owner | picklist
  Job_Status | Job Status | picklist | "Active","Inactive"
  Way_Sync | 2 Way Sync  | checkbox
  Close_all_Task | Close all Task | checkbox
  Owner_Email | Owner Email | email
  Job_Owner |  Job Owner | picklist
  View_Record | View Record | url
  Click_to_view_the_Deal | Folder Location on Server 1 | url
  Job_Has_Install_Tasks | Job Has Install Tasks | radiobuttons | "Yes","No"
  Job_Has_Fab_Tasks | Job Has Fab Tasks | radiobuttons | "Yes","No"
  Job_Created_Date | Job Created Date | datetime
  Edit_Record | Edit Record | url
  Job_Completed_Date | Job Completed Date  | date
```

```
## Design_Task
* Task_Name | Task Name | text
  Design_Type | Design Type | picklist | "Artwork Sign Off","Install Plan","LED Design","Manufacturing Sign Off","Proof Of Posting","Project Management"
  Task_Description | Task Description | richtext
  Project_Manager | Project Manager | picklist
  Stage |  Stage | picklist | "Not Started","In Progress","Client Review","On Hold","Completed","Cancelled","Complete - Not Used"
  Required_Finish | Required Finish | date
  Completed | (Completed) | datetime
  Quoted_Hours1 | Quoted Hours | decimal
  Booked_Hours | Booked Hours | decimal
  Labour_Cost1 | Labour Cost | decimal
  Attachments | (Attachments) | grid
  Folder_Location_on_Server | Folder Location on Server | url
  Group_Description | Group Description | textarea
  Folder_Location_ID | Folder Location ID | text
  Task_Description2 | Task Description OLD | textarea
  CRM_Quote_ID | CRM Quote ID | text
  Signs | (Signs) | list
  Jobs | (Jobs) | picklist
  Jobs_Link | Jobs Link | url
  CRM_Deal | CRM Deal | picklist
  Sign_Group | Sign Group | picklist
  Cost_Type | Cost Type | picklist | "Fab","Parent"
  Notes | Internal Task Notes | textarea
  Quoted_Hours | Quoted Hours - IA | number
  Actual_Hours_Single | Booked Hours - IA | number
  Labour_Cost | Labour Cost  - IA | number
  Team_Leader3 | Team Leader | picklist
  Team_Member | Team Member | list
  Task_Owner |  Task Owner | picklist
  Task_Assigned_to | Task Assigned to | list
  Attachment_Secondary | Attachment Second | image
  Attachment_Pdf_Document | Attachment Pdf | upload
  Attachement_Main | Attachment Main | image
  Created | (Created) | datetime
  Set_mandatory | Set mandatory | checkbox
  Visibility_Check | Visibility Check | checkbox
  Variance | (Variance) | textarea
  Edit_Record | Edit Record | url
  View_Record | View Record | url
  Task_Desc_Updated | Task Desc Updated | picklist | "Yes","No"
  customize | (customize) | 
```

```
## Fabrication_Job1
* Task_Name | Task Name | text
  Task_Description | Task Description | richtext
  Fab_Type | Fab Type | picklist | "CCV","CNC Laser","CNC Router","CLB","General","Metal","Paint","LED","Pack","Workshop","Maintenance"
  Fab_Manager | Fab Manager | picklist
  Team_Leader1 | Team Leader | picklist
  Task_Assigned_to | Team Member | list
  Scheduled_Date | Scheduled Date | date
  Quoted_Hours | Quoted Hours | decimal
  Start_Time | Start Time | time
  Proposed_Hours | Proposed Hours | decimal
  Parent_or_Sub | Parent or Sub | picklist | "Parent Task","Sub Task","Workshop"
  Parent_Fabrication_Task_ID | Parent Fabrication Task ID | picklist
  File_Name | File Name | text
  Location_of_files_on_VE_Server | Location of files on VE Server | text
  Copy_details_from_Parent_Task | Copy details from Parent Task | checkbox
  Show_Other_Details | Show Other Details | checkbox
  Group_Description | Group Description from Quote group | textarea
  Stage |  Stage | picklist | "Awaiting Scheduling","Scheduled","In Progress","Manager Review","Rejected","Reopen","On Hold","Completed","Complete - Not Used","Cancelled"
  Sub_Stage | Sub Stage | picklist | "Fabrication Started","Fabrication Done"
  Cost_Type | Cost Type | picklist | "Fab","Parent"
  Jobs | (Jobs) | picklist
  Jobs_Link | Jobs Link | url
  CRM_Deal | CRM Deal | picklist
  Signs | (Signs) | list
  Sign_Group | Sign Group | picklist
  Attachments | (Attachments) | grid
  Width_CCV | Width | text
  Height_CCV | Height | text
  Artwork_CCV | Artwork % | text
  Qty_CCV | Qty | text
  Reverse_Cut_CCV | Reverse Cut? | picklist | "Yes","No"
  Reverse_Weed_CCV | Reverse Weed? | picklist | "Yes","No"
  Vinyl_Brand_1 | Vinyl Brand #1 | text
  Vinyl_Brand_2 | Vinyl Brand #2 | text
  Vinyl_Brand_3 | Vinyl Brand #3 | text
  Vinyl_Colour_Code_1 | Vinyl Colour/Code #1 | text
  Vinyl_Colour_Code_2 | Vinyl Colour/Code #2 | text
  Vinyl_Colour_Code_3 | Vinyl Colour/Code #3 | text
  Width_CNC | Width | text
  Height_CNC | Height | text
  Artwork_CNC | Artwork % | text
  Qty_CNC | Qty | text
  Material_CNC | Material | text
  Material_Thickness_CNC | Material Thickness | text
  Intracut_Part_Female | Intracut Part - Female | radiobuttons | "Yes","No"
  Intracut_Part_Male | Intracut Part - Male | radiobuttons | "Yes","No"
  Width_CLB | Width | text
  Height_CLB | Height | text
  Artwork_CLB | Artwork % | text
  CLB_Material_CLB | CLB Return Material | text
  Return_Height | Return Height | text
  Click_to_view_the_Deal | Click to view the Deal | url
  View_Report | View Report | richtext
  Start_Date_Time | Start Date Time | datetime
  Finish_Time | Finish Time | time
  Finish_Date_Time | Finish Date Time | datetime
  Folder_Location_on_Server | Workdrive Link | url
  Folder_Location_ID | Folder Location ID | text
  Completed |  Completed  | date
  Task_Desc_Updated | Task Desc Updated | picklist | "Yes","No"
  Actual_Hours_Single1 | Actual Hours - Single | decimal
  Actual_Hours_Time_and_Half1 | Actual Hours - Time and Half | decimal
  Actual_Hours_Double1 | Actual Hours - Double | decimal
  Total_Labour_Cost1 | Total Labour Cost | decimal
  Repeat | Repeat? | checkboxes | "Yes"
  Repeat_Count | Every | number
  Repeat_Interval | Every | picklist | "Days","Weeks","Months"
  Days | (Days) | number
  CRM_Quote_ID | CRM Quote ID | text
  Maintenance_days | Maintenance days | date
  Redirect_Page | Redirect Page | text
  View_Record | View Record | url
  Edit_Record | Edit Record | url
  Job_Name | Job Name | url
  Fab_Manger_Email | Fab Manger Email | email
  Quote_Owner_email |  Quote Owner email | email
  Equipment_Register_Form | Equipment Register Edit Record | url
  Disable_the_Team_Leader_and_Member | Disable the Team Leader and Member | checkbox
  Set_Mandatory | Set Mandatory | checkbox
  Visibility_Check | Visibility Check | checkbox
  Variance | (Variance) | decimal
  Team_Leader_Check | Team Leader Check | picklist | "Yes","No"
  Management_Review | Management Review | picklist | "Needed","Completed"
  OHS_Reported | OHS Reported | picklist | "Needed","Completed"
  Task_Description2 | Task Description OLD | textarea
  Actual_Hours_Double | Actual Hours - Double - IA | number
  Actual_Hours_Single | Actual Hours - Single - IA | number
  Actual_Hours_Time_and_Half | Actual Hours - Time and Half  - IA | number
  Total_Labour_Cost | Total Labour Cost - IA | number
  Production_Date | Production Date | date
  Manufacturing_Job_Checklist | Manufacturing Job Checklist | picklist | "Manufacturing Job"
  Created | (Created) | datetime
  Notes | Internal Job Notes | textarea
  Attachment_Pdf_Document | Attachment Pdf Document | upload
  Attachement_Main | Attachment Main | image
  Attachment_Secondary | Attachment Secondary | image
  Required_Finish | Required Finish | date
  Were_there_any_OH_S_issues_in_completing_the_job | Were there any OH&S issues in completing the job? | picklist | "Yes","No"
  Non_Team_Leader | (Non Team Leader) | plaintext
  What_was_your_job_start_time1 | What was your job start time? | datetime
  Are_there_any_issues_for_this_job_that_you_need_to_inform_us_of | Are there any issues for this job that you need to inform us of? | textarea
  Do_you_have_any_other_notes_on_this_job | Do you have any other notes on this job? | textarea
  What_was_your_on_site_finish_time | What was your on site finish time? | datetime
  Removed_Material_Destroy1 | Removed Material Destroy | picklist | "Yes","No"
  Team_Leader | (Team Leader) | plaintext
  Have_you_taken_good_photos_of_the_completed_job | Have you taken good photos of the completed job? | upload
  Do_you_have_any_other_notes_on_this_job1 | Do you have any other notes on this job? | textarea
  What_was_your_finish_time | What was your finish time? | datetime
  What_was_your_job_start_time | What was your job start time? | datetime
  Equipment_Register_SF | Equipment Register SF | picklist
  customize | (customize) | 
```

```
## Install_Job
* Task_Name | Task Name | text
  Task_Description | Task Description | richtext
  File_Name | File Name | text
  Location_of_files_on_VE_Server | Location of files on VE Server | text
  Copy_details_from_Parent_Task | Copy details from Parent Task | checkbox
  Show_Other_Details | Show Other Details | checkbox
  Install_Date | Install Date | date
  VE_Start_Time | VE Start Time | text
  On_Site_Start_Time | On Site Start Time | text
  Team_Leader | Team Leader | picklist
  Other_Staff | Team Member | list
  Vehicles | Vehicle(s) | list | "Renae the Renault","Dylan the D-Max","Colin the Crew Cab","Gordon the Truck","Trevor the Travel Tower","Staff Vehicle","Other"
  Project_Manager | Project Manager | picklist
  Quoted_Hours |   Quoted Man Hours | decimal
  Proposed_Hours | Expected Job Hours | decimal
  Equipment_Off_Hire_Required | Equipment Off Hire Required? | radiobuttons | "Yes","No"
  Off_Hire_Number | Off Hire Number | text
  Install_Type | Install Type | picklist | "VE Install","External Install","Print Only","VE Subtask","Minor Task"
  Parent_Install_Task_ID | Parent Install Task ID | picklist
  Group_Description | Description from Quote Group | textarea
  CRM_Quote_ID | CRM Quote ID | text
  Signs | (Signs) | list
  Sign_Group | Sign Group | picklist
  Jobs | (Jobs) | picklist
  Jobs_Link | Jobs Link | url
  CRM_Deal | CRM Deal | picklist
  Stage |  Stage | picklist | "Awaiting Scheduling","Scheduled","In Progress","Manager Review","Rejected","Reopen","On Hold","Cancelled","Completed","Complete - Not Used"
  Sub_Stages | Sub Stages | picklist | "Team Briefed","On Site","Finished On site"
  Cost_Type | Cost Type | picklist | "Parent","Fab"
  SWMS_Status | SWMS Status | picklist | "Created","PM Signed","TL Signed","Completed","Closed","Not Required"
  Sites | Locations | picklist
  Site_Contact | Site Contact | text
  Street | (Street) | text
  Suburb | (Suburb) | text
  State |  State | text
  Country |  PostCode | text
  General_Tools |   General Tools | list | "Printed Materials","Tool Box","SAV Kit","Cleaning Kit","Haul Rope","Level","Tek Pack","Wall Mounting Pack","Socket Set","LED Repair Bag","VE Key","Electrical K
  Power_Tools | Power Tools | list | "Cordless Drill","Cordless Impact Driver","Large Hilti Impact Drill","Cordless hammer drill","Heat Gun","Generator","Circular saw","Drop saw","Jig saw","Sabre S
  Ladders |  Ladders | list | "20 foot Ladder","30 foot Ladder","36 foot Ladder","4 Step Jumbo","5 Step Jumbo","Platform Ladder - Mini - 3.5m","Platform Ladder - Small - 3.8m","Platform Ladd
  Safety_Tools | Safety Tools | list | "Hi vis vests","Harnesses","Abseil gear","Abseil rope","Tear Way Lanyards","Protective eye wear","Gloves","Ear plugs","Hard hats","Dust mask","Witches hats","T-
  Digging_Tools |  Digging Tools | list | "Wheel barrow","Shovel","Spade","Pick","Crow Bar","Star Picket Basher","Star Picket Remover","Sledge Hammer"
  Other_Tools |  Other Tools | textarea
  Access_Equipment_and_Plant |  Access Equipment and Plant | textarea
  Supplied_Materials | Supplied Materials | textarea
  For_Testing | For Testing | textarea
  Attachments | (Attachments) | grid
  Task_Description2 | Task Description OLD | textarea
  Views_in_Map |  View in Maps | url
  Edit_SWMS_Record | Edit SWMS Record | url
  Rich_Text | Rich Text | richtext
  Notes | Internal Job Notes | textarea
  Task_Desc_Updated | Task Desc Updated | picklist | "Yes","No"
  SWMS_PDF | SWMS PDF | upload
  Completed |  Completed  | date
  Created | (Created) | datetime
  Folder_Location_on_Server | Workdrive Link | url
  Folder_Location_ID | Folder Location ID | text
  Actual_Hours_Single | Booked Hours - Single | decimal
  Booked_Hours_Time_and_Half | Booked Hours - Time and Half | decimal
  Booked_Hours_Double | Booked Hours - Double | decimal
  Total_Labour_Cost1 | Total Labour Cost | decimal
  Total_Labour_Cost | Total Labour Cost - IA | number
  Actual_Hours_Double | Booked Hours - Double - IA | number
  Actual_Hours_Time_and_Half | Booked Hours - Time and Half - IA | number
  Disable_the_Team_Leader_and_Member | Disable the Team Leader and Member | checkbox
  Edit_Record | Edit Record | url
  View_Record | View Record | url
  Set_Mandatory | Set Mandatory | checkbox
  Variance | (Variance) | decimal
  Visibility_Check | Visibility Check | checkbox
  Quoteowneremail |  Quote owner email | email
  Management_Review | Management Review | picklist | "Needed","Completed"
  WHS_Reported | WHS Reported | picklist | "Needed","Completed"
  Update_Workers | Update Workers | checkbox
  customize | (customize) | 
```

```
## Sites
* Site_Name | Location Name | text
* Street | (Street) | text
* City | (City) | text
* State | (State) | picklist | "Australian Capital Territory","New South Wales","Northern Territory","Queensland","South Australia","Tasmania","Victoria","Western Australia"
* Post_Code | Post Code | text
* Country | (Country) | text
  View_in_Maps | View in Maps | url
  Site_Notes | Location Notes | textarea
  Site_Access_Notes | Location Access Notes | textarea
  Tenant_Business_Name | Tenant Business Name | text
  Tenant_Contact_Name | Tenant Contact Name | text
  Tenant_Contact_Phone | Tenant Contact Phone | phonenumber
  Tenant_Contact_Email | Tenant Contact Email | email
  Location_Owner_Name | Location Owner Name | text
  Site_Owner_Phone | Location Owner Phone | phonenumber
  Location_Owner_Email | Location Owner Email | email
  Business_Hours | Business Hours | text
  Account_Name | Account Name | picklist
  Contact_Name | Contact Name | picklist
  Deal_Name | Deal Name | picklist
  Jobs | (Jobs) | list
  View_Record | Creator View Record | url
  Crm_View_Record |  Crm View Record | url
  Edit_Record | Edit Record | url
  Check_on_the_on_Edit | Check on the on Edit | checkbox
  Z_CRM_site_ID | Z CRM site ID | text
  Site_Code | Site Code | text
```

```
## Signs
* Sign_Name | Sign Name | text
  Contact_Name | Contact Name | picklist
  Jobs | (Jobs) | picklist
  Task | (Task) | picklist
  Revision_Number | Version Number | text
  Sign_Number | Sign Number | text
  Account_Name | Account Name | picklist
  Document_Created_Date | Document Created Date | date
  Site_Map | Site Map | upload
  Sign_Deal_Stage | Sign - Deal Stage | picklist | "Early Design","Client Review","Needs Changes","Approved"
  Original_Picture | Original Picture | image
  Location_of_files_on_Server | Location of files on Server | text
  Deal_Stage_Feedback | Deal Stage Feedback | textarea
  Install_Medium_Wall_Types | Install Medium/Wall Types | textarea
  Wall_Install_Area_Size | Wall/Install Area Size | textarea
  Sign_Location_Notes | Sign Location Notes | textarea
  Check_on_the_on_Edit | Check on the on Edit | checkbox
  Sign_Artwork_Stage | Sign - Artwork Stage | picklist | "Not a job yet","Design Stage","Client Review","Needs Changes","Client Approved","Manual Approval"
  Artwork_Sign_Size | Artwork/Sign Size | textarea
  Qty | (Qty) | text
  Sign_Medium_Used | Sign Medium Used | textarea
  Finishing_Details | Finishing Details | textarea
  Colours_to_Match | Colours to Match | textarea
  Artwork_File | Artwork File | upload
  Mock_Up | Mock Up | upload
  Mock_Up_Notes | Mock Up Notes | textarea
  Internal_Art_Notes | Internal Art Notes | textarea
  Client_Artwork_Feedback | Client Artwork Feedback | textarea
  Sign_PDF_Document | Sign PDF Document | upload
  To_be_quoted | To be quoted | picklist | "Yes","No","Completed"
  Sign_Manufacturing_Stage | Sign - Manufacturing Stage | picklist | "Not required","RFQ","Quoted","Approved","In Production","QC","Completed"
  Complex_Fab_Job | Complex Fab Job | picklist | "Yes","No","Unsure","N/A"
  RFQ_Install_Details | RFQ Install Details | textarea
  RFQ_Materials | RFQ Materials | textarea
  RFQ_Sign_Fixing_Details | RFQ Sign Fixing Details | textarea
  RFQ_Viewing_Distance | RFQ Viewing Distance | picklist | "Close","1m","5m","10m","25m","50m or more"
  Quote_Required_Date | Quote Required Date | datetime
  Est_date_sign_required | Est. date sign required | datetime
  Manufacturing_Req_Date | Manufacturing Req Date | datetime
  Notes_Internal_Artwork | Notes - Internal - Artwork | textarea
  Asset_Pdf | Asset Pdf | upload
  Fabrication_Pic | Fabrication Pic | upload
  RFQ_Budget_Expectations | RFQ Budget Expectations | picklist | "Very High","High","Medium","Low"
  Install_Stage | Install Stage | picklist | "Pre Install planning","Ready for Scheduling","Scheduled","Installed - POP not sent","Installed - POP sent","Completed"
  Proposed_Install_Date | Proposed Install Date | date
  Install_Notes_for_Client | Install Notes for Client | textarea
  Install_Notes_for_Installer | Install Notes for Installer | textarea
  View_Record | View Record | url
  Edit_Record | Edit Record | url
  Actual_Install_Date | Actual Install Date | datetime
  Finished_Pic | Finished Pic | upload
  Notes_for_the_Client_POP | Notes for the Client POP | textarea
  CRM_View_Record | CRM View Record | url
  Z_CRM_sign_ID | Z CRM sign ID | text
```

```
## Sign_Groups
* Item_Group_Name | Sign Group Name | text
  Jobs | (Jobs) | picklist
  Sites | (Sites) | picklist
  Description | (Description) | textarea
  View_Record | View Record | url
  Product_Item_Groups | Product Item Groups | grid
  Sub_Total_AU | Sub Total (AU$) | AUD
  Total_Cost_Amount_AU | Total Cost Amount (AU$) | AUD
  Profit_Margin | Profit Margin (%) | percentage
  Tax | (Tax) | AUD
  Grand_Total_AU | Grand Total (AU$) | AUD
```

```
## Issues
* Reported_By | Reported By | picklist
  Date_field | Date | date
* Issue_Subject | Issue Subject | text
* Detailed_Description | Detailed Description | textarea
  Location | (Location) | text
  plain | (plain) | plaintext
  Status | (Status) | picklist | "To Be discussed","To Be Quoted","Quoted","Quote Sent","In Progress","On Hold","Completed"
  Date_Completed | Date Completed | date
  Assigned_to | Assigned to | picklist
* Department | (Department) | radiobuttons | "Install","Civic Billboards","Workshop","Management","VT/Digital Screens"
* Priority | (Priority) | radiobuttons | "High","Medium","Low"
  Sites | Locations | picklist
  Direction | (Direction) | picklist | "Inbound","Outbound","Middle Panel"
  Images1 | Images | image
  Next_Steps_Notes | Next Steps/Notes | textarea
  Person_Responsible | Person Responsible | picklist
  Due_Date | Due Date | date
  Completion_Notes | Completion Notes | textarea
  Reported_Email | Reported Email | email
  Edit_in_Management | Edit in Management | checkbox
  Deal_URL | Deal URL | url
  Deal_ID | Deal ID | number
  Update_Details | Update Details | richtext
  Fabrication_Job1_Lookup | Fabrication Task | picklist
  Manager_Email | Manager Email | email
  Inform_Also_1 | Inform Also 1 | email
  Inform_Also_2 | Inform Also 2 | email
  Install_Review_For | Install Review For | picklist | "Management Review","WHS Reported"
  Fabrication_Review_For | Fabrication Review For | picklist | "Management Review","OH&S Reported"
  Install_Job_Lookup | Install Task | picklist
  Issue_Management_History_Subform | Issue Management History | grid
```

```
## Employee_Hours
  Date_field | Date | date
* Employee_Database | Workers | picklist
  Installation_Hours | Install Hours | decimal
  Workshop_Hours | Workshop Hours | decimal
  Fabrication_Hours | Fab Hours | decimal
  Total_Hours | Total Work Hours | decimal
  Installation_Unbilled_Hours | Install Unbilled Hours | decimal
  Fabrication_Unbilled_Hours | Fab Unbilled Hours | decimal
  Unbilled_Hours | Total Unbilled Hours | decimal
  Final_Hours | Total Billed Hours | decimal
```

```
## Equipment_Register
  Is_Active | Is Active | checkbox
  Equipment_Name | Equipment Name | text
  Equipment_Type | Equipment Type | picklist
  Workshop_Locations | Workshop Locations | picklist
  Image | (Image) | image
  Auto_Number | Auto Number | autonumber
  Tool_Code | Tool Code | text
  Model | (Model) | text
  Serial_Number | Serial Number | text
  Tool_Notes | Tool Notes | textarea
  Entered_By | Entered By | picklist
  Purchase_Date | Purchase Date | date
  Warranty_Expiry_Date | Warranty Expiry Date | date
  Checklist_Details | Checklist Details | grid
```

```
## Chemical_Register
  Name_Of_Chemical | Name Of Chemical | text
  Location | (Location) | picklist | "Paint Prep Area","SAV Room","Metal Fab Area","Letter Fab Mezanine","Kitchen","Upstairs Offices","Install Consumables Area","Production Office","All Dept's","CN
  MSDS | (MSDS) | upload
  Issue_Date_of_SDS | Issue Date of SDS | date
  Max_Stock_Holding | Max Stock Holding | text
  Flammable_Code | Flammable Code | text
  Storage | (Storage) | textarea
  Handling | (Handling) | textarea
  General_Details | General Details | textarea
  Current_Qty_in_Stock | Current Qty in Stock | text
  Product_Code | Product Code | text
  MSDS_Location | MSDS Location | url
  Hazchem_Code | Hazchem Code | text
  Dangerous_Good_Clasification | Dangerous Good Clasification | text
  U_N_Number | U.N. Number | text
  Hazard_Clasification | Hazard Clasification | text
  Poison_Clasification | Poison Clasification | text
  Emergency_Response_Guide_No | Emergency Response Guide No. | textarea
```

```
## Companies1
* Company_Name | Company Name | text
* Active_Company | Active Company? | radiobuttons | "Active","Not Active"
* Owner_Name | Owner Name | name
* Company_Type | Company Type | picklist | "Local - Installer","Local - Fabricator","Local - Supplier","Interstate - Installer","Interstate - Full Service"
* Phone_Number | Phone | phonenumber
* Email | (Email) | email
* Skills_of_company_Notes | Skills of company / Notes | textarea
  Street_Address | Street Address | text
  Suburb | (Suburb) | text
* State | (State) | picklist | "VIC","NSW","QLD","SA","WA","TAS","ACT","NT"
  Post_Code | Post Code | text
* Weekday_Business_Hours | Weekday - Business Hours | AUD
  Weekday_AH_Hours | Weekday - AH Hours | AUD
  Billing_Notes | Billing Notes | textarea
  Saturday_Daytime_Rate | Saturday - Daytime Rate | AUD
  Saturday_Night_time_Rate | Saturday - Night time Rate | AUD
  Sunday_Daytime_Rate | Sunday - Daytime Rate | AUD
  Sunday_Night_time_Rate | Sunday - Night time Rate | AUD
  Public_Holiday_Rate | Public Holiday Rate | AUD
```

```
## Company_Documents
* Companies | Add New | picklist
* Document_Types | Add New | picklist
  Document_Name | (Document Name) | text
  Issue_Date | Issue Date | date
  Expiry_Date | (Expiry Date) | date
  Company_Document_Attachments | Expiry Date | grid
  Do_not_contact_Manager_about_this | Do not contact Manager about this | checkbox
  Do_not_contact_company_about_this | Do not contact company about this | checkbox
```

```
## Copmpany_Document_Types
* Document_Type | Document Type | text
* Number_of_years_before_expiry | Number of years before expiry | decimal
  Description | (Description) | textarea
  Document_template | Document template | upload
  This_is_required_for_new_companies | This is required for new companies | checkbox
```

```
## Devices
* Serial_Number | Serial Number | text
  Device_Id | Device Id | text
  OS_Version | OS Version | text
  Device_Type | Device Type | text
  Owned_By | Owned By | text
  Product_Name | Product Name | text
  Device_Name | Device Name | text
  Platform_Type | Platform Type | text
  Wifi_Mac | Wifi Mac | text
  Model | (Model) | text
  Customer_Name | Customer Name | text
  Customer_ID | Customer ID | text
  UDID | (UDID) | text
  Device_Capacity | Device Capacity | text
  User_Email | User Email | email
  User_ID | User ID | text
  User_Name | User Name | text
  Worker_Name | Worker Name | picklist
  Address | latitude | address
```

```
## SWMS
  Work_Manager | Work Manager | picklist
  Date_field1 | Date | date
  Contact_email_Manager | Contact email (Manager) | email
  Signature1 | Signature | signature
  Mobile | Contact Phone (Manager) | phonenumber
  Name | Person for ensuring compliance (Team Leader) | picklist
  Team_Leader_Name1 | Team Leader Name | text
  Team_Leader_Email | Team Leader Email | email
  Date_field2 | Date | date
  Team_Leader_Phone | Team Leader Phone | phonenumber
  Signature_Team_Leader_Acceptance_at_Job_Briefing | Signature (Team Leader Acceptance at Job Briefing) | signature
  plain | (plain) | plaintext
  Subform | Declaration | grid
* Company | Direct Employer (PCBU) | text
* Direct_Employers_Company_Name | Direct Employers Company Name | text
  Principal_Contractor_If_not_Visual_Exposure | Principal Contractor (If not Visual Exposure) | text
  Address | latitude | address
  SWMS_Status | SWMS Status | picklist | "Created","PM Signed","TL Signed","Completed","Closed","Not Required"
* Contact_Email_PCBU | Contact email (PCBU) | email
  Contact_email_Company | Contact email (Company) | email
  Contact_Email_PC | Contact Email (PC) | email
  SWMS_Number | SWMS Number | text
  SWMS_Type | SWMS Type | picklist | "Install Task","Fabrication Task"
  Install_Task_Details | Install Task Details | picklist
  Install_Sub_Task_Details | Install Sub Task Details | list
  Fabrication_Task_Details | Fabrication Task Details | picklist
  Contact_Phone_PCBU | Contact Phone (PCBU) | phonenumber
  Contact_Phone_Company | Contact Phone (Company) | phonenumber
  Contact_Phone_PC | Contact Phone (PC) | phonenumber
  Project_Details | Project Details | picklist
  Project_Description | Work Activity | textarea
  Auto_Number | Auto Number | autonumber
  There_is_a_risk_of_a_person_falling_more_than_2m | There is a risk of a person falling more than 2m | checkbox
  There_is_movement_of_powered_mobile_plant | There is movement of powered mobile plant  (EWP, Cranes, Excavators, etc) | checkbox
  Work_is_on_or_near_energised_electrical_installations_or_services | Work is on or near energised electrical installations or services (Power lines) | checkbox
  Hot_works | Hot works | checkbox
  Work_is_on_or_adjacent_to_roadways_or_railways_used_by_road_or_rail_traffic | Work is on or adjacent to roadways or railways used by road or rail traffic | checkbox
  Dust_producing_activities | Dust producing activities | checkbox
  Work_on_telecommunication_towers | Work near telecommunication towers | checkbox
  Excavation_of_a_hole_or_trench_using_mechanic | Excavation of a hole or trench using mechanical equipment (Underground Assets) | checkbox
  Work_involves_a_trench_or_shaft_if_the_excavated_depth_is_more_than_1_5m | Work involves a trench or shaft if the excavated depth is more than 1.5m | checkbox
  Work_is_in_over_or_adjacent_to_water_or_other_liquids_where_there_is_a_risk_of_drowning | Work is in, over or adjacent to water or other liquids where there is a risk of drowning | checkbox
  Work_involves_removal_or_likely_disturbance_of_asbestos | Work involves removal or likely disturbance of asbestos  (Note: preparation of an asbestos control plan is taken to be  preparation of a SWMS) | checkbox
  Use_Storage_Disposal_of_Hazardous_Substances_and_Dangerous_Goods | Use/Storage/Disposal of Hazardous Substances and  Dangerous Goods | checkbox
  Work_is_in_an_area_where_there_are_artificial_extremes_of_temperature | Work is in an area where there are artificial extremes  of temperature | checkbox
  Work_is_on_or_near_pressurised_gas_distribution_mains_or_piping | Work is on or near pressurised gas distribution mains  or piping | checkbox
  Work_is_in_an_area_that_may_have_a_contaminated_or_flammable_atmosphere | Work is in an area that may have a contaminated or flammable atmosphere | checkbox
  Work_involving_demolition | Work involving demolition | checkbox
  Work_involving_a_tunnel | Work involving a tunnel | checkbox
  Work_involves_a_confined_space | Work involves a confined space | checkbox
  There_are_structural_alterations_that_require_temporary_support_to_prevent_collapse | There are structural alterations that require temporary support to prevent collapse | checkbox
  Work_is_on_or_near_chemical_fuel_or_refrigerant_lines | Work is on or near chemical, fuel or refrigerant lines | checkbox
  Work_involves_tilt_up_or_precast_concrete | Work involves tilt-up or precast concrete  | checkbox
  Hi_Visibility_Clothing | Hi Visibility Clothing | checkbox
  Safety_Boots | Safety Boots | checkbox
  Hand_Protection | Hand Protection | checkbox
  Hearing_Protection | Hearing Protection | checkbox
  Safety_Glasses | Safety Glasses | checkbox
  Full_Face_Shield | Full Face Shield | checkbox
  Face_Mask | Face Mask | checkbox
  Breathing_Apparatus | Breathing Apparatus | checkbox
  Hard_hat | Hard Hat | checkbox
  Sun_Protection | Sun Protection | checkbox
  Fall_Arrest_Harness | Fall Arrest Harness | checkbox
  task | Job Tasks and Control Measures | grid
  SWMS_PDF | SWMS PDF | upload
  Edit_Record | Edit Record | url
  View_Record | View Record | url
  Signature1_Image | Signature1 Image | image
  Redirection_URL | Redirection URL | picklist | "Install Task"
  editswms | (editswms) | checkbox
  pmdashboard | (pmdashboard) | checkbox
  installdashboard | (installdashboard) | checkbox
  allinstalltask | (allinstalltask) | checkbox
  Edit_from_URL | Edit from URL | checkbox
```

```
## Staff_Timesheet
  Work_Date | Work Date | date
  Start_Time | Start Time | datetime
  End_Time | End Time | datetime
  Break_Minutes | Break Minutes | number
  Single_Time_hrs | Single Time (hrs) | decimal
  Time_Half_hrs | Time & Half (hrs) | decimal
  Double_Time_hrs | Double Time (hrs) | decimal
  Total_Hours | Total Hours | decimal
```
