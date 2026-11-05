import { KpiCard } from './ui';
import { cn } from '../lib/utils';

// A KPI tile that is also a shortcut: clicking it opens the matching saved view below.
export default function KpiLink({ onClick, active, ...props }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn('kpi-link block w-full rounded-lg p-0 text-left transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', active && 'ring-2 ring-primary/40')}>
      <KpiCard {...props} />
    </button>
  );
}
