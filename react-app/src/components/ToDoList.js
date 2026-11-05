import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { Card } from './ui-kit/card';
import { Button } from './ui-kit/button';
import { cn } from '../lib/utils';

const DOT = { danger: 'bg-destructive', warn: 'bg-[#e2a23b]', info: 'bg-[#2f80ed]', done: 'bg-brand' };

// "To do now": the few things this person should act on, each with one button.
// items: [{ id, title, detail, tone, action: { label, onClick } | { label, to } }]
export default function ToDoList({ items, title = 'To do now', limit = 5, empty = 'Nothing needs you right now.' }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  return (
    <Card className="ui-scope overflow-hidden font-sans" aria-label={title} role="region">
      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <h2 className="m-0 text-[15px] font-bold">{title}</h2>
        <span className="rounded-full bg-accent px-2 text-xs font-bold text-primary">{items.length}</span>
      </div>
      {items.length === 0 && <p className="m-0 flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> {empty}</p>}
      <ul className="m-0 list-none p-0">
        {shown.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 last:border-0 sm:px-5">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT[i.tone] || DOT.info)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{i.title}</div>
              {i.detail && <div className="text-xs text-muted-foreground">{i.detail}</div>}
            </div>
            {i.action && (i.action.to
              ? <Button asChild size="sm" variant="outline" className="min-h-9 sm:min-h-8"><Link to={i.action.to} className="no-underline">{i.action.label}</Link></Button>
              : <Button size="sm" variant="outline" className="min-h-9 sm:min-h-8" onClick={i.action.onClick}>{i.action.label}</Button>)}
          </li>
        ))}
      </ul>
      {items.length > limit && (
        <button type="button" className="flex w-full items-center justify-center gap-1 border-t py-2 text-sm font-semibold text-primary hover:bg-muted/50" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${items.length}`} <ChevronDown className={cn('h-4 w-4 transition-transform', all && 'rotate-180')} />
        </button>
      )}
    </Card>
  );
}
