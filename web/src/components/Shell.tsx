import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AlertTriangle, Briefcase, CalendarDays, LayoutDashboard, LogOut, Menu, Moon, Search, ShieldCheck, Sun, Users, X, Settings, Smartphone, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import logo from '../assets/visual_exposure_logo.avif';
import { useMe } from '../api/queries';
import { signOut } from '../auth/Login';
import { useTheme } from './theme';

interface NavItem {
	to: string;
	label: string;
	icon: LucideIcon;
	end?: boolean;
	/** Roles that see this item. Omit for everyone. The server enforces access regardless. */
	roles?: string[];
}

/** Only screens that exist are listed; more appear as later phases are built. */
const NAV: NavItem[] = [
	{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
	{ to: '/jobs', label: 'Jobs', icon: Briefcase },
	{ to: '/calendar', label: 'Calendar', icon: CalendarDays },
	{ to: '/issues', label: 'Issues', icon: AlertTriangle },
	{ to: '/compliance', label: 'Compliance', icon: ShieldCheck },
	{ to: '/equipment', label: 'Equipment', icon: Wrench, roles: ['admin', 'project_manager', 'fab_manager', 'install_coordinator', 'second_ic', 'workshop', 'fab_worker'] },
	{ to: '/people', label: 'People', icon: Users, roles: ['admin', 'project_manager', 'fab_manager', 'install_coordinator', 'second_ic'] },
	{ to: '/devices', label: 'Devices', icon: Smartphone, roles: ['admin', 'project_manager', 'fab_manager', 'install_coordinator'] },
	{ to: '/admin', label: 'Admin', icon: Settings, roles: ['admin'] },
];

const roleLabel = (r: string) => r.replace(/_/g, ' ');
const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0].toUpperCase())
		.join('');

/** App frame: charcoal sidebar (a drawer on phones), top bar with search and theme toggle, and the page. */
export function Shell() {
	const me = useMe();
	const { theme, toggleTheme } = useTheme();
	const navigate = useNavigate();
	const [navOpen, setNavOpen] = useState(false);
	const [query, setQuery] = useState('');
	const searchRef = useRef<HTMLInputElement>(null);

	const roles = me.data?.roles ?? [];
	const items = NAV.filter((n) => !n.roles || n.roles.some((r) => roles.includes(r)));
	const name = me.data ? `${me.data.user.firstName} ${me.data.user.lastName}`.trim() || me.data.user.email : '';

	// Ctrl or Cmd + K jumps to the search box.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				searchRef.current?.focus();
			}
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, []);

	const search = (e: FormEvent) => {
		e.preventDefault();
		navigate(query.trim() ? '/jobs?q=' + encodeURIComponent(query.trim()) : '/jobs');
	};

	return (
		<div className="shell">
			<a className="skip" href="#main">
				Skip to content
			</a>
			<aside className={'sidebar' + (navOpen ? ' open' : '')} aria-label="Main navigation">
				<div className="side-top">
					<img className="logo-img" src={logo} alt="Visual Exposure" />
					<button type="button" className="icon-btn side-close" aria-label="Close menu" onClick={() => setNavOpen(false)}>
						<X size={18} />
					</button>
				</div>
				<nav className="side-nav">
					{items.map((n) => (
						<NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => 'side-link' + (isActive ? ' active' : '')} onClick={() => setNavOpen(false)}>
							<n.icon size={17} aria-hidden="true" />
							<span>{n.label}</span>
						</NavLink>
					))}
				</nav>
				<div className="side-user">
					<span className="avatar" aria-hidden="true">
						{initialsOf(name) || '?'}
					</span>
					<div>
						<strong>{name}</strong>
						<span>{roles[0] ? roleLabel(roles[0]) : ''}</span>
					</div>
					<button type="button" className="side-signout" aria-label="Sign out" title="Sign out" onClick={signOut}>
						<LogOut size={17} aria-hidden="true" />
					</button>
				</div>
			</aside>
			{navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

			<div className="main-col">
				<div className="topbar">
					<button type="button" className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setNavOpen(true)}>
						<Menu size={20} />
					</button>
					<form className="search" role="search" onSubmit={search}>
						<Search size={16} aria-hidden="true" />
						<input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search jobs" aria-label="Search jobs" />
						<kbd>Ctrl K</kbd>
					</form>
					<div className="topbar-right">
						<button
							type="button"
							className="icon-btn theme-toggle"
							onClick={toggleTheme}
							aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
							title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
						>
							{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
						</button>
					</div>
				</div>
				<main id="main" className="page">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
