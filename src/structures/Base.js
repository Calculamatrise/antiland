export default class {
	constructor(client) {
		/**
		 * The client that instantiated this Manager
		 * @name BaseManager#client
		 * @type {Client}
		 * @readonly
		 */
		Object.defineProperty(this, 'client', { value: client || null })
	}

	fetch() {}
}