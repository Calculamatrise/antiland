import Base from "../structures/Base.js";

export default class extends Base {
	cache = new Map();
	constructor(client) {
		Object.defineProperty(super(client), 'cache', { enumerable: false })
	}

	async fetch(key, { force } = {}) {
		if (!force && this.cache.has(key)) {
			return this.cache.get(key)
		}
	}

	*[Symbol.iterator]() {
		for (const entry of this.cache.entries()) {
			yield entry
		}
	}

	async *[Symbol.asyncIterator]() {
		await this.fetch();
		for (const entry of this.cache.entries()) {
			yield entry
		}
	}
}