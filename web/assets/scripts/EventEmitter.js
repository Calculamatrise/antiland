export default class {
	/** @private */
	#events = new Map();
	#temp = new WeakSet();

	/**
	 * Emit an event to trigger listeners
	 * @param {String} event 
	 * @param  {...any} [args] 
	 */
	emit(event, ...args) {
		const listeners = this.#events.get(event) || new Set();
		if (typeof this['on' + event] == 'function') {
			listeners.add(this['on' + event]);
		}

		for (const listener of listeners) {
			listener.apply(this, args);
			if (this.#temp.delete(listener)) {
				listeners.delete(listener);
			}
		}
	}

	/**
	 * Emits several events
	 * @param {Array<String>} events 
	 * @param {...any} [args] 
	 */
	emits(events, ...args) {
		if (!(events instanceof Array)) {
			throw new TypeError("Events must be of type: Array<String>");
		}

		events.forEach(event => this.emit(event, ...args));
	}

	/**
	 * 
	 * @param {string} event 
	 * @param {function} listener 
	 * @param {object} [options] 
	 * @param {boolean} [options.once] 
	 * @returns {number}
	 */
	on(event, listener, options = {}) {
		if (typeof event != 'string') {
			throw new TypeError("Event must be of type: String");
		} else if (typeof listener != 'function') {
			throw new TypeError("Listener must be of type: Function");
		} else if (typeof options != 'object') {
			throw new TypeError("Options must be of type: Object")
		} else if (options.once) {
			this.#temp.add(listener);
		}

		if (!this.#events.has(event)) {
			this.#events.set(event, new Set());
		}

		const events = this.#events.get(event);
		return events.add(listener),
			events.size;
	}

	/**
	 * 
	 * @param {String} event 
	 * @param {Function} listener 
	 * @returns {Function}
	 */
	once(event, listener) {
		return this.on(event, listener, { once: true });
	}

	/**
	 * 
	 * @param {String} event 
	 * @returns {Set}
	 */
	listeners(event) {
		return this.#events.get(event) || new Set();
	}

	/**
	 * 
	 * @param {String} event 
	 * @returns {Number}
	 */
	listenerCount(event) {
		return this.listeners(event).size;
	}

	/**
	 * 
	 * @param {String} event 
	 * @param {Function} listener 
	 * @returns {Boolean}
	 */
	removeListener(event, listener) {
		if (typeof event != 'string') {
			throw new TypeError("Event must be of type: String");
		}

		const listeners = this.#events.get(event);
		if (listeners !== void 0) {
			listeners.delete(listener);
		}

		return true;
	}

	/**
	 * 
	 * @param {String} event 
	 * @returns {Boolean}
	 */
	removeAllListeners(event) {
		if (typeof event != 'string') {
			throw new TypeError("Event must be of type: String");
		}

		return this.#events.delete(event);
	}
}