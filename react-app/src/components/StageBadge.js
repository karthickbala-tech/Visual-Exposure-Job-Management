import { Badge } from './ui-kit/badge';
import { cn } from '../lib/utils';

// Muted colours for task stages: grey not started, blue scheduled, amber in progress, purple in review, green done.
// Red is kept for overdue and rejected only. Colours come from the App.css chip tokens, which have dark values.
const TONE = {
  gray: 'bg-[var(--chip-gray-bg)] text-[var(--chip-gray-ink)]', blue: 'bg-[var(--chip-blue-bg)] text-[var(--chip-blue-ink)]',
  amber: 'bg-[var(--chip-amber-bg)] text-[var(--chip-amber-ink)]', purple: 'bg-[var(--chip-purple-bg)] text-[var(--chip-purple-ink)]',
  green: 'bg-[var(--chip-green-bg)] text-[var(--chip-green-ink)]', red: 'bg-[var(--chip-red-bg)] text-[var(--chip-red-ink)]',
};
const STAGE_TONE = {
  'Awaiting Scheduling': 'gray', 'To be Assigned': 'gray', 'Not Started': 'gray', Preparation: 'gray', 'On Hold': 'gray',
  Scheduled: 'blue', Assigned: 'blue', Open: 'blue',
  'In Progress': 'amber', 'Client Review': 'amber', 'Awaiting Submission': 'amber',
  'Manager Review': 'purple',
  Completed: 'green', 'Approved & Completed': 'green', 'Completed - Closed': 'green', 'Complete - Not Used': 'gray', Cancelled: 'gray',
  Rejected: 'red', Reopen: 'red',
};

export function StageBadge({ stage, className }) {
  return (
    <Badge variant="secondary" className={cn('whitespace-nowrap rounded-sm border-0 font-semibold shadow-none', TONE[STAGE_TONE[stage] || 'gray'], className)}>
      {stage}
    </Badge>
  );
}
