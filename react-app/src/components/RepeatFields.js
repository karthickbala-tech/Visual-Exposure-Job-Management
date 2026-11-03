import { REPEAT_UNITS } from '../lib/repeat';

// FAB-3: "Repeat every [n] [days/weeks/months]" for a workshop task. An empty number means it does not repeat.
export default function RepeatFields({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <fieldset className="repeat-fields">
      <legend>Repeat (optional)</legend>
      <div className="form-row">
        <label>Repeat every<input type="number" inputMode="numeric" min="1" max="365" value={value.count} onChange={set('count')} placeholder="Does not repeat" /></label>
        <label>Unit<select value={value.unit} onChange={set('unit')}>{REPEAT_UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
      </div>
      <small className="muted">When the task is completed, the next one is created for the old date plus this interval. Months count as 30 days.</small>
    </fieldset>
  );
}
