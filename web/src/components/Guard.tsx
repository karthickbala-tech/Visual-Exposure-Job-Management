import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useMe } from '../api/queries';
import { PageHeader } from './ui';
import { roleLabel } from '../lib/roles';

/**
 * The "No access" page. Used by Guard, and by pages that decide from a permission rather than a role list (add a job,
 * edit a job, add a person, devices, another person's page), which showed a bare line of text before.
 */
export function NoAccess({ roles, what = 'this page' }: { roles?: string[]; what?: string }) {
	return (
		<>
			<PageHeader eyebrow="Restricted" title="No access" />
			<div className="no-access" role="alert">
				<Lock size={20} aria-hidden="true" />
				<div>
					<p>Your role does not have access to {what}.</p>
					{roles && <p className="muted">Roles that can open it: {roles.map(roleLabel).join(', ')}.</p>}
					<Link className="btn" to="/">
						Back to dashboard
					</Link>
				</div>
			</div>
		</>
	);
}

/** A page the person's roles cannot open shows a clear "No access" message instead of a blank or broken screen. */
export function Guard({ roles, children }: { roles: string[] | undefined; children: ReactNode }) {
	const me = useMe();
	if (!roles || !me.isSuccess || roles.some((r) => me.data.roles.includes(r))) return <>{children}</>;
	return <NoAccess roles={roles} />;
}
