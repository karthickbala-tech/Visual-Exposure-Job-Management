// Sidebar modules, matching the approved Lovable prototype. `home` shows the current role's dashboard.
// `replaces` lists the Creator screens each module absorbs (shown on placeholder pages).
export const NAV = [
  { label: 'Dashboard', path: '/', icon: 'home', end: true, home: true },
  { label: 'Jobs', path: '/jobs', icon: 'jobs' },
  {
    label: 'Design', path: '/design', icon: 'design',
    blurb: 'Design tasks across all jobs: artwork, shop drawings, proofs and approvals.',
    replaces: ['Design Task report', 'Design Kanban', 'Awaiting Submission', 'Rejected and Reopen design tasks'],
  },
  {
    label: 'Fabrication', path: '/fabrication', icon: 'fab',
    blurb: 'Fab tasks, the colour-coded fab calendar, checklists, and the Fab Manager, 2IC and Fab Worker views.',
    replaces: ['Fab Manager Dashboard', '2IC Dashboard', 'Fab Worker Dashboard', 'Fabrication Job report', 'Fab Calendar by Type'],
  },
  {
    label: 'Installation', path: '/installation', icon: 'install',
    blurb: 'Install tasks and calendar, the Installer day view, site stages and the combined Install and Fab calendar.',
    replaces: ['Install Dashboard', 'Installer Dashboard', 'All Install Tasks', 'My Install Calendar 2IC', 'Install and Fab Dashboard'],
  },
  {
    label: 'SWMS', path: '/swms', icon: 'swms',
    blurb: 'Safe Work Method Statements: create, PM and team leader signing, PPE rules and the PDF.',
    replaces: ['SWMS Project Manager report', 'Task Template', 'SWMS PDF and email'],
  },
  {
    label: 'Booked Hours', path: '/hours', icon: 'hours',
    blurb: 'Booked hours, pay periods and staff timesheets with breaks.',
    replaces: ['Booked Hours page', 'Employee Hours report', 'Staff Timesheet', 'Staff Timesheet Breaks'],
  },
  {
    label: 'Issues', path: '/issues', icon: 'issues',
    blurb: 'Report and track issues, with a board per department.',
    replaces: ['Issues form', 'My Reported Issues', 'Workshop, Install, Civic, Management and VT boards'],
  },
  {
    label: 'Workers', path: '/workers', icon: 'people',
    blurb: 'Workers, subcontractor companies, tickets, inductions, ratings and devices.',
    replaces: ['Worker Dashboard', 'My Tickets', 'My Inductions', 'Companies', 'Devices'],
  },
];
