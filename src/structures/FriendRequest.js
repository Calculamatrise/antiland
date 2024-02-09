import BaseStructure from "./BaseStructure.js";

export default class FriendRequest extends BaseStructure {
	constructor(data) {
		super(...arguments, true);
		this._patch(data);
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'activity':
			case 'age':
			case 'avatar':
			case 'gender':
			case 'isAdmin':
			case 'isInPrison':
			case 'karma':
				this[key] = data[key];
				break;
			case 'profileName':
				this.displayName = data[key];
				this.username = String.prototype.toLowerCase.call(data[key]);
				break;
			case 'user':
				this._patch(data[key])
			}
		}
	}

	accept() {
		return this.client.client.requests.post("functions/v2:contact.mate.accept", {
			userId: this.id
		}) // then cache (this.client is friendManager, fetch and add user to the cache)
	}

	isPaired() {
		return this.client.client.requests.post("functions/v2:contact.mate.isPaired", {
			userId: this.id
		})
	}

	reject() {
		return this.client.client.requests.post("functions/v2:contact.mate.reject", {
			userId: this.id
		})
	}
}