import BaseStructure from "./BaseStructure.js";
import User from "./User.js";

export default class FriendRequest extends BaseStructure {
	userId = null;
	user = null;
	constructor(data, options) {
		super(...arguments, true),
		Object.defineProperty(this, 'user', { value: data instanceof Object ? new User(data.user || data, options.client) : null, writable: true }),
		this._patch(data)
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'id':
				this.userId = this[key];
				break;
			case 'user':
				this._patch(data[key]),
				this[key]._patch(data[key])
			}
		}
	}

	accept() {
		return this.client.client.requests.post("functions/v2:contact.mate.accept", { userId: this.id }).then(r => {
			return r && (this.client.friends.cache.set(this.userId, this.user),
			this.client.friends.pending.incoming.delete(this.userId))
		})
	}

	reject() {
		return this.client.client.requests.post("functions/v2:contact.mate.reject", { userId: this.id }).then(r => {
			return r && this.client.friends.pending.incoming.delete(this.userId)
		})
	}
}