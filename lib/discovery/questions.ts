// Auto-generated from the report-writer discovery_form.html prototype.
// DO NOT derive question identity from array position — "id" is the stable,
// permanent identifier every discovery_responses / discovery_findings row is
// keyed on. Reordering, rewording, or adding questions is always safe;
// removing a question orphans any stored answers under its old id (leave the
// id reserved rather than reusing it for something else).

export type QuestionOption = string;

export type DiscoveryQuestion = {
  id: string;
  text: string;
  options?: QuestionOption[];
  mode?: "single" | "multi";
  extra?: string;
};

export type DiscoveryTopic = {
  topic: string;
  questions: DiscoveryQuestion[];
};

export type DiscoverySection = {
  section: string;
  topics: DiscoveryTopic[];
};

export const DISCOVERY_SECTIONS: DiscoverySection[] = [
  {
    section: "Overview & Systems",
    topics: [
      {
        topic: "Systems & Vendor Experience",
        questions: [
          { id: "overview-and-systems--systems-and-vendor-experience--1", text: "Do your vendors provide adequate levels of support and training that meet your business needs?", options: ["Yes","No","Partially","Other"], mode: "single" },
          { id: "overview-and-systems--systems-and-vendor-experience--2", text: "How quickly are issues resolved, and are you happy with your vendors' current levels of service?", options: ["Very satisfied","Somewhat satisfied","Not satisfied","Other"], mode: "single" },
          { id: "overview-and-systems--systems-and-vendor-experience--3", text: "In your opinion, do your systems remain fit for purpose and adequately manage and automate at least 90% of your requirements, or has your business outgrown the current platform?", options: ["Fit for purpose","Outgrown in some areas","Outgrown significantly","Other"], mode: "single" },
          { id: "overview-and-systems--systems-and-vendor-experience--4", text: "How often is the payroll system configuration reviewed to ensure ongoing compliance? For example, how often are pay codes reviewed to ensure superannuation, STP2 reporting, leave and tax remain accurate?", options: ["Never","Ad hoc / as needed","Regularly scheduled","Other"], mode: "single" },
          { id: "overview-and-systems--systems-and-vendor-experience--5", text: "How often are leave balances reviewed to ensure accurate accruals and payment of leave entitlements?", options: ["Never","Ad hoc / as needed","Regularly scheduled","Other"], mode: "single" },
          { id: "overview-and-systems--systems-and-vendor-experience--6", text: "Do your systems allow for robust reporting capabilities to analyse payroll information and trends, and to support compliance reviews?", options: ["Yes","No","Partially","Other"], mode: "single" },
          { id: "overview-and-systems--systems-and-vendor-experience--7", text: "Which system would be seen as the source of truth?" },
          { id: "overview-and-systems--systems-and-vendor-experience--8", text: "Are the systems integrated?", options: ["Fully integrated","Partially integrated","Not integrated","Other"], mode: "single", extra: "If not fully integrated, what data needs to be double-handled?" },
          { id: "overview-and-systems--systems-and-vendor-experience--9", text: "Are any third-party programs used to interpret payroll data outside the payroll system for reporting purposes (e.g. Power BI, finance tools)?", options: ["Yes","No","Other"], mode: "single" },
          { id: "overview-and-systems--systems-and-vendor-experience--10", text: "What are the current system challenges and pain points with the current process?" },
        ],
      },
    ],
  },
  {
    section: "Payroll Processes & Policies",
    topics: [
      {
        topic: "Payroll Calendar & Processing",
        questions: [
          { id: "payroll-processes-and-policies--payroll-calendar-and-processing--1", text: "Are there payroll cut-off dates for each pay period?", options: ["Yes","No","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--payroll-calendar-and-processing--2", text: "Is there a payroll calendar detailing key dates for the payroll process?", options: ["Yes","No","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--payroll-calendar-and-processing--3", text: "Is late data accepted and processed after the cut-off date?", options: ["Yes","No","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--payroll-calendar-and-processing--4", text: "How often are \"out of cycle\" payments made?", options: ["Rarely / never","Occasionally","Frequently","Other"], mode: "single", extra: "In what circumstances?" },
          { id: "payroll-processes-and-policies--payroll-calendar-and-processing--5", text: "Are workflows in place to automatically notify the payroll team of actions to be undertaken (salary changes, one-off payments, new starters, terminations)?", options: ["Fully automated","Partially automated","Fully manual","Other"], mode: "single", extra: "If not automated, how are these communicated to payroll?" },
          { id: "payroll-processes-and-policies--payroll-calendar-and-processing--6", text: "Are the payroll processes the same across each entity and country (if multiple payrolls are run)?", options: ["Yes, consistent","No, they vary","Not applicable — single entity/country","Other"], mode: "single", extra: "If they vary, what are the key differences?" },
          { id: "payroll-processes-and-policies--payroll-calendar-and-processing--7", text: "Is any part of the payroll process outsourced?", options: ["Yes","No","Other"], mode: "single" },
        ],
      },
      {
        topic: "Onboarding (HR Team)",
        questions: [
          { id: "payroll-processes-and-policies--onboarding-hr-team--1", text: "On average, how many new starters occur in a pay period? Are there specific recruitment intake periods (e.g. traineeships, apprenticeships, graduate programs)?" },
          { id: "payroll-processes-and-policies--onboarding-hr-team--2", text: "How is the payroll team notified of a new starter?", options: ["Automated system notification","Email","Manual form / paperwork","Verbal / informal","Other"], mode: "multi" },
          { id: "payroll-processes-and-policies--onboarding-hr-team--3", text: "What documentation is provided to payroll?", options: ["Offer letter / contract","Tax file declaration","Super choice form","Bank details form","Fair Work Information Statement","Other"], mode: "multi" },
          { id: "payroll-processes-and-policies--onboarding-hr-team--4", text: "Who inputs employee and remuneration data into the payroll system?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "payroll-processes-and-policies--onboarding-hr-team--5", text: "Is this checked by a secondary person?", options: ["Yes","No","Other"], mode: "single", extra: "If so, what checks are performed, and by whom/which department?" },
          { id: "payroll-processes-and-policies--onboarding-hr-team--6", text: "Are employees provided with the Fair Work Information Statement (and, for casuals, the Casual Employment Information Statement) when they commence employment?", options: ["Yes","No","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--onboarding-hr-team--7", text: "Are employees provided a copy of the relevant award or EA when they start, and is training provided on award conditions and entitlements?", options: ["Yes","No","Partially","Other"], mode: "single", extra: "If not, how does the business ensure employees are aware of their employment conditions or where to look them up?" },
          { id: "payroll-processes-and-policies--onboarding-hr-team--8", text: "Are new starter checklists in place to compare remuneration in the offer letter to the amount entered into the payroll system, confirm employee location, super % and any salary sacrifice agreements?", options: ["Yes","No","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--onboarding-hr-team--9", text: "Can employees enter their own personal information as part of onboarding (e.g. bank details, super details, personal information)?", options: ["Yes","No","Partially","Other"], mode: "single", extra: "If so, what can they enter?" },
          { id: "payroll-processes-and-policies--onboarding-hr-team--10", text: "Is any onboarding information double-handled or manually entered into multiple systems?", options: ["Yes","No","Other"], mode: "single", extra: "If yes, what information, and why does it need to be double-handled?" },
          { id: "payroll-processes-and-policies--onboarding-hr-team--11", text: "If timeclocks are used, how is the employee set up on the clocking device?", options: ["Interfaced automatically","Manually set up","Not applicable — no timeclocks","Other"], mode: "single" },
        ],
      },
      {
        topic: "Terminations (HR Team)",
        questions: [
          { id: "payroll-processes-and-policies--terminations-hr-team--1", text: "How is the payroll team notified of an employee termination?", options: ["Automated system notification","Email","Manual form / paperwork","Verbal / informal","Other"], mode: "multi" },
          { id: "payroll-processes-and-policies--terminations-hr-team--2", text: "What information is provided to payroll to complete a termination or redundancy payment?" },
          { id: "payroll-processes-and-policies--terminations-hr-team--3", text: "When are termination payments made?", options: ["Within the normal pay cycle","Processed separately / out of cycle","Depends on circumstances","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--terminations-hr-team--4", text: "If payroll uses autopay, what controls ensure a terminated employee isn't missed and continues to be paid?" },
          { id: "payroll-processes-and-policies--terminations-hr-team--5", text: "Are final termination payments checked and verified outside of the payroll operation?", options: ["Yes","No","Other"], mode: "single", extra: "If so, by whom?" },
        ],
      },
      {
        topic: "Policies & Procedures (HR Team)",
        questions: [
          { id: "payroll-processes-and-policies--policies-and-procedures-hr-team--1", text: "How often are policies and procedures reviewed and updated?", options: ["Never","Ad hoc / as needed","Regularly scheduled","Other"], mode: "single", extra: "Who performs the reviews?" },
          { id: "payroll-processes-and-policies--policies-and-procedures-hr-team--2", text: "How are new policies implemented and communicated to the payroll team (e.g. a new leave type)?" },
          { id: "payroll-processes-and-policies--policies-and-procedures-hr-team--3", text: "Is there a disaster recovery or payroll continuance procedure in place?", options: ["Yes","No","Other"], mode: "single", extra: "Please share it if not already provided." },
        ],
      },
      {
        topic: "Scheduling & Timekeeping",
        questions: [
          { id: "payroll-processes-and-policies--scheduling-and-timekeeping--1", text: "How are rosters published for employees?", options: ["T&A system","Posted in the workplace","Both","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--scheduling-and-timekeeping--2", text: "How are employees' contracted or agreed ordinary hours managed (where the industrial instrument requires this)?" },
          { id: "payroll-processes-and-policies--scheduling-and-timekeeping--3", text: "How do employees complete their timesheets?", options: ["Clock in/off (system)","Manual timesheets","Combination","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--scheduling-and-timekeeping--4", text: "Who is responsible for approving timesheets?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "payroll-processes-and-policies--scheduling-and-timekeeping--5", text: "Are timesheets currently interpreted by a system?", options: ["Yes","No","Other"], mode: "single", extra: "If so, which system is used?" },
          { id: "payroll-processes-and-policies--scheduling-and-timekeeping--6", text: "If using T&A software with award interpretation, are there regular checks of timesheet results during the payroll process?", options: ["Yes","No","Partially","Other"], mode: "single" },
        ],
      },
      {
        topic: "Masterfile / Employee Changes",
        questions: [
          { id: "payroll-processes-and-policies--masterfile-employee-changes--1", text: "How is the payroll team notified of a payroll-relevant change (e.g. pay increase, change in status or hours)?", options: ["Automated system notification","Email","Manual form / paperwork","Verbal / informal","Other"], mode: "multi" },
          { id: "payroll-processes-and-policies--masterfile-employee-changes--2", text: "Who is responsible for making these changes in the payroll system?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "payroll-processes-and-policies--masterfile-employee-changes--3", text: "Are changes checked by anyone else?", options: ["Yes","No","Other"], mode: "single", extra: "If so, by whom?" },
          { id: "payroll-processes-and-policies--masterfile-employee-changes--4", text: "How do employees update their own details (e.g. change of bank details, personal super contributions, address)?", options: ["Self-service (ESS)","Request to HR/payroll","Both, depending on the field","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--masterfile-employee-changes--5", text: "Where a bank detail change is made via an ESS portal, are any additional verifications performed to validate the change?", options: ["Yes","No","Other"], mode: "single" },
        ],
      },
      {
        topic: "Leave",
        questions: [
          { id: "payroll-processes-and-policies--leave--1", text: "Is leave requested via an automated employee self-service (ESS) tool?", options: ["Yes","No","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--leave--2", text: "Who approves employees' leave requests?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "payroll-processes-and-policies--leave--3", text: "Are leave requests processed manually or via automatic interface to payroll?", options: ["Fully automated","Partially automated","Fully manual","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--leave--4", text: "Are any manual steps required in the leave management process (e.g. applying for, approving, submitting or processing leave)?", options: ["Yes","No","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--leave--5", text: "Can employees go into negative leave balances?", options: ["Yes","No","Other"], mode: "single" },
        ],
      },
      {
        topic: "Manual (Off-System) Processes",
        questions: [
          { id: "payroll-processes-and-policies--manual-off-system-processes--1", text: "Are any manual calculations undertaken by the payroll team as part of the payroll process?", options: ["Yes","No","Other"], mode: "single", extra: "If so, please describe them and explain why they're manual." },
          { id: "payroll-processes-and-policies--manual-off-system-processes--2", text: "Are any of the following calculated manually?", options: ["Back pays","Redundancies","Long service leave","None of these","Other"], mode: "multi" },
          { id: "payroll-processes-and-policies--manual-off-system-processes--3", text: "Are there manual or repetitive calculations that could be automated within the payroll software or with a standard template (e.g. termination payments, bulk allowance/deduction uploads)?", options: ["Yes","No","Other"], mode: "single" },
          { id: "payroll-processes-and-policies--manual-off-system-processes--4", text: "What activities take the most time, and could they be improved with automation or optimisation?" },
        ],
      },
      {
        topic: "General Feedback",
        questions: [
          { id: "payroll-processes-and-policies--general-feedback--1", text: "What are the biggest challenges within the current payroll operation that, if improved or changed, would make your work better?" },
          { id: "payroll-processes-and-policies--general-feedback--2", text: "Are there any other areas or challenges you'd like to highlight?" },
        ],
      },
    ],
  },
  {
    section: "Governance & Controls",
    topics: [
      {
        topic: "Interpretation of Industrial Instruments",
        questions: [
          { id: "governance-and-controls--interpretation-of-industrial-instruments--1", text: "Who has responsibility for ensuring compliance with awards, agreements or employment contracts?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "governance-and-controls--interpretation-of-industrial-instruments--2", text: "Who is responsible for ensuring pay rates and allowances are correct and kept up to date?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "governance-and-controls--interpretation-of-industrial-instruments--3", text: "Is there a check on this from a secondary person outside of payroll?", options: ["Yes","No","Other"], mode: "single" },
          { id: "governance-and-controls--interpretation-of-industrial-instruments--4", text: "Who sets up and maintains the award interpretation within the time and attendance system, and how often is it reviewed against the industrial instruments?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi", extra: "How often is it reviewed?" },
          { id: "governance-and-controls--interpretation-of-industrial-instruments--5", text: "Are pay results from the T&A system reviewed in detail to ensure hours and payments are consistent with the industrial instruments?", options: ["Yes","No","Partially","Other"], mode: "single" },
          { id: "governance-and-controls--interpretation-of-industrial-instruments--6", text: "If there are changes to the awards or industrial instruments, how are you notified of these changes?" },
        ],
      },
      {
        topic: "Payroll Checking Process",
        questions: [
          { id: "governance-and-controls--payroll-checking-process--1", text: "What reports are prepared and checked during payroll processing?", options: ["Exception report","Variance report","Payroll register/details report","None currently","Other"], mode: "multi" },
          { id: "governance-and-controls--payroll-checking-process--2", text: "Are these reports reviewed and verified by a secondary person?", options: ["Yes","No","Other"], mode: "single", extra: "If so, by whom?" },
          { id: "governance-and-controls--payroll-checking-process--3", text: "How long does each payroll process take?" },
        ],
      },
      {
        topic: "Payroll Errors",
        questions: [
          { id: "governance-and-controls--payroll-errors--1", text: "How many payroll queries or errors typically arise in an average pay process?" },
          { id: "governance-and-controls--payroll-errors--2", text: "What are some of the most common errors within payroll?" },
          { id: "governance-and-controls--payroll-errors--3", text: "What business practices are followed when a common error is found?" },
          { id: "governance-and-controls--payroll-errors--4", text: "How are pay queries managed and tracked?", options: ["Email inbox","Issues register / ticketing system","Informal / not tracked","Other"], mode: "single" },
        ],
      },
      {
        topic: "Segregation of Duties",
        questions: [
          { id: "governance-and-controls--segregation-of-duties--1", text: "Is there a segregation-of-duties matrix (or similar document) that clearly defines roles and responsibilities within the payroll operation?", options: ["Yes","No","Other"], mode: "single" },
          { id: "governance-and-controls--segregation-of-duties--2", text: "Does the payroll team have access to update, change or amend employee data within the payroll system, including adding new employees?", options: ["Yes","No","Partially","Other"], mode: "single", extra: "If so, what data can payroll amend (e.g. bank details, salary and benefits information)?" },
          { id: "governance-and-controls--segregation-of-duties--3", text: "Who undertakes the processing of payroll?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "governance-and-controls--segregation-of-duties--4", text: "Does the payroll software maintain an audit log of all changes made (by which user and when)?", options: ["Yes","No","Other"], mode: "single", extra: "Is this reviewed regularly?" },
          { id: "governance-and-controls--segregation-of-duties--5", text: "Who approves payroll?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "governance-and-controls--segregation-of-duties--6", text: "Who creates and maintains access to the payroll systems, and how often is system access reviewed?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi", extra: "How often is access reviewed?" },
          { id: "governance-and-controls--segregation-of-duties--7", text: "Who creates and uploads the payroll bank file?", options: ["Payroll","Finance","Both / shared","Other"], mode: "single" },
          { id: "governance-and-controls--segregation-of-duties--8", text: "Between payroll being approved and the bank file being created, can employee data in the final report be changed?", options: ["Yes","No","Unsure","Other"], mode: "single" },
          { id: "governance-and-controls--segregation-of-duties--9", text: "Who authorises the bank payment?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "governance-and-controls--segregation-of-duties--10", text: "Are reconciliation processes undertaken once payroll is finalised?", options: ["Yes","No","Other"], mode: "single", extra: "What is reconciled, by whom, and is it peer-checked?" },
          { id: "governance-and-controls--segregation-of-duties--11", text: "Who is responsible for setting up new payroll codes, and who determines whether they attract PAYG, super, payroll tax etc.?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi", extra: "How often is this reviewed?" },
        ],
      },
      {
        topic: "Payroll Procedure Documentation",
        questions: [
          { id: "governance-and-controls--payroll-procedure-documentation--1", text: "Are there checklists and/or written procedures documenting the payroll process?", options: ["Yes","No","Other"], mode: "single" },
          { id: "governance-and-controls--payroll-procedure-documentation--2", text: "How often are these reviewed?", options: ["Never","Ad hoc / as needed","Regularly scheduled","Other"], mode: "single", extra: "When was the last review performed?" },
          { id: "governance-and-controls--payroll-procedure-documentation--3", text: "Are any templates or off-system calculators used by the payroll team?", options: ["Yes","No","Other"], mode: "single", extra: "If so, please share them if not already provided." },
        ],
      },
      {
        topic: "Payroll Data Security",
        questions: [
          { id: "governance-and-controls--payroll-data-security--1", text: "Do team members outside payroll have access to the payroll system?", options: ["Yes","No","Other"], mode: "single", extra: "If so, who, and is this read-only access?" },
          { id: "governance-and-controls--payroll-data-security--2", text: "Is the payroll system on-premise, or a cloud-hosted (on-demand) solution?", options: ["On-premise","Cloud-hosted","Not sure","Other"], mode: "single" },
          { id: "governance-and-controls--payroll-data-security--3", text: "Does the payroll software require additional verification when accessing it?", options: ["Password only","Two-factor authentication","Other additional verification","Other"], mode: "single" },
          { id: "governance-and-controls--payroll-data-security--4", text: "Are regular reviews performed on the software provider's data security measures?", options: ["Yes","No","Other"], mode: "single", extra: "If so, how often, and when was the last review?" },
          { id: "governance-and-controls--payroll-data-security--5", text: "How often are payroll software updates undertaken?", options: ["Never","Ad hoc / as needed","Regularly scheduled","Other"], mode: "single" },
          { id: "governance-and-controls--payroll-data-security--6", text: "Who updates tax tables, superannuation changes and legislative updates?", options: ["Software vendor (automatic)","Internal team","Both","Other"], mode: "single", extra: "If done by the vendor, is this reviewed internally, and by whom?" },
          { id: "governance-and-controls--payroll-data-security--7", text: "How is employee information stored, and are backups taken in case systems are compromised or inaccessible?" },
          { id: "governance-and-controls--payroll-data-security--8", text: "Is payroll data regularly cleansed to remove records no longer legally required to be kept?", options: ["Yes","No","Other"], mode: "single" },
        ],
      },
      {
        topic: "Audits and Reviews",
        questions: [
          { id: "governance-and-controls--audits-and-reviews--1", text: "Are regular internal reviews or audits completed on employees across payroll and HR systems (including previously terminated employees)?", options: ["Yes","No","Other"], mode: "single", extra: "By whom (ideally someone outside payroll)?" },
          { id: "governance-and-controls--audits-and-reviews--2", text: "Are regular reviews performed to check the accuracy of employee data (e.g. rates, super, correct award applied, correct leave rules)?", options: ["Yes","No","Other"], mode: "single" },
          { id: "governance-and-controls--audits-and-reviews--3", text: "Who performs these reviews, how often, and are they peer-checked outside the payroll department?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi", extra: "How often, and are they peer-checked?" },
          { id: "governance-and-controls--audits-and-reviews--4", text: "Are any internal or external audits completed within the business?", options: ["Yes","No","Other"], mode: "single", extra: "How often?" },
        ],
      },
      {
        topic: "Payroll Continuity and Disaster Recovery",
        questions: [
          { id: "governance-and-controls--payroll-continuity-and-disaster-recovery--1", text: "Does payroll have a disaster recovery plan in place?", options: ["Yes","No","Other"], mode: "single", extra: "When was it last tested? Please share it if not already provided." },
          { id: "governance-and-controls--payroll-continuity-and-disaster-recovery--2", text: "If senior payroll team members were unexpectedly unavailable, could other people in the organisation execute the entire end-to-end payroll process confidently?", options: ["Yes","No","Unsure","Other"], mode: "single" },
          { id: "governance-and-controls--payroll-continuity-and-disaster-recovery--3", text: "If the payroll team were unavailable, would employees still be able to be paid?", options: ["Yes","No","Unsure","Other"], mode: "single" },
        ],
      },
    ],
  },
  {
    section: "Compliance with Legislation",
    topics: [
      {
        topic: "General Compliance",
        questions: [
          { id: "compliance-with-legislation--general-compliance--1", text: "Does the payroll team support workers compensation calculations?", options: ["Yes","No","Other"], mode: "single" },
          { id: "compliance-with-legislation--general-compliance--2", text: "Does the payroll team support the FBT process?", options: ["Yes","No","Other"], mode: "single" },
        ],
      },
      {
        topic: "Award Interpretation",
        questions: [
          { id: "compliance-with-legislation--award-interpretation--1", text: "How do changes to an employee's employment or working conditions get updated in their masterfile within T&A?" },
          { id: "compliance-with-legislation--award-interpretation--2", text: "Who determines an employee's classification when they start, in terms of industrial instrument coverage and pay classification?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "compliance-with-legislation--award-interpretation--3", text: "How often is this reviewed where the classification involves time- or experience-based increases (e.g. SCHADS)?", options: ["Never","Ad hoc / as needed","Regularly scheduled","Other"], mode: "single" },
        ],
      },
      {
        topic: "Annualised Salaries",
        questions: [
          { id: "compliance-with-legislation--annualised-salaries--1", text: "Are any employees paid an annualised salary?", options: ["Under an award","Under a common law contract","Both","No annualised salaries","Other"], mode: "multi", extra: "If under an award, which award(s)?" },
          { id: "compliance-with-legislation--annualised-salaries--2", text: "Are annualised salary reconciliations performed?", options: ["Yes","No","Other"], mode: "single", extra: "How, and how often? If the approach differs between award and common-law arrangements, please note both. Share an example if possible." },
        ],
      },
      {
        topic: "Superannuation",
        questions: [
          { id: "compliance-with-legislation--superannuation--1", text: "Who pays the company's superannuation, and how often?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi", extra: "What clearing house facility processes the payments, and how do you ensure it's paid on time?" },
          { id: "compliance-with-legislation--superannuation--2", text: "Who determines what payments are subject to superannuation (Ordinary Time Earnings) and configures the wage codes, including any OTE exclusions?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi", extra: "Is there a documented basis for any exclusions?" },
          { id: "compliance-with-legislation--superannuation--3", text: "Do you apply the Maximum Superannuation Contributions Base?", options: ["Yes","No","Unsure","Other"], mode: "single", extra: "How is this monitored?" },
          { id: "compliance-with-legislation--superannuation--4", text: "Has the company been required to lodge any superannuation guarantee charge statements in the past two years?", options: ["Yes","No","Other"], mode: "single", extra: "If so, which quarters, and what caused the shortfall?" },
          { id: "compliance-with-legislation--superannuation--5", text: "What is the process when an employee doesn't provide their required super fund details (stapled super)?" },
          { id: "compliance-with-legislation--superannuation--6", text: "Are regular reconciliations performed on superannuation?", options: ["Yes","No","Other"], mode: "single" },
        ],
      },
      {
        topic: "Payroll Tax",
        questions: [
          { id: "compliance-with-legislation--payroll-tax--1", text: "Do you have employees who work across multiple states, or remotely in a different state to others?", options: ["Yes","No","Other"], mode: "single", extra: "How are their wages reported for payroll tax purposes?" },
          { id: "compliance-with-legislation--payroll-tax--2", text: "Is the payroll team involved in payroll tax reporting?", options: ["Yes","No","Other"], mode: "single", extra: "Are reports generated from the payroll system for this?" },
          { id: "compliance-with-legislation--payroll-tax--3", text: "Are checks performed to ensure all relevant payroll elements are captured for accurate payroll tax reporting?", options: ["Yes","No","Other"], mode: "single" },
          { id: "compliance-with-legislation--payroll-tax--4", text: "Who determines what payments are subject to payroll tax and configures the wage code?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "compliance-with-legislation--payroll-tax--5", text: "Are contractors captured in the monthly payroll tax report?", options: ["Yes","No","Other"], mode: "single", extra: "If not, or if excluded, on what basis, and is this documented?" },
        ],
      },
      {
        topic: "PAYG Withholding and Reporting",
        questions: [
          { id: "compliance-with-legislation--payg-withholding-and-reporting--1", text: "Are employee expenses paid via payroll?", options: ["Yes","No","Other"], mode: "single", extra: "What approvals are required?" },
          { id: "compliance-with-legislation--payg-withholding-and-reporting--2", text: "Does the company make any payments from which it doesn't withhold PAYG, or apply a variation to normal withholding rates (e.g. cents/km, travel or meal allowances, LAFHA)?", options: ["Yes","No","Other"], mode: "single" },
          { id: "compliance-with-legislation--payg-withholding-and-reporting--3", text: "Have payment summaries been issued to employees by 14 July each year?", options: ["Yes","No","Other"], mode: "single" },
          { id: "compliance-with-legislation--payg-withholding-and-reporting--4", text: "Who sets up STP in the system and determines allowance coding, and is this reviewed by anyone else?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "compliance-with-legislation--payg-withholding-and-reporting--5", text: "Have there been any issues with STP reporting so far?", options: ["Yes","No","Other"], mode: "single" },
          { id: "compliance-with-legislation--payg-withholding-and-reporting--6", text: "Are any employees paid bonuses?", options: ["Yes","No","Other"], mode: "single", extra: "What type (e.g. sign-on, performance, retention), how frequently, and is the tax calculated by the system or manually?" },
          { id: "compliance-with-legislation--payg-withholding-and-reporting--7", text: "If an overpayment is made, what is the recovery process?", options: ["Yes","No","Other"], mode: "single", extra: "Is there a written policy, and can you share examples of when this has occurred?" },
        ],
      },
      {
        topic: "Terminations",
        questions: [
          { id: "compliance-with-legislation--terminations--1", text: "Who calculates termination payments, including redundancy?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "compliance-with-legislation--terminations--2", text: "Does the payroll system calculate termination payments (e.g. unused leave), or is this done via another calculator (e.g. a spreadsheet)?", options: ["Calculated by the payroll system","Calculated via spreadsheet/other calculator","Combination","Other"], mode: "single" },
          { id: "compliance-with-legislation--terminations--3", text: "When are termination pays processed?", options: ["Out of cycle","In the next pay run","Depends on circumstances","Other"], mode: "single" },
          { id: "compliance-with-legislation--terminations--4", text: "For redundancies, are manual calculations done outside the system?", options: ["Yes","No","Other"], mode: "single", extra: "Is the notice period paid at the base rate, expected earnings, or an average of a prior period?" },
          { id: "compliance-with-legislation--terminations--5", text: "What is the process for paying a deceased employee, and are there specific timeframes that apply?" },
        ],
      },
      {
        topic: "Payslips",
        questions: [
          { id: "compliance-with-legislation--payslips--1", text: "How are payslips issued to current employees?", options: ["Employee self-service portal","Email","Printed / physical","Other"], mode: "multi" },
          { id: "compliance-with-legislation--payslips--2", text: "How are payslips issued to terminated employees?", options: ["Same as current employees","Different process","Not provided after termination","Other"], mode: "single", extra: "Do they retain ESS access to their final payslip?" },
        ],
      },
    ],
  },
  {
    section: "Leave & Workers Compensation",
    topics: [
      {
        topic: "Leave",
        questions: [
          { id: "leave-and-workers-compensation--leave--1", text: "Does the company provide more than 20 days' annual leave?", options: ["Yes","No","Other"], mode: "single", extra: "If so, how many?" },
          { id: "leave-and-workers-compensation--leave--2", text: "Does the company provide Purchased Annual Leave (PAL)?", options: ["Yes","No","Other"], mode: "single" },
          { id: "leave-and-workers-compensation--leave--3", text: "Are any additional leave programs administered beyond annual leave (e.g. non-accrued additional annual leave, Time Off in Lieu)?", options: ["Yes","No","Other"], mode: "single" },
          { id: "leave-and-workers-compensation--leave--4", text: "Is there a company leave policy covering entitlements to annual and other leave?", options: ["Yes","No","Other"], mode: "single", extra: "Please share it if not already provided." },
          { id: "leave-and-workers-compensation--leave--5", text: "Is there a company policy for cashing out annual leave?", options: ["Yes","No","Other"], mode: "single", extra: "What rate of tax is applied?" },
          { id: "leave-and-workers-compensation--leave--6", text: "Does the company offer any additional entitlements to personal leave beyond the NES?", options: ["Yes","No","Other"], mode: "single" },
        ],
      },
      {
        topic: "Long Service Leave",
        questions: [
          { id: "leave-and-workers-compensation--long-service-leave--1", text: "Is long service leave accrued in hours or weeks in the payroll system?", options: ["Hours","Weeks","Other"], mode: "single" },
          { id: "leave-and-workers-compensation--long-service-leave--2", text: "Is LSL paid at the employee's base rate of pay, or are manual calculations done each time?", options: ["System-calculated base rate","Manual calculation each time","Other"], mode: "single" },
          { id: "leave-and-workers-compensation--long-service-leave--3", text: "On termination, are final LSL entitlements reviewed against the employee's length of service, or are the system's amounts used as final?", options: ["Reviewed manually","System amounts used as final","Other"], mode: "single" },
          { id: "leave-and-workers-compensation--long-service-leave--4", text: "When an employee takes LSL, or terminates with an LSL entitlement, are manual reconciliations performed, or are payments based on system-generated amounts?", options: ["Manual reconciliation","System-generated amounts","Combination","Other"], mode: "single" },
          { id: "leave-and-workers-compensation--long-service-leave--5", text: "Is LSL on termination paid in the next pay run, or as an out-of-cycle payment?", options: ["Next pay run","Out-of-cycle payment","Depends","Other"], mode: "single" },
        ],
      },
      {
        topic: "Workers Compensation",
        questions: [
          { id: "leave-and-workers-compensation--workers-compensation--1", text: "Does the payroll team provide annual income figures for workers compensation insurance renewal?", options: ["Yes","No","Other"], mode: "single", extra: "Who prepares next year's estimate?" },
          { id: "leave-and-workers-compensation--workers-compensation--2", text: "Does the company have a definition of gross salaries and wages for each state?", options: ["Yes","No","Other"], mode: "single" },
          { id: "leave-and-workers-compensation--workers-compensation--3", text: "Who determines what payments are subject to workers compensation and configures the wage code?", options: ["Payroll","HR","Finance","IT","Outsourced provider","Shared / multiple teams","Other"], mode: "multi" },
          { id: "leave-and-workers-compensation--workers-compensation--4", text: "When was the last audit or review conducted by the relevant workers compensation authority or agent?" },
          { id: "leave-and-workers-compensation--workers-compensation--5", text: "Do you have any employees currently receiving workers compensation?", options: ["Yes","No","Other"], mode: "single" },
          { id: "leave-and-workers-compensation--workers-compensation--6", text: "Are any top-up payments made by the employer?", options: ["Yes","No","Other"], mode: "single" },
        ],
      },
    ],
  },
  {
    section: "People",
    topics: [
      {
        topic: "Support and Training",
        questions: [
          { id: "people--support-and-training--1", text: "Are you required to complete payroll-specific training as part of your personal development plan?", options: ["Yes","No","Other"], mode: "single" },
          { id: "people--support-and-training--2", text: "What payroll-related training courses have you completed in the past 12 months?" },
          { id: "people--support-and-training--3", text: "How are team members kept up to date with changes in legislation?" },
          { id: "people--support-and-training--4", text: "Are you a member of any payroll associations?", options: ["Yes","No","Other"], mode: "single" },
          { id: "people--support-and-training--5", text: "Where do you go for payroll support or guidance on awards, EAs or legislation (e.g. industry websites, ATO, Fair Work, state revenue office)?" },
          { id: "people--support-and-training--6", text: "What training was provided on your current payroll systems, and how were you taught to use them?" },
        ],
      },
      {
        topic: "Resourcing",
        questions: [
          { id: "people--resourcing--1", text: "How many people are in the payroll team (or FTEs)?" },
          { id: "people--resourcing--2", text: "What backup exists in an emergency?" },
          { id: "people--resourcing--3", text: "What are average hours worked per week, including any weekend or after-hours work?" },
          { id: "people--resourcing--4", text: "Are resourcing levels adequate for the current payroll operation?", options: ["Yes","No","Other"], mode: "single", extra: "If not, how many additional resources would be needed?" },
        ],
      },
    ],
  },
];
