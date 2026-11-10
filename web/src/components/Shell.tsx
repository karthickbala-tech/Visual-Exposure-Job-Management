import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, ChevronsLeft, LogOut, Menu, Moon, Search, Settings2, Sun, X } from 'lucide-react';
import logo from '../assets/visual_exposure_logo.avif';
import emblem from '../assets/emblem.png';
import { useMe } from '../api/queries';
import { signOut } from '../auth/Login';
import { useTheme } from './theme';
import { usePrefs } from './prefs';
import { flatNav, isGroup, visibleNav } from '../navConfig';
import type { NavEntry, NavGroup, NavItem } from '../navConfig';
import { NotificationBell } from './NotificationBell';

const roleLabel = (r: string) => r.replace(/_/g, ' ');
const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0].toUpperCase())
		.join('');

const COLLAPSE_KEY = 've.sidebar.collapsed';
const readCollapsed = () => {
	try {
		return window.localStorage.getItem(COLLAPSE_KEY) === '1';
	} catch {
		return false;
	}
};

const OPEN_KEY = 've.nav.open';
const readOpen = (): string[] => {
	try {
		const v = JSON.parse(window.localStorage.getItem(OPEN_KEY) || '[]');
		return Array.isArray(v) ? v.map(String) : [];
	} catch {
		return [];
	}
};

function SideLink({ n, collapsed, onGo, nested = false }: { n: NavItem; collapsed: boolean; onGo: () => void; nested?: boolean }) {
	return (
		<NavLink to={n.to} end={n.end} title={collapsed ? n.label : undefined} className={({ isActive }) => 'side-link' + (nested ? ' nested' : '') + (isActive ? ' active' : '')} onClick={onGo}>
			<n.icon size={17} aria-hidden="true" />
			<span className="side-label">{n.label}</span>
		</NavLink>
	);
}

/** The menu. Groups open and close like an accordion; the group holding the current page opens by itself. In the slim rail, or with grouping turned off, it is one flat list. */
function SideNav({ entries, collapsed, grouped, onGo }: { entries: NavEntry[]; collapsed: boolean; grouped: boolean; onGo: () => void }) {
	const { pathname } = useLocation();
	const [open, setOpen] = useState<string[]>(readOpen);
	const holds = (g: NavGroup) => g.items.some((i) => (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(i.to + '/')));
	const toggle = (key: string) =>
		setOpen((cur) => {
			const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
			try {
				window.localStorage.setItem(OPEN_KEY, JSON.stringify(next));
			} catch {
				/* not remembered */
			}
			return next;
		});

	if (collapsed || !grouped) {
		return (
			<nav className="side-nav" aria-label="Main">
				{flatNav(entries).map((n) => (
					<SideLink key={n.to} n={n} collapsed={collapsed} onGo={onGo} />
				))}
			</nav>
		);
	}
	return (
		<nav className="side-nav" aria-label="Main">
			{entries.map((e) => {
				if (!isGroup(e)) return <SideLink key={e.to} n={e} collapsed={false} onGo={onGo} />;
				const isOpen = open.includes(e.key) || holds(e);
				return (
					<div key={e.key} className={'side-group' + (isOpen ? ' open' : '') + (holds(e) ? ' has-active' : '')}>
						<button type="button" className="side-group-head" aria-expanded={isOpen} aria-controls={'grp-' + e.key} onClick={() => toggle(e.key)}>
							<e.icon size={17} aria-hidden="true" />
							<span className="side-label">{e.label}</span>
							<ChevronDown size={15} className="grp-chev" aria-hidden="true" />
						</button>
						{isOpen && (
							<div id={'grp-' + e.key} className="side-group-body">
								{e.items.map((n) => (
									<SideLink key={n.to} n={n} collapsed={false} onGo={onGo} nested />
								))}
							</div>
						)}
					</div>
				);
			})}
		</nav>
	);
}

/** The signed-in person at the foot of the sidebar. Opens a small menu: theme and sign out. Esc or a click outside closes it. */
function UserMenu({ name, role, collapsed }: { name: string; role: string; collapsed: boolean }) {
	const { theme, toggleTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return undefined;
		const first = box.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
		first?.focus();
		const onDown = (e: MouseEvent) => {
			if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setOpen(false);
				trigger.current?.focus();
			}
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				const items = Array.from(box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
				const i = items.indexOf(document.activeElement as HTMLButtonElement);
				items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
				e.preventDefault();
			}
		};
		document.addEventListener('mousedown', onDown);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDown);
			document.removeEventListener('keydown', onKey);
		};
	}, [open]);

	return (
		<div className="side-user" ref={box}>
			{open && (
				<div className="user-menu" role="menu" aria-label="Account">
					<button type="button" role="menuitem" onClick={() => { toggleTheme(); setOpen(false); }}>
						{theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
						{theme === 'dark' ? 'Light theme' : 'Dark theme'}
					</button>
					<hr />
					<button type="button" role="menuitem" className="out" onClick={signOut}>
						<LogOut size={16} aria-hidden="true" /> Sign out
					</button>
				</div>
			)}
			<button ref={trigger} type="button" className="user-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={collapsed ? `${name}, account menu` : undefined} title={collapsed ? name : undefined} onClick={() => setOpen(!open)}>
				<span className="avatar" aria-hidden="true">{initialsOf(name) || '?'}</span>
				<span className="who">
					<strong>{name}</strong>
					<span>{role}</span>
				</span>
				<ChevronUp size={16} className="chev" aria-hidden="true" />
			</button>
		</div>
	);
}

/** App frame: charcoal sidebar (a drawer on phones), top bar with search and theme toggle, and the page. */
export function Shell() {
	const me = useMe();
	const { theme, toggleTheme } = useTheme();
	const navigate = useNavigate();
	const [navOpen, setNavOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(readCollapsed);
	const toggleCollapsed = () => {
		const next = !collapsed;
		setCollapsed(next);
		try {
			window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
		} catch {
			/* the choice just is not remembered */
		}
	};
	const [query, setQuery] = useState('');
	const searchRef = useRef<HTMLInputElement>(null);

	const roles = me.data?.roles ?? [];
	const entries = visibleNav(roles);
	const { prefs } = usePrefs();
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
		<div className={'shell' + (collapsed ? ' shell--collapsed' : '')}>
			<a className="skip" href="#main">
				Skip to content
			</a>
			<aside className={'sidebar' + (navOpen ? ' open' : '') + (collapsed ? ' collapsed' : '')} aria-label="Main navigation">
				<div className="side-top">
					<img className="logo-img" src={logo} alt="Visual Exposure" />
					<button type="button" className="logo-emblem" aria-label="Expand the menu" title="Expand the menu" onClick={toggleCollapsed}>
						<img src={emblem} alt="" width={36} height={36} />
					</button>
					<button type="button" className="icon-btn side-fold" aria-label="Collapse the menu" title="Collapse the menu" onClick={toggleCollapsed}>
						<ChevronsLeft size={18} aria-hidden="true" />
					</button>
					<button type="button" className="icon-btn side-close" aria-label="Close menu" onClick={() => setNavOpen(false)}>
						<X size={18} />
					</button>
				</div>
				<SideNav entries={entries} collapsed={collapsed} grouped={prefs.groupedNav} onGo={() => setNavOpen(false)} />
				<UserMenu name={name} role={roles[0] ? roleLabel(roles[0]) : ''} collapsed={collapsed} />
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
						<NotificationBell />
						<NavLink to="/settings" className="icon-btn" aria-label="Settings" title="Settings">
							<Settings2 size={18} aria-hidden="true" />
						</NavLink>
					</div>
				</div>
				<main id="main" className="page">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
