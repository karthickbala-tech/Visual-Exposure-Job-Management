import logo from '../assets/visual_exposure_logo.avif';
import { NavLink, Outlet } from 'react-router-dom';
import { useMe } from '../api/queries';
import { signOut } from '../auth/Login';
import './Shell.css';

interface NavItem {
	to: string;
	label: string;
	end?: boolean;
	/** Roles that see this item. Omit for everyone. The server enforces access regardless. */
	roles?: string[];
}

/** Only screens that exist are listed; more appear as later phases are built. */
const NAV: NavItem[] = [
	{ to: '/', label: 'Dashboard', end: true },
	{ to: '/jobs', label: 'Jobs' },
	{ to: '/calendar', label: 'Calendar' },
	{ to: '/issues', label: 'Issues' },
];

const ROLE_LABEL = (r: string) => r.replace(/_/g, ' ');

/** App frame: slate sidebar and top bar, green active item, as on the public site. */
export function Shell() {
	const me = useMe();
	const roles = me.data?.roles ?? [];
	const items = NAV.filter((n) => !n.roles || n.roles.some((r) => roles.includes(r)));
	const name = me.data ? `${me.data.user.firstName} ${me.data.user.lastName}`.trim() || me.data.user.email : '';

	return (
		<div className="shell">
			<a className="skip" href="#main">
				Skip to content
			</a>
			<aside className="shell__side" aria-label="Main navigation">
				<div className="shell__brand">
					<img className="shell__logo" src={logo} alt="Visual Exposure" />
				</div>
				<nav>
					{items.map((n) => (
						<NavLink key={n.to} to={n.to} end={n.end} className="shell__link">
							{n.label}
						</NavLink>
					))}
				</nav>
			</aside>
			<div className="shell__body">
				<header className="shell__top">
					<span className="shell__who">
						{name}
						{roles[0] && <span className="shell__role"> ({ROLE_LABEL(roles[0])})</span>}
					</span>
					<button className="shell__signout" onClick={signOut}>
						Sign out
					</button>
				</header>
				<main id="main" className="shell__main">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
