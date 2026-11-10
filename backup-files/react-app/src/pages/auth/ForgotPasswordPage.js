import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isEmail } from '../../lib/authStore';
import AuthLayout from './AuthLayout';
import { Field, SubmitButton } from './fields';

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) { setError('Enter a valid email address.'); return; }
    setError('');
    setBusy(true);
    await requestPasswordReset(email);
    setBusy(false);
    setSent(true);
  };

  return (
    <AuthLayout eyebrow="Account help" title="Reset your password"
      subtitle={sent ? undefined : 'Enter your email and we will send you a link to choose a new password.'}
      footer={<Link to="/login">Back to sign in</Link>}>
      {sent ? (
        <div className="auth-sent" role="status">
          <MailCheck size={28} aria-hidden="true" />
          <p>If an account exists for <strong>{email.trim()}</strong>, we have sent instructions to reset the password.</p>
          <small>Demo build: no email is actually sent. Real reset emails come with the Catalyst sign-in.</small>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <Field id="email" label="Email" error={error}>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus
              aria-invalid={!!error || undefined} aria-describedby={error ? 'email-err' : undefined} />
          </Field>
          <SubmitButton busy={busy}>Send reset link</SubmitButton>
        </form>
      )}
    </AuthLayout>
  );
}
