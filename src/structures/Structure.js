export default class {
	createdAt = null;
	id = null;
	constructor(data, options, ignoreUpdate) {
		if (typeof options == 'object' && options != null)
			options.hasOwnProperty('client') && (this.client = options.client);
		ignoreUpdate || this._update(...arguments);
	}

	_update(data) {
		if (typeof data != 'object' || data == null) return;
		for (let key in data) {
			switch (key) {
			case 'body':
			case 'header':
				this._update(data[key]);
				break;
			case 'created':
				this._update({ createdAt: data[key] });
				break;
			case 'createdAt':
			case 'updatedAt':
				if (typeof data[key] == 'object' && data[key] != null) {
					this[key] = new Date(data[key].iso)
					break;
				}
				this[key] = new Date(data[key])
				break;
			case 'objectId':
				this._update({ id: data[key] });
				break;
			case 'id':
			case 'type':
				this[key] = data[key];
			}
		}
	}
}