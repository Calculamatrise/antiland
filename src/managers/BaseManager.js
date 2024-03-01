export default class {
	cache = new Map();
	constructor(client) {
		/**
		 * The client that instantiated this Manager
		 * @name BaseManager#client
		 * @type {Client}
		 * @readonly
		 */
		Object.defineProperty(this, 'client', { value: client })
	}

	async fetch(key, { force } = {}) {
		if (!force && this.cache.has(key)) {
			return this.cache.get(key);
		}
	}
}