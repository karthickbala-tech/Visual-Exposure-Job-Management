import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { api } from '../api/client';
import { pdfUrl, useSaveSettings, useSettings } from '../api/more';
import { useToast } from '../components/toast';
import { useConfirm } from '../components/Messages';
import { Card } from '../components/ui';

const EXPORTS = [
	{ key: 'jobs', label: 'Jobs' },
	{ key: 'people', label: 'People' },
	{ key: 'companies', label: 'Companies' },
	{ key: 'issues', label: 'Issues' },
];
const PER_REQUEST = 50; // the server's limit
const ROLE_KEYS = ['admin', 'project_manager', 'fab_manager', 'install_coordinator', 'second_ic', 'installer', 'fab_worker', 'workshop', 'designer', 'contractor', 'viewer'];

type Kind = 'people' | 'companies';
interface Result { created: number; skipped: { row: number; reason: string }[] }
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/** A small CSV reader: commas, double quotes, and quotes inside quotes. Blank lines are ignored. */
function parseCsv(text: string): string[][] {
	const out: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	const src = text.replace(/^﻿/, '');
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (quoted) {
			if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
			else if (c === '"') quoted = false;
			else cell += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') { row.push(cell); cell = ''; }
		else if (c === '\n' || c === '\r') {
			if (c === '\r' && src[i + 1] === '\n') i++;
			row.push(cell);
			cell = '';
			if (row.some((x) => x.trim() !== '')) out.push(row);
			row = [];
		} else cell += c;
	}
	row.push(cell);
	if (row.some((x) => x.trim() !== '')) out.push(row);
	return out;
}

/** Turn CSV rows (with a header line) into the objects the server expects; empty cells are left out. */
function toObjects(kind: Kind, grid: string[][]): Record<string, unknown>[] {
	const [head, ...rest] = grid;
	if (!head) return [];
	const keys = head.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
	return rest.map((r) => {
		const o: Record<string, unknown> = {};
		keys.forEach((k, i) => {
			const v = (r[i] ?? '').trim();
			if (!k || v === '') return;
			if (kind === 'people' && k === 'roles') o.roles = v.split(/[;|]/).map((x) => x.trim().toLowerCase().replace(/\s+/g, '_')).filter((x) => ROLE_KEYS.includes(x));
			else o[k] = v;
		});
		return o;
	});
}

const useImport = (kind: Kind) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (rows: Record<string, unknown>[]) => {
			const total: Result = { created: 0, skipped: [] };
			for (let i = 0; i < rows.length; i += PER_REQUEST) {
				const r = await api<Result>(`/admin/import/${kind}`, { method: 'POST', body: JSON.stringify({ rows: rows.slice(i, i + PER_REQUEST) }) });
				total.created += r.created;
				total.skipped.push(...r.skipped.map((s) => ({ ...s, row: s.row + i })));
			}
			return total;
		},
		onSuccess: () => { void qc.invalidateQueries({ queryKey: [kind === 'people' ? 'people' : 'companies'] }); },
	});
};

function ImportBox({ kind }: { kind: Kind }) {
	const [text, setText] = useState('');
	const [result, setResult] = useState<Result | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const run = useImport(kind);
	const { notify } = useToast();
	const rows = text.trim() ? toObjects(kind, parseCsv(text)) : [];
	const header = kind === 'people' ? 'first_name,last_name,email,phone,person_kind,job_title,roles' : 'name,kind,state,notes';
	return (
		<div className="data-box">
			<h3>Import {kind === 'people' ? 'people' : 'companies'}</h3>
			<p className="muted">First line is the heading: <code>{header}</code>. {kind === 'people' ? 'Roles are separated by semicolons.' : 'Kind is subcontractor, supplier, client or internal.'} Existing {kind === 'people' ? 'emails' : 'names'} are skipped, never changed.</p>
			<div className="actions">
				<input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then((t) => { setText(t); setResult(null); }); e.target.value = ''; }} />
				<button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><Upload size={14} aria-hidden="true" /> Choose a CSV file</button>
			</div>
			<textarea rows={5} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} placeholder={header} aria-label={`CSV for ${kind}`} spellCheck={false} />
			<div className="actions">
				<button className="btn" disabled={rows.length === 0 || run.isPending} onClick={() => run.mutate(rows, { onSuccess: (r) => { setResult(r); notify(`${r.created} added, ${r.skipped.length} skipped`); }, onError: (e) => notify(errText(e), 'error') })}>
					{run.isPending ? 'Importing…' : rows.length ? `Import ${rows.length} row${rows.length === 1 ? '' : 's'}` : 'Import'}
				</button>
			</div>
			{result && result.skipped.length > 0 && (
				<ul className="plain-list" aria-label="Skipped rows">
					{result.skipped.map((s, i) => <li key={i}>Row {s.row}: {s.reason}</li>)}
				</ul>
			)}
		</div>
	);
}

/** Admin "Data" tab: download lists, bring people and companies in from a CSV, and back up or restore the settings. */
export function DataTab() {
	const settings = useSettings();
	const save = useSaveSettings();
	const { notify } = useToast();
	const confirm = useConfirm();
	const fileRef = useRef<HTMLInputElement>(null);

	const backup = () => {
		const blob = new Blob([JSON.stringify(settings.data?.settings ?? {}, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `settings-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};
	const restore = async (file: File) => {
		try {
			const parsed: unknown = JSON.parse(await file.text());
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('This is not a settings file.');
			if (!(await confirm({ message: 'Replace the current settings with the ones in this file? The current settings will be overwritten.', confirmLabel: 'Replace settings', danger: true }))) return;
			save.mutate(parsed as never, { onSuccess: () => notify('Settings restored'), onError: (e) => notify(errText(e), 'error') });
		} catch (e) {
			notify(e instanceof SyntaxError ? 'That file is not valid JSON.' : errText(e), 'error');
		}
	};

	return (
		<>
			<Card title="Download lists">
				<p className="muted">Each list opens as a CSV file for a spreadsheet.</p>
				<div className="actions">
					{EXPORTS.map((x) => (
						<a key={x.key} className="btn btn-ghost" href={pdfUrl(`/admin/export/${x.key}`)} download><Download size={14} aria-hidden="true" /> {x.label}</a>
					))}
				</div>
			</Card>
			<Card title="Bring data in">
				<ImportBox kind="people" />
				<ImportBox kind="companies" />
			</Card>
			<Card title="Settings backup">
				<p className="muted">Save the current settings as a file, or put a saved file back.</p>
				<div className="actions">
					<button className="btn btn-ghost" onClick={backup} disabled={!settings.isSuccess}><Download size={14} aria-hidden="true" /> Download settings</button>
					<input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
					<button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={save.isPending}><Upload size={14} aria-hidden="true" /> Restore from a file</button>
				</div>
			</Card>
		</>
	);
}
