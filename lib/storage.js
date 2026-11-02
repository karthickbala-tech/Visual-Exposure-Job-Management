'use strict';

/**
 * Object storage (Catalyst Stratus) behind a tiny interface so services can be tested
 * without it: { signedPut(key, seconds), signedGet(key, seconds) } -> URL string.
 * The bucket name comes from the STRATUS_BUCKET environment variable; the development
 * bucket is the fallback so local runs work. Production must set the variable.
 */
const DEV_BUCKET = 've-files-dev';
const bucketName = () => process.env.STRATUS_BUCKET || DEV_BUCKET;

function createStorage(app) {
	const bucket = () => app.stratus().bucket(bucketName());
	const sign = async (key, action, seconds) => {
		const res = await bucket().generatePreSignedUrl(key, action, { expiryIn: seconds });
		return res.signature;
	};
	return {
		signedPut: (key, seconds = 300) => sign(key, 'PUT', seconds),
		signedGet: (key, seconds = 300) => sign(key, 'GET', seconds),
	};
}

module.exports = { createStorage, bucketName, DEV_BUCKET };
