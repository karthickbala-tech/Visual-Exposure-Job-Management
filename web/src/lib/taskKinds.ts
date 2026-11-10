/** Task kinds by type and the fabrication spec fields, from the demo app and the backend's lib/domain/fab.js (keep them in step). */
export type TaskType = 'design' | 'fabrication' | 'install';

export const TASK_KINDS: Record<TaskType, string[]> = {
	design: ['Artwork Sign Off', 'Install Plan', 'LED Design', 'Manufacturing Sign Off', 'Proof Of Posting', 'Project Management'],
	fabrication: ['CCV', 'CNC', 'CLB', 'General/Pack', 'Metal', 'Paint', 'LED'],
	install: ['VE Install', 'VE Subtask', 'Minor Task', 'External Install', 'Print Only'],
};

export interface SpecField { key: string; label: string; type: 'text' | 'number' }
export const SPEC_FIELDS: Record<string, SpecField[]> = {
	CCV: [
		{ key: 'material', label: 'Vinyl / material', type: 'text' },
		{ key: 'colour', label: 'Colour', type: 'text' },
		{ key: 'width_mm', label: 'Width (mm)', type: 'number' },
		{ key: 'height_mm', label: 'Height (mm)', type: 'number' },
		{ key: 'quantity', label: 'Quantity', type: 'number' },
	],
	CNC: [
		{ key: 'material', label: 'Material', type: 'text' },
		{ key: 'thickness_mm', label: 'Thickness (mm)', type: 'number' },
		{ key: 'width_mm', label: 'Width (mm)', type: 'number' },
		{ key: 'height_mm', label: 'Height (mm)', type: 'number' },
		{ key: 'quantity', label: 'Quantity', type: 'number' },
	],
	CLB: [
		{ key: 'letter_height_mm', label: 'Letter height (mm)', type: 'number' },
		{ key: 'depth_mm', label: 'Return depth (mm)', type: 'number' },
		{ key: 'illumination', label: 'Illumination', type: 'text' },
		{ key: 'quantity', label: 'Quantity', type: 'number' },
	],
};

export const parseSpec = (v: unknown): Record<string, unknown> => {
	try {
		const o = typeof v === 'string' ? JSON.parse(v) : v;
		return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
	} catch {
		return {};
	}
};
