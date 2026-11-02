import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DEMO_ENABLED, DEMO_PASSWORD, demoAccounts, isEmail } from '../../lib/authStore';
import AuthLayout from './AuthLayout';
import { Field, PasswordInput, SubmitButton } from './fields';

export default function SignInPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!email.trim()) next.email = 'Enter your email address.';
    else if (!isEmail(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await signIn(email, password, remember); // the router moves on once the user is set
    } catch (err) {
      setFormError(err.message || 'Could not sign in. Please try again.');
      setBusy(false);
    }
  };

  return (
    <AuthLayout eyebrow="Welcome back" title="Sign in" subtitle="Use your Visual Exposure account to open the project dashboard."
      footer={<>New to Visual Exposure? <Link to="/signup">Create an account</Link></>}>
      <form className="auth-form" onSubmit={submit} noValidate>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <Field id="email" label="Email" error={errors.email}>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus
            aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? 'email-err' : undefined} />
        </Field>
        <Field id="password" label="Password" error={errors.password}>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
            invalid={!!errors.password} describedBy={errors.password ? 'password-err' : undefined} />
        </Field>
        <div className="auth-row">
          <label className="check-inline"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in</label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <SubmitButton busy={busy}>Sign in</SubmitButton>
      </form>

      {DEMO_ENABLED && (
        <details className="demo-box">
          <summary>Demo accounts</summary>
          <p>Pick a role to fill the form. The password for every demo account is <code>{DEMO_PASSWORD}</code>.</p>
          <ul>
            {demoAccounts.map((a) => (
              <li key={a.roleId}>
                <button type="button" onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); setErrors({}); setFormError(''); }}>
                  <strong>{a.label}</strong><small>{a.email}</small>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </AuthLayout>
  );
}
