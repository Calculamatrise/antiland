export default class CacheManager extends Map {
	name = null;
	type = 'temp'; // session

	/**
	 * Create an instance of the cache manager
	 * @param {string} name
	 * @param {object} [options]
	 * @param {boolean} [options.persist] whether to store in localStorage
	 */
	constructor(name, { persist } = {}) {
		if (CacheManager[persist ? 'cache' : 'temp'].has(name)) return CacheManager[persist ? 'cache' : 'temp'].get(name);
		let exists = JSON.parse(window[(persist ? 'local' : 'session') + 'Storage'].getItem(name));
		super(exists && Object.entries(exists) || null);
		this.name = name;
		persist && (this.type = 'persistent');
		Object.defineProperty(this, 'data', { value: exists, writable: true });
		// Object.defineProperty(this, 'proxy', { value: (() => {
		// 	return new Proxy(this.data, {});
		// })(exists || {}), writable: true });
		Object.defineProperty(this, 'type', { writable: false });
		this.constructor[persist ? 'cache' : 'temp'].set(name, this);
	}

	cache() {
		return window[(this.type != 'temp' ? 'local' : 'session') + 'Storage'].setItem(this.name, JSON.stringify(this.data))
	}

	/**
	 * Delete a key or cache
	 * @param {string} [key]
	 * @param {Array} [keys]
	 * @returns {boolean} whether a value has been deleted
	 */
	delete(key, keys) {
		if (typeof key == 'undefined') {
			let exists = null !== this.get();
			return exists && window[(this.type != 'temp' ? 'local' : 'session') + 'Storage'].removeItem(this.name);
		} else if (arguments.length > 1) {
			let value = this.get(key);
			let deleted = false;
			for (let key of keys) {
				deleted = delete value[key];
			}
			return deleted && (this.update(key, value),
			deleted);
		}
		return super.delete(key)
	}

	/**
	 * Retrieve the cached value for a key
	 * @param {string} [key]
	 * @returns {unknown|null}
	 */
	get(key) {
		if (typeof key == 'undefined') {
			return JSON.stringify(window[(this.type != 'temp' ? 'local' : 'session') + 'Storage'].getItem(this.name));
		}
		return super.get(key) ?? null
	}

	/**
	 * Set the value for a key
	 * @param {string} [key]
	 * @param {any} value
	 * @returns {this}
	 */
	set(key, value) {
		if (typeof this.data != 'undefined') {
			if (typeof value == 'undefined') {
				this.data = key;
				super.clear();
				for (let key in this.data) {
					super.set(key, this.data[key]);
				}
				this.cache();
				return this;
			} else {
				typeof this.data === null && (this.data = {});
				this.data[key] = value;
				this.cache();
			}
		}
		return super.set(key, value)
	}

	/**
	 * Update the value for a key
	 * @param {string} key
	 * @param {any} value
	 * @returns {this}
	 */
	update(key, value) {
		if (typeof value == 'undefined') {
			throw new TypeError("Value must be defined");
		}
		null === this.data && (this.data = {});
		return this.set(key, this.data[key] instanceof Object ? Object.merge(this.data[key], value) : value)
	}

	static cache = new Map();
	static temp = new Map();
	static create() {
		return new this(...arguments);
	}
}

Object.defineProperty(Object, 'merge', {
	value: function merge(target, ...sources) {
		if (typeof target == 'undefined') {
			throw new TypeError("Cannot convert undefined or null to object");
		} else if (Array.isArray(target)) {
			target.push(...sources.flat());
			return target;
		}
		for (const source of sources) {
			for (const key in source) {
				if (!source.hasOwnProperty(key)) continue;
				if (typeof target[key] == 'object' && target[key] !== null && typeof source[key] == 'object') {
					Object.merge(target[key], source[key]);
					continue;
				} else if (Array.isArray(target[key]) && Array.isArray(source[key])) {
					target[key] = target[key].concat(source[key]);
					continue;
				}

				target[key] = source[key];
			}
		}

		return target
	},
	writable: true
});