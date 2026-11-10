import { useState } from 'react';
import { useAddSubtask } from '../api/more';
import { Dialog } from './Dialog';
import { useToast } from './toast';

/**
 * The "Add a subtask" popup: one name, saved under the task's main parent. Used by the manage panel and by the
 * right-click menu on a job's task rows.
 */
export function AddSubtaskDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
	const sub = useAddSubtask(taskId);
	const { notify } = useToast();
	const [name, setName] = useState('');
	return (
		<Dialog title="Add a subtask" onClose={onClose}>
			<form
				className="inline-form"
				style={{ background: 'transparent', border: 0, padding: 0 }}
				onSubmit={(e) => {
					e.preventDefault();
					sub.mutate({ name: name.trim() }, {
						onSuccess: () => { notify('Subtask added'); onClose(); },
						onError: (er) => notify(er instanceof Error ? er.message : 'Something went wrong', 'error'),
					});
				}}
			>
				<label>
					<span className="toolbar__label">New subtask</span>
					<input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paint the frames…" />
				</label>
				<button className="btn" disabled={sub.isPending || !name.trim()}>Add subtask</button>
			</form>
		</Dialog>
	);
}
