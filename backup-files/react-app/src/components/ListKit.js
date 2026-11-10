import { useState } from 'react';
import { ChevronDown, MoreHorizontal, Search, SlidersHorizontal } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from './ui-kit/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui-kit/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui-kit/dropdown-menu';
import { Button } from './ui-kit/button';
import { Checkbox } from './ui-kit/checkbox';
import { cn } from '../lib/utils';

// Building blocks shared by every list screen, so they all work the same way:
// saved views with counts, a search box, filters tucked behind one button, a bulk action bar, row menus.

// Saved views ("My open", "Overdue", ...). views: [{ id, label, count }]
export function SavedViews({ views, value, onChange, label = 'Saved views', className }) {
  return (
    <div className={cn('max-w-full overflow-x-auto', className)}>
      <ToggleGroup type="single" value={value} onValueChange={(v) => { if (v) onChange(v); }} variant="outline" size="sm" className="w-max justify-start gap-0" aria-label={label}>
        {views.map((v) => (
          <ToggleGroupItem key={v.id} value={v.id} className="whitespace-nowrap rounded-none px-3 first:rounded-l-md last:rounded-r-md data-[state=on]:bg-foreground data-[state=on]:text-background">
            {v.label}{v.count !== undefined && <span className="ml-1 opacity-60">{v.count}</span>}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, label }) {
  return (
    <label className="flex h-9 min-w-[12rem] flex-1 items-center gap-2 rounded-md border border-input bg-card px-3 text-muted-foreground focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 sm:max-w-sm">
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label || placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none" />
    </label>
  );
}

// "Filters" button that opens a row of extra filters. active = how many filters are not on their default.
// The filters stay in the page (hidden when closed) so their state is kept.
export function FilterPanel({ active = 0, children, onClear }) {
  const [open, setOpen] = useState(active > 0);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="contents">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="h-9" aria-label={`Filters${active ? `, ${active} on` : ''}`}>
          <SlidersHorizontal /> Filters{active > 0 && <span className="rounded-sm bg-primary px-1.5 text-[11px] text-primary-foreground">{active}</span>}
          <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="w-full data-[state=closed]:hidden">
        <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/40 p-3">
          {children}
          {active > 0 && onClear && <Button variant="link" className="h-9 px-1" onClick={onClear}>Clear filters</Button>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="filter-select grid gap-1 text-xs font-semibold text-muted-foreground">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 min-w-[10rem] rounded-md border border-input bg-card px-2 text-sm font-medium text-foreground">
        {options.map((o) => (typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );
}

// Appears only when rows are ticked.
export function BulkBar({ count, onClear, children }) {
  if (!count) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-accent px-3 py-2 text-sm font-semibold" role="region" aria-label="Bulk actions">
      <Checkbox checked onCheckedChange={onClear} aria-label="Clear selection" /> {count} selected
      {children}
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>Clear</Button>
    </div>
  );
}

// The ⋯ menu on a row or card. items: [{ label, icon, onSelect, danger, separator, hidden }]
export function RowMenu({ label, items }) {
  const shown = items.filter((i) => !i.hidden);
  if (!shown.length) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label={label} onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {shown.map((i, n) => (i.separator ? <DropdownMenuSeparator key={`s${n}`} /> : (
          <DropdownMenuItem key={i.label} onSelect={i.onSelect} disabled={i.disabled} className={cn(i.danger && 'text-destructive focus:text-destructive')}>
            {i.icon && <i.icon />} {i.label}
          </DropdownMenuItem>
        )))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EmptyState({ children }) {
  return <p className="m-0 px-4 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

// A slim progress bar with its number, for list rows.
export function MiniBar({ value, label, tone = 'brand' }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="flex min-w-[7rem] items-center gap-2 text-xs text-muted-foreground" title={`${label}: ${v}%`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn('h-full rounded-full', tone === 'red' ? 'bg-destructive' : 'bg-brand')} style={{ width: `${v}%` }} />
      </div>
      <span className="w-9 text-right">{v}%</span>
    </div>
  );
}
