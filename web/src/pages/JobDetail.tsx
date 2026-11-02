import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCreateTask, useJob, useMe, useTransitionTask } from '../api/queries';
import { ApiError } from '../api/client';
import { num } from '../api/types';
import type { Task } from '../api/types';
import { Chip, Progress } from '../components/Chip';
import './Table.css';

const TYPE_LABEL: Record<Task['task_type'], string> = {
	design: 'Design',
	fabrication: 'Fabrication',
	install: 'Install',
};

export function JobDetail() {
	const { id } = useParams();
	const q = useJob(id);
	const me = useMe();
	const move = useTransitionTask(id ?? '');
	const add = useCreateTask(id ?? '');
	const [taskName, setTaskName] = useState('');
	const [taskType, setTaskType] = useState('design');

	if (q.isPending) return <p role="status">Loading job...</p>;
	if (q.error instanceof ApiError && q.error.status === 404) {
		return (
			<>
				<h1 className="page-title">Job not found</h1>
				<p>
					<Link to="/jobs">Back to jobs</Link>
				</p>
			</>
		);
	}
	if (q.isError) return <p role="alert">Could not load this job.</p>;

	const { job, tasks, progress } = q.data;
	const groups = (['design', 'fabrication', 'install'] as const).map((t) => ({
		type: t,
		rows: tasks.filter((x) => x.task_type === t),
	}));

	return (
		<>
			<p>
				<Link to="/jobs">&larr; All jobs</Link>
			</p>
			<h1 className="page-title">{job.name}</h1>
			<p>
				<Chip status={job.stage} />
			</p>
			{job.description && <p className="lead">{job.description}</p>}

			<section aria-label="Progress" className="panel">
				<Progress label="Fab" value={progress.fab} />
				<Progress label="Install" value={progress.install} />
				<Progress label="Job" value={progress.job} />
			</section>

			{move.isError && <p role="alert">{move.error.message}</p>}

			{me.data?.permissions.createTask && (
				<form
					className="inline-form"
					onSubmit={(e) => {
						e.preventDefault();
						add.mutate({ task_type: taskType, name: taskName.trim() }, { onSuccess: () => setTaskName('') });
					}}
				>
					<label>
						<span className="toolbar__label">Type</span>
						<select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
							<option value="design">Design</option>
							<option value="fabrication">Fabrication</option>
							<option value="install">Install</option>
						</select>
					</label>
					<label>
						<span className="toolbar__label">Task name</span>
						<input value={taskName} onChange={(e) => setTaskName(e.target.value)} required maxLength={200} />
					</label>
					<button className="btn" disabled={add.isPending || !taskName.trim()}>
						{add.isPending ? 'Adding...' : 'Add task'}
					</button>
					{add.isError && <p role="alert">{add.error.message}</p>}
				</form>
			)}

			{tasks.length === 0 && <p>This job has no tasks yet.</p>}

			{groups
				.filter((g) => g.rows.length > 0)
				.map((g) => (
					<section key={g.type} className="group">
						<h2 className="group__title">{TYPE_LABEL[g.type]}</h2>
						<div className="table-wrap">
							<table className="table">
								<caption className="sr-only">{TYPE_LABEL[g.type]} tasks</caption>
								<thead>
									<tr>
										<th scope="col">Task</th>
										<th scope="col">Stage</th>
										<th scope="col">Quoted hrs</th>
										<th scope="col">Scheduled</th>
										<th scope="col">Actions</th>
									</tr>
								</thead>
								<tbody>
									{g.rows.map((t) => (
										<tr key={t.ROWID}>
											<td data-label="Task">
												<Link to={'/tasks/' + t.ROWID}>{t.name}</Link>
											</td>
											<td data-label="Stage">
												<Chip status={t.stage} />
											</td>
											<td data-label="Quoted hrs" className="num">
												{num(t.quoted_hours)}
											</td>
											<td data-label="Scheduled">{t.scheduled_date || '-'}</td>
											<td data-label="Actions">
												<div className="actions">
													{(t.nextStages ?? []).map((s) => (
														<button
															key={s}
															className="btn btn-ghost"
															disabled={move.isPending}
															onClick={() => move.mutate({ taskId: t.ROWID, to: s })}
														>
															{s}
														</button>
													))}
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				))}
		</>
	);
}
