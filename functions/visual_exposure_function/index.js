'use strict';

const { IncomingMessage, ServerResponse } = require("http");
const { zcAuth } = require("@zcatalyst/auth");
const { Cache } = require("@zcatalyst/cache");

/**
 * 
 * @param {IncomingMessage} req 
 * @param {ServerResponse} res 
 */
module.exports = async (req, res) => {
	var url = req.url;

	const auth = await zcAuth.init(req);

	switch (url) {
		case '/':
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.write('<h1>Hello from index.js<h1>');
			break;
		case '/cache':
			// Initialize cache and get all segments
			const cache = new Cache();

			// Get all cache segments
			const cacheResponse = await cache.getAllSegment();
			console.log('Cache Response:', cacheResponse);

			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.write(JSON.stringify(cacheResponse));
			break;
		default:
			res.writeHead(404);
			res.write('You might find the page you are looking for at "/" path');
			break;
	}
	res.end();
};