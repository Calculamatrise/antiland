export default class {
	cache = new Map();
	constructor(client) {
		/** @private */
		this.client = client
	}

	fetch(key, { force } = {}) {
		if (!force && this.cache.has(key)) {
			return this.cache.get(key);
		}
	}
}