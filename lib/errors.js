'use strict';

/** An error that maps cleanly to an HTTP response. */
class AppError extends Error {
	constructor(status, code, message, details) {
		super(message);
		this.name = 'AppError';
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

const unauthenticated = (msg = 'Sign in required') => new AppError(401, 'unauthenticated', msg);
const forbidden = (msg = 'You do not have access to this') => new AppError(403, 'forbidden', msg);
const notFound = (msg = 'Not found') => new AppError(404, 'not_found', msg);
const badRequest = (msg, details) => new AppError(400, 'bad_request', msg, details);

module.exports = { AppError, unauthenticated, forbidden, notFound, badRequest };
