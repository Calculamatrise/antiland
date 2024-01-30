import Structure from "./Structure.js";
import Dialogue from "./Dialogue.js";
import FriendManager from "../managers/ClientFriendManager.js";

export default class User extends Structure {
	dialogue = null;
	dialogueId = null;
	displayName = null;
	friends = new FriendManager(this);
	username = null;
	constructor(data) {
		super(...arguments, true);
		if (this.hasOwnProperty('client')) {
			super._update(data);
			let entry = this.client.users.cache.get(this.id);
			if (entry) {
				entry._update(data);
				return entry
			}

			this.id !== null && this.client.users.cache.set(this.id, this)
		}

		this._update(data)
	}

	_update(data) {
		if (typeof data != 'object' || data == null) return;
		super._update(...arguments);
		for (let key in data) {
			switch (key) {
			case 'aboutMe':
				this.description = data[key];
				break;
			case 'activity':
			case 'age':
			case 'badgeColor':
			case 'blocked':
			case 'color':
			case 'gender':
			case 'isAdmin':
			case 'isInPrison':
			case 'isVIP':
			case 'karma':
			case 'karmaWallArtifacts':
			case 'minKarma':
			case 'username':
			case 'views':
				this[key] = data[key];
				break;
			case 'artifacts':
				this[key] ||= data[key];
				break;
			case 'avatar': // https://gfx.antiland.com/avatars/8
			case 'mood':
				this[key] ||= {};
				if (typeof data[key] == 'object') {
					for (let prop in data[key]) {
						switch (prop) {
						case 'accs':
							this[key].accessories = new Set([key][prop]);
							break;
						case 'idx':
							this[key].id = data[key][prop];
							break;
						default:
							this[key][prop] = data[key][prop];
						}
					}
					break;
				}
				Object.assign(this[key], { id: data[key] });
				break;
			case 'blessed':
			case 'doubleKarma':
			case 'hideVisits':
			case 'highlightPrivates':
			case 'showOnline':
				this.superPowers ||= {};
				this.superPowers[key] = data[key];
				break;
			case 'features':
				let counters = data[key] instanceof Object && data[key].counters;
				if (!counters) break;
				for (let key in counters) {
					switch(key) {
						case 'likes':
							this.likesReceived = counters[key];
					}
				}
				break;
			case 'friendsCount':
				this.friendCount = data[key];
				break;
			case 'whom':
				this.blocked = true;
			case 'by':
				this.id = data[key];
				break;
			case 'interests':
				this.interests ||= {};
				for (let interest in data[key]) {
					switch (interest) {
					case 'allow':
					case 'categories':
						this.interests.categories = new Set(Array.isArray(data[key][interest]) ? data[key][interest] : data[key][interest].allow);
						break;
					case 'deny':
						break;
					default:
						this.interests[interest] = data[key][interest];
					}
				}
				break;
			case 'profileName':
				this.displayName = data[key];
				this.username ||= this.displayName.replace(/\s[🚺🚹]+$/, match => (this.gender ||= (match.endsWith('🚺') ? 'FE' : '') + 'MALE', '')).toLowerCase()
			}
		}
		return this
	}

	avatarURL() {
		if (!this.avatar) return null;
		return "https://gfx.antiland.com/avatars/" + this.avatar.id
	}

	checkRating({ force } = {}) {
		if (!force && this.averageRating !== null) {
			return this.averageRating
		}
		return this.client.requests.post("functions/v2:profile.rating", {
			userId: this.id
		}).then(r => this.averageRating = r)
	}

	async getPrivateChat({ createIfNotExists = false }) {
		return this.client.requests.post("functions/v2:chat.getPrivate", {
			createIfNotExists,
			userId: this.id
		}).then(r => {
			let dialogue = new Dialogue(r, this);
			return dialogue && (this.dialogue = dialogue,
			this.dialogueId = dialogue.id),
			dialogue
		}).catch(err => {
			if (!createIfNotExists) {
				return null
			}
			throw err
		})
	}
}