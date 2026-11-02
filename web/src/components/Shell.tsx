import { NavLink, Outlet } from 'react-router-dom';
import './Shell.css';

const NAV = [
	{ to: '/', label: 'Dashboard', end: true },
	{ to: '/jobs', label: 'Jobs' },
	{ to: '/tasks', label: 'Tasks' },
	{ to: '/swms', label: 'SWMS' },
	{ to: '/issues', label: 'Issues' },
	{ to: '/hours', label: 'Hours' },
];

/** App frame: slate sidebar and top bar, green active item, as on the public site. */
export function Shell() {
	return (
		<div className="shell">
			<a className="skip" href="#main">Skip to content</a>
			<aside className="shell__side" aria-label="Main navigation">
				<div className="shell__brand">
					<span className="shell__logo" aria-hidden="true" />
					<span>Visual<br />Exposure</span>
				</div>
				<nav>
					{NAV.map((n) => (
						<NavLink key={n.to} to={n.to} end={n.end} className="shell__link">
							{n.label}
						</NavLink>
					))}
				</nav>
			</aside>
			<div className="shell__body">
				<header className="shell__top">
					<span className="shell__tag">Done properly</span>
				</header>
				<main id="main" className="shell__main">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
