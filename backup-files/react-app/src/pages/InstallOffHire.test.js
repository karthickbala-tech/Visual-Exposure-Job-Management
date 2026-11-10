import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoProvider, useDemo } from '../context/DemoContext';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let box;
beforeEach(() => { localStorage.setItem('ve-role', 'pm'); box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); localStorage.clear(); });

// Small probe so the test exercises the real provider without the router.
function Probe() {
  const { equipment, tasks, setSubStage } = useDemo();
  const lift = equipment.find((e) => e.id === 'VE - 106');
  const task = tasks.find((t) => t.id === 'I1');
  return (
    <div>
      <span id="lift">{lift.status}</span>
      <span id="hist">{task.history.map((h) => h.text).join('|')}</span>
      <button type="button" id="finish" onClick={() => setSubStage('I1', 'Finished On Site')}>finish</button>
      <button type="button" id="onsite" onClick={() => setSubStage('I1', 'On Site')}>onsite</button>
    </div>
  );
}
const click = (id) => act(() => { box.querySelector(id).dispatchEvent(new MouseEvent('click', { bubbles: true })); });

test('finishing an install on site sends its flagged hired equipment off hire', () => {
  act(() => root.render(<DemoProvider><Probe /></DemoProvider>));
  expect(box.querySelector('#lift').textContent).toBe('In service');
  click('#onsite');
  expect(box.querySelector('#lift').textContent).toBe('In service');
  click('#finish');
  expect(box.querySelector('#lift').textContent).toBe('Off hire');
  expect(box.querySelector('#hist').textContent).toContain('Off hire: VE - 106');
});
