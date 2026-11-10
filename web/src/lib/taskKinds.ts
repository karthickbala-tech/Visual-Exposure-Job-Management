/** Task kinds by type and the fabrication spec fields, from the demo app and the backend's lib/domain/fab.js (keep them in step). */
export type TaskType = 'design' | 'fabrication' | 'install';

export const TASK_KINDS: Record<TaskType, string[]> = {
	design: ['Artwork Sign Off', 'Install Plan', 'LED Design', 'Manufacturing Sign Off', 'Proof Of Posting', 'Project Management'],
	fabrication: ['CCV', 'CNC Laser', 'CNC Router', 'CLB', 'General', 'Metal', 'Paint', 'LED', 'Pack'],
	install: ['VE Install', 'VE Subtask', 'Minor Task', 'External Install', 'Print Only'],
};

export interface SpecField { key: string; label: string; type: 'text' | 'number' }
export const SPEC_FIELDS: Record<string, SpecField[]> = {
	CCV: [
		{ key: 'material', label: 'Vinyl / material', type: 'text' },
		{ key: 'colour', label: 'Colour', type: 'text' },
		{ key: 'width_mm', label: 'Width (mm)', type: 'number' },
		{ key: 'height_mm', label: 'Height (mm)', type: 'number' },
		{ key: 'artwork_pct', label: 'Artwork %', type: 'text' },
		{ key: 'quantity', label: 'Qty', type: 'number' },
		{ key: 'reverse_cut', label: 'Reverse Cut?', type: 'text' },
		{ key: 'reverse_weed', label: 'Reverse Weed?', type: 'text' },
		{ key: 'vinyl_brand_1', label: 'Vinyl Brand #1', type: 'text' },
		{ key: 'vinyl_brand_2', label: 'Vinyl Brand #2', type: 'text' },
		{ key: 'vinyl_brand_3', label: 'Vinyl Brand #3', type: 'text' },
		{ key: 'colour_code_1', label: 'Vinyl Colour/Code #1', type: 'text' },
		{ key: 'colour_code_2', label: 'Vinyl Colour/Code #2', type: 'text' },
		{ key: 'colour_code_3', label: 'Vinyl Colour/Code #3', type: 'text' },
	],
	CNC: [
		{ key: 'material', label: 'Material', type: 'text' },
		{ key: 'thickness_mm', label: 'Material Thickness (mm)', type: 'number' },
		{ key: 'width_mm', label: 'Width (mm)', type: 'number' },
		{ key: 'height_mm', label: 'Height (mm)', type: 'number' },
		{ key: 'artwork_pct', label: 'Artwork %', type: 'text' },
		{ key: 'quantity', label: 'Qty', type: 'number' },
		{ key: 'intracut_female', label: 'Intracut Part - Female', type: 'text' },
		{ key: 'intracut_male', label: 'Intracut Part - Male', type: 'text' },
	],
	CLB: [
		{ key: 'width_mm', label: 'Width (mm)', type: 'number' },
		{ key: 'height_mm', label: 'Height (mm)', type: 'number' },
		{ key: 'artwork_pct', label: 'Artwork %', type: 'text' },
		{ key: 'return_material', label: 'CLB Return Material', type: 'text' },
		{ key: 'return_height', label: 'Return Height', type: 'text' },
		{ key: 'letter_height_mm', label: 'Letter height (mm)', type: 'number' },
		{ key: 'depth_mm', label: 'Return depth (mm)', type: 'number' },
		{ key: 'illumination', label: 'Illumination', type: 'text' },
		{ key: 'quantity', label: 'Qty', type: 'number' },
	],
};
SPEC_FIELDS['CNC Laser'] = SPEC_FIELDS.CNC;
SPEC_FIELDS['CNC Router'] = SPEC_FIELDS.CNC;

export const parseSpec = (v: unknown): Record<string, unknown> => {
	try {
		const o = typeof v === 'string' ? JSON.parse(v) : v;
		return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
	} catch {
		return {};
	}
};
