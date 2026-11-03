'use strict';

const { z } = require('zod');
const { badRequest } = require('./errors');

/** Parse `input` with a zod schema; throw a 400 with field details on failure. */
function parse(schema, input) {
	const result = schema.safeParse(input);
	if (!result.success) {
		throw badRequest(
			'Validation failed',
			result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
		);
	}
	return result.data;
}

/** Common building blocks. */
const schemas = {
	/** Catalyst ROWIDs are long numeric strings. */
	rowId: z.string().regex(/^\d{10,20}$/, 'Invalid id'),
	pagination: z.object({
		limit: z.coerce.number().int().min(1).max(300).default(50),
		offset: z.coerce.number().int().min(0).default(0),
	}),
};

module.exports = { z, parse, schemas };
