import User from "./User.js";

export default class Member extends User {
	position = null;
	priority = null;
	constructor(data, dialogue) {
		if (data instanceof Object && dialogue instanceof Object && dialogue.hasOwnProperty('messages')) {
			let id = data.id || data.objectId;
			let entry = dialogue.members.cache.get(id);
			if (entry) {
				entry._patch(data);
				return entry
			}
		}
		super(...arguments, true);
		Object.defineProperties(this, {
			banned: { value: false, writable: true },
		});
		this._patch(data);
		this.id !== null && this.hasOwnProperty('client') && dialogue.members.cache.set(this.id, this)
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'position':
			case 'priority':
				this[key] = data[key]
			}
		}
		return this
	}
}