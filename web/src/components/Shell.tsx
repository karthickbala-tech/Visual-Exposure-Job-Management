import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
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

/**
 * A group in the slim rail: one icon. Hovering it (or focusing it, or clicking it) opens a flyout beside it listing the
 * group's pages, so Work shows Jobs, Task board and Calendar. The flyout is drawn in the page body so the sidebar's
 * scrolling area does not cut it off.
 */
function RailGroup({ group, onGo }: { group: NavGroup; onGo: () => void }) {
	const { pathname } = useLocation();
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState({ top: 0, left: 0 });
	const head = useRef<HTMLButtonElement>(null);
	const flyout = useRef<HTMLDivElement>(null);
	const timer = useRef<number | undefined>(undefined);
	const holds = group.items.some((i) => (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(i.to + '/')));

	const cancel = () => window.clearTimeout(timer.current);
	const show = () => {
		cancel();
		const r = head.current?.getBoundingClientRect();
		if (r) setPos({ top: r.top, left: r.right + 6 });
		setOpen(true);
	};
	// a short delay lets the pointer cross the gap from the icon to the flyout
	const hideSoon = () => { cancel(); timer.current = window.setTimeout(() => setOpen(false), 150); };
	const hideNow = () => { cancel(); setOpen(false); };

	useEffect(() => cancel, []);
	useEffect(() => {
		if (!open) return;
		const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { hideNow(); head.current?.focus(); } };
		document.addEventListener('keydown', esc);
		return () => document.removeEventListener('keydown', esc);
	}, [open]);

	return (
		<>
			<button
				ref={head}
				type="button"
				className={'side-link rail-head' + (holds ? ' active' : '')}
				aria-label={group.label}
				aria-haspopup="true"
				aria-expanded={open}
				title={group.label}
				onMouseEnter={show}
				onMouseLeave={hideSoon}
				onFocus={show}
				onBlur={(e) => { if (!flyout.current?.contains(e.relatedTarget as Node)) hideSoon(); }}
				onClick={() => (open ? hideNow() : show())}
			>
				<group.icon size={17} aria-hidden="true" />
			</button>
			{open && createPortal(
				<div
					ref={flyout}
					className="rail-flyout"
					role="group"
					aria-label={group.label}
					style={{ top: pos.top, left: pos.left }}
					onMouseEnter={show}
					onMouseLeave={hideSoon}
					onBlur={(e) => { if (!head.current?.contains(e.relatedTarget as Node) && !flyout.current?.contains(e.relatedTarget as Node)) hideSoon(); }}
				>
					<p className="rail-flyout__title">{group.label}</p>
					{group.items.map((n) => (
						<NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => 'rail-flyout__link' + (isActive ? ' active' : '')} onClick={() => { hideNow(); onGo(); }}>
							<n.icon size={15} aria-hidden="true" />
							<span>{n.label}</span>
						</NavLink>
					))}
				</div>,
				document.body,
			)}
		</>
	);
}

/** The menu. Groups open and close like an accordion; the group holding the current page opens by itself. In the slim rail, or with grouping turned off, it is one flat list. */
function SideNav({ entries, collapsed, grouped, onGo }: { entries: NavEntry[]; collapsed: boolean; grouped: boolean; onGo: () => void }) {
	const { pathname } = useLocation();
	const [open, setOpen] = useState<string[]>(readOpen);
	const holds = (g: NavGroup) => g.items.some((i) => (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(i.to + '/')));
	// Opening the group of a newly visited page is automatic; after that the person's own open and close choice rules.
	useEffect(() => {
		const current = entries.find((e): e is NavGroup => isGroup(e) && holds(e));
		if (current) setOpen((cur) => (cur.includes(current.key) ? cur : [...cur, current.key]));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathname]);
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

	if (collapsed) {
		return (
			<nav className="side-nav" aria-label="Main">
				{entries.map((e) => (isGroup(e) ? <RailGroup key={e.key} group={e} onGo={onGo} /> : <SideLink key={e.to} n={e} collapsed onGo={onGo} />))}
			</nav>
		);
	}
	if (!grouped) {
		return (
			<nav className="side-nav" aria-label="Main">
				{flatNav(entries).map((n) => (
					<SideLink key={n.to} n={n} collapsed={false} onGo={onGo} />
				))}
			</nav>
		);
	}
	return (
		<nav className="side-nav" aria-label="Main">
			{entries.map((e) => {
				if (!isGroup(e)) return <SideLink key={e.to} n={e} collapsed={false} onGo={onGo} />;
				const isOpen = open.includes(e.key);
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
	// A job record has its own sticky bar (All jobs, Job Details, Edit Job), so the app top bar steps aside.
	const inJobRecord = /^\/jobs\/\d+/.test(useLocation().pathname);
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

	const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

	return (
		<div className={'shell' + (collapsed ? ' shell--collapsed' : '')}>
			<a className="skip" href="#main">
				Skip to content
			</a>
			<aside className={'sidebar' + (navOpen ? ' open' : '') + (collapsed ? ' collapsed' : '')} aria-label="Main navigation">
				<div className="side-top">
					<NavLink to="/" className="logo-link" aria-label="Visual Exposure home">
						<img className="logo-img" src={logo} alt="Visual Exposure" />
					</NavLink>
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
				<div className={'topbar' + (inJobRecord ? ' topbar--hidden' : '')}>
					<button type="button" className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setNavOpen(true)}>
						<Menu size={20} />
					</button>
					<form className="search" role="search" onSubmit={search}>
						<Search size={16} aria-hidden="true" />
						<input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search jobs…" aria-label="Search jobs" />
						<kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
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
