import type { ReactNode } from 'react';

/** The compact layout shared by every Job module page (jobs, job detail, task board, task detail). See `.jm` in global.css. */
export function JobModule({ children }: { children: ReactNode }) {
	return <div className="jm">{children}</div>;
}
