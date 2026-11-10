import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PASSWORD_RULES, isEmail, passwordScore } from '../../lib/authStore';
import AuthLayout from './AuthLayout';
import { Field, PasswordInput, SubmitButton } from './fields';

const LEVELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

export default function SignUpPage() {
  const { signUp } = useAuth();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const score = passwordScore(f.password);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!f.firstName.trim()) next.firstName = 'Enter your first name.';
    if (!f.lastName.trim()) next.lastName = 'Enter your last name.';
    if (!f.email.trim()) next.email = 'Enter your email address.';
    else if (!isEmail(f.email)) next.email = 'Enter a valid email address.';
    if (score < PASSWORD_RULES.length) next.password = 'Your password does not meet all the requirements.';
    if (f.confirm !== f.password) next.confirm = 'The passwords do not match.';
    if (!agree) next.agree = 'Please accept the terms to continue.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await signUp({ firstName: f.firstName, lastName: f.lastName, email: f.email, password: f.password });
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else setFormError(err.message || 'Could not create your account. Please try again.');
      setBusy(false);
    }
  };

  const inp = (id, type, autoComplete) => ({
    id, type, value: f[id], onChange: set(id), autoComplete,
    'aria-invalid': !!errors[id] || undefined, 'aria-describedby': errors[id] ? `${id}-err` : undefined,
  });

  return (
    <AuthLayout eyebrow="Get started" title="Create your account" subtitle="Set up access to the Visual Exposure project system."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}>
      <form className="auth-form" onSubmit={submit} noValidate>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="auth-two">
          <Field id="firstName" label="First name" error={errors.firstName}><input {...inp('firstName', 'text', 'given-name')} autoFocus /></Field>
          <Field id="lastName" label="Last name" error={errors.lastName}><input {...inp('lastName', 'text', 'family-name')} /></Field>
        </div>
        <Field id="email" label="Work email" error={errors.email}><input {...inp('email', 'email', 'email')} /></Field>
        <Field id="password" label="Password" error={errors.password}>
          <PasswordInput id="password" value={f.password} onChange={set('password')} autoComplete="new-password"
            invalid={!!errors.password} describedBy="pw-rules" />
        </Field>

        <div id="pw-rules" className="pw-meter" aria-live="polite">
          <div className="pw-bars" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => <span key={n} className={score >= n ? `on s${score}` : ''} />)}
          </div>
          <small>{f.password ? LEVELS[score] : 'Choose a strong password'}</small>
          <ul>
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(f.password);
              return <li key={r.id} className={ok ? 'ok' : ''}>{ok ? <Check size={13} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />}{r.label}</li>;
            })}
          </ul>
        </div>

        <Field id="confirm" label="Confirm password" error={errors.confirm}>
          <PasswordInput id="confirm" value={f.confirm} onChange={set('confirm')} autoComplete="new-password"
            invalid={!!errors.confirm} describedBy={errors.confirm ? 'confirm-err' : undefined} />
        </Field>

        <div className="field">
          <label className="check-inline check-top">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} aria-invalid={!!errors.agree || undefined} />
            <span>I agree to the terms of use and privacy policy.</span>
          </label>
          {errors.agree && <small className="field-error" role="alert">{errors.agree}</small>}
        </div>

        <p className="auth-note">New accounts start with the Fab Worker role. An administrator can change your role later.</p>
        <SubmitButton busy={busy}>Create account</SubmitButton>
      </form>
    </AuthLayout>
  );
}
