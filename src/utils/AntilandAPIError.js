export default class AntilandAPIError extends Error {
	/**
	 * 
	 * @param {string} message
	 * @param {object} [options]
	 * @param {object} [options.body]
	 * @param {number} [options.code]
	 * @param {string} [options.endpoint]
	 * @param {string} [options.method]
	 */
	constructor(message, { body, code, endpoint, method } = {}) {
		super(message);
		Object.defineProperty(this, 'body', { value: body || {} });
		Object.defineProperty(this, 'code', { value: code ?? null });
		Object.defineProperty(this, 'endpoint', { value: endpoint || null });
		Object.defineProperty(this, 'method', { value: method || 'GET' });
	}
}