import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export function Field({ id, label, error, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-err`} className="field-error" role="alert">{error}</small>}
    </div>
  );
}

export function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete}
        aria-invalid={invalid || undefined} aria-describedby={describedBy} />
      <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export function SubmitButton({ busy, children }) {
  return (
    <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
      {busy ? <><Loader2 size={16} className="spin" aria-hidden="true" /> Please wait</> : children}
    </button>
  );
}
