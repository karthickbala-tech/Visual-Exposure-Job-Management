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
		/** Has the file reached storage? (Reads only its details, not the file.) A storage problem other than "not found" is raised, not hidden. */
		async exists(key) {
			try {
				return (await bucket().headObject(key)) === true; // the SDK answers true or false
			} catch (err) {
				const code = String((err && (err.statusCode || err.status || err.code)) || '');
				if (code === '404' || /not.?found|no.?such/i.test(String((err && err.message) || ''))) return false;
				throw err;
			}
		},
		/** The bytes of one stored file (read through a short-lived link). Used by the jobs that copy files to other systems. */
		async getBytes(key) {
			const res = await fetch(await sign(key, 'GET', 120));
			if (!res.ok) throw new Error(`Could not read the stored file (HTTP ${res.status})`);
			return Buffer.from(await res.arrayBuffer());
		},
	};
}

module.exports = { createStorage, bucketName, DEV_BUCKET };
