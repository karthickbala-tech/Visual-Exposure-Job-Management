import { useRef } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { canDeleteAttachment, formatSize } from '../lib/attachments';
import './Attachments.css';

// TSK-5: attachments on one task. Demo: only the file name and size are kept, and WorkDrive sync is simulated.
export default function Attachments({ taskId }) {
  const { attachments, addAttachments, deleteAttachment, role, roleId } = useDemo();
  const input = useRef(null);
  const list = attachments.filter((a) => a.taskId === taskId);

  const onPick = (e) => {
    addAttachments(taskId, [...e.target.files].map((f) => ({ name: f.name, size: f.size })));
    e.target.value = '';
  };

  return (
    <section aria-label="Attachments" className="attach">
      <div className="attach-head">
        <h3 className="mini-title">Attachments ({list.length})</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current && input.current.click()}>
          <Paperclip size={14} aria-hidden="true" /> Add files
        </button>
        <input ref={input} type="file" multiple hidden aria-label="Add attachments" onChange={onPick} />
      </div>
      {list.length === 0 && <p className="muted">No files attached yet.</p>}
      <ul className="attach-list">
        {list.map((a) => (
          <li key={a.id}>
            <div className="stack">
              <strong>{a.name}</strong>
              <small>{formatSize(a.size)} · {a.by} · {a.at}{a.synced ? ' · WorkDrive (demo)' : ''}</small>
            </div>
            {canDeleteAttachment(a, roleId, role.name) && (
              <button type="button" className="icon-btn" aria-label={`Delete ${a.name}`} onClick={() => deleteAttachment(a.id)}><Trash2 size={16} aria-hidden="true" /></button>
            )}
          </li>
        ))}
      </ul>
      <small className="muted">Demo: only file names are kept. Real uploads and the WorkDrive sync need the backend.</small>
    </section>
  );
}
