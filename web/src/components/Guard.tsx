import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useMe } from '../api/queries';
import { PageHeader } from './ui';

const label = (r: string) => r.replace(/_/g, ' ');

/** A page the person's roles cannot open shows a clear "No access" message instead of a blank or broken screen. */
export function Guard({ roles, children }: { roles: string[] | undefined; children: ReactNode }) {
	const me = useMe();
	if (!roles || !me.isSuccess || roles.some((r) => me.data.roles.includes(r))) return <>{children}</>;
	return (
		<>
			<PageHeader eyebrow="Restricted" title="No access" />
			<div className="no-access" role="alert">
				<Lock size={20} aria-hidden="true" />
				<div>
					<p>Your role does not have access to this page.</p>
					<p className="muted">Roles that can open it: {roles.map(label).join(', ')}.</p>
					<Link className="btn" to="/">
						Back to dashboard
					</Link>
				</div>
			</div>
		</>
	);
}
