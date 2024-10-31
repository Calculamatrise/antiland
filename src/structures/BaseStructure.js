export default class {
	id = null;
	constructor(data, options, ignoreUpdate) {
		if (typeof options == 'object' && options != null)
			options.hasOwnProperty('client') && Object.defineProperty(this, 'client', { value: options.client });
		Object.defineProperties(this, {
			createdAt: { value: null, writable: true },
			createdTimestamp: { value: null, writable: true },
			partial: { value: Object.keys(data).filter(key => this.hasOwnProperty(key)).length < Object.keys(this).length, writable: true }
		}),
		ignoreUpdate || this._patch(...arguments)
	}

	_filterData(data, deep) {
		return Object[deep ? 'getOwnPropertyNames' : 'keys'](data).filter(property => {
			let descriptor = Object.getOwnPropertyDescriptor(this, property);
			return !descriptor || descriptor.writable
		})
	}

	_filterNullOrUndefined(data, deep) {
		return Object.fromEntries(Object.entries(data).filter(([, value]) => {
			return typeof value != 'undefined' && value !== null
		}))
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		for (let key of this._filterData(data, true)) {
			// if (data[key] === null) {
			// 	delete data[key];
			// 	continue;
			// }
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
				if (this[key] !== null && typeof this[key] != 'undefined') break;
				Object.defineProperty(this, key, { enumerable: true, value: data[key], writable: false })
			}
		}

		this.partial && Object.values(this).filter(v => v === null).length < 3 && (this.partial = false)
	}

	async fetch() { return this.partial = false, this }
	static from(instance) {
		let temp = new this(instance, { client: instance.client });
		for (let key of Object.getOwnPropertyNames(instance)) {
			let descriptor = Object.getOwnPropertyDescriptor(temp, key);
			if (!descriptor || !descriptor.writable) continue;
			if (instance[key] === null || (temp[key] !== null && temp[key].constructor !== instance[key].constructor)) continue;
			temp[key] = instance[key];
		}
		return temp
	}
}