import { Clock, Hammer, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './Auth.css';

const POINTS = [
  { icon: Hammer, text: 'Design, fabrication and install in one place' },
  { icon: ShieldCheck, text: 'SWMS signed before crews go on site' },
  { icon: Clock, text: 'Hours and timesheets without the paperwork' },
];

export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="auth">
      <aside className="auth-brand">
        <img className="auth-logo" src={`${process.env.PUBLIC_URL}/logo.png`} alt="Visual Exposure" width="200" height="39" />
        <div className="auth-pitch">
          <p className="eyebrow">Projects</p>
          <h2>Signage.<br />Done properly.</h2>
          <ul>
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text}><Icon size={18} aria-hidden="true" />{text}</li>
            ))}
          </ul>
        </div>
        <p className="auth-copy">© {new Date().getFullYear()} Visual Exposure Pty Ltd</p>
      </aside>

      <main className="auth-panel">
        <button type="button" className="icon-btn theme-toggle auth-theme" onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="auth-card">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <p className="auth-sub">{subtitle}</p>}
          {children}
          {footer && <p className="auth-foot">{footer}</p>}
        </div>
      </main>
    </div>
  );
}
