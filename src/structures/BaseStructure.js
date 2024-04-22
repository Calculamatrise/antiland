export default class {
	id = null;
	constructor(data, options, ignoreUpdate) {
		if (typeof options == 'object' && options != null)
			options.hasOwnProperty('client') && Object.defineProperty(this, 'client', { value: options.client });
		Object.defineProperties(this, {
			createdAt: { value: null, writable: true },
			createdTimestamp: { value: null, writable: true }
		});
		ignoreUpdate || this._patch(...arguments)
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		for (let key of Object.getOwnPropertyNames(data).filter(key => {
			let descriptor = Object.getOwnPropertyDescriptor(this, key);
			return !descriptor || descriptor.writable;
		})) {
		// for (let key in data) {
			switch (key) {
			case 'body':
			case 'header':
				this._patch(data[key]);
				break;
			case 'created':
				this._patch({ createdAt: data[key] });
				break;
			case 'createdAt':
			case 'updatedAt':
				if (this[key] !== null) break;
				if (typeof data[key] == 'object' && data[key] != null) {
					this._patch({ [key]: data[key].iso });
					break;
				}
				Object.defineProperty(this, key, { value: new Date(data[key]), writable: true });
				Object.defineProperty(this, key.replace(/[A-Z].+/, '') + 'Timestamp', {
					value: this[key].getTime(),
					writable: true
				});
				break;
			case 'objectId':
				this._patch({ id: data[key] });
				break;
			case 'id':
			case 'type':
				this[key] = data[key]
			}
		}
	}

	async fetch() { return this }
	static from(instance) {
		let temp = new this(instance, { client: instance.client });
		for (let key of Object.getOwnPropertyNames(instance)) {
			let descriptor = Object.getOwnPropertyDescriptor(temp, key);
			if (!descriptor || !descriptor.writable) continue;
			if (instance[key] === null || (temp[key] !== null && temp[key].constructor !== instance[key].constructor)) continue;
			temp[key] = instance[key];
		}
		return temp;
	}
}