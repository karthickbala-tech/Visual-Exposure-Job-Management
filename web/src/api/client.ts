/**
 * The only module that talks to the backend. Everything else uses the hooks in queries.ts.
 * The API returns { success: true, data } or { success: false, error }.
 */
const BASE = import.meta.env.VITE_API_BASE ?? '/server/api';

export class ApiError extends Error {
	status: number;
	code: string;
	details?: unknown;

	constructor(status: number, code: string, message: string, details?: unknown) {
		super(message);
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

type Envelope<T> =
	| { success: true; data: T }
	| { success: false; error: { code: string; message: string; details?: unknown } };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
	const res = await fetch(`${BASE}${path}`, {
		credentials: 'include',
		headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
		...init,
	});

	let body: Envelope<T>;
	try {
		body = (await res.json()) as Envelope<T>;
	} catch {
		throw new ApiError(res.status, 'bad_response', 'The server sent an unreadable response');
	}

	if (!body.success) {
		throw new ApiError(res.status, body.error.code, body.error.message, body.error.details);
	}
	return body.data;
}
