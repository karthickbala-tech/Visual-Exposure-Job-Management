import { useState } from 'react';
import { Modal, Chip } from './ui';
import { formatShort } from '../lib/dates';

// Records who signed the SWMS as Project Manager (the timestamp is added when it is saved).
export default function SignSwmsDialog({ record, signer, onClose, onSigned }) {
  const [name, setName] = useState(signer.name);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !agree) return setError('Type your full name and tick the declaration to sign.');
    return onSigned({ name: name.trim(), role: signer.label });
  };

  return (
    <Modal title={`Sign ${record.id} as PM`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="sign-summary">
          <strong>{record.title}</strong>
          <small>{record.jobId} · on site {formatShort(record.onSite)}</small>
          <span className="tags">{record.hazards.map((h) => <em key={h}>{h}</em>)}</span>
          <span><Chip value={record.status} /></span>
        </div>
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I have reviewed this SWMS and the controls for each hazard are adequate for the work on site.</span>
        </label>
        <label>Type your full name to sign
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Sign as PM</button>
        </div>
      </form>
    </Modal>
  );
}
