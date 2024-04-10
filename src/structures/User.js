import BaseStructure from "./BaseStructure.js";
import Dialogue from "./Dialogue.js";
import FriendManager from "../managers/ClientFriendManager.js";

export default class User extends BaseStructure {
	activity = null;
	age = null;
	displayName = null;
	friends = new FriendManager(this);
	gender = null;
	isAdmin = false;
	isInPrison = false;
	isVIP = false;
	karma = null;
	minKarma = null;
	username = null;
	constructor(data, options, isMember) {
		if (data instanceof User) return data;
		if (!isMember && data instanceof Object && options instanceof Object && options.hasOwnProperty('client')) {
			let id = data.id || data.objectId;
			let entry = options.client.users.cache.get(id);
			if (entry) {
				entry._patch(data);
				return entry
			}
		}
		super(...arguments, true);
		Object.defineProperties(this, {
			blocked: { value: false, writable: true },
			dmChannel: { value: null, writable: true },
			humanLink: { value: null, writable: true }
		});
		isMember || this._patch(data);
		this.id !== null && this.hasOwnProperty('client') && this.client.users.cache.set(this.id, this)
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'aboutMe':
				this.description = data[key];
				break;
			case 'activity':
			case 'age':
			case 'gender':
			case 'isAdmin':
			case 'isInPrison':
			case 'isVIP':
			case 'karma':
			case 'karmaWallArtifacts':
			case 'minKarma':
			case 'views':
				this[key] = data[key];
				break;
			case 'artifacts':
				if (this[key] instanceof Object) {
					Object.assign(this[key], data[key]);
					break;
				}
				this[key] = data[key];
				break;
			case 'avatar': // https://gfx.antiland.com/avatars/8
			case 'mood':
				this[key] ||= {};
				if (typeof data[key] == 'object') {
					for (let prop in data[key]) {
						switch (prop) {
						case 'accs':
							this[key].accessories = new Set(data[key][prop]);
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
				if (typeof counters != 'object') break;
				for (let key in counters) {
					switch(key) {
					case 'accs':
						this.accessoriesOwned = counters[key];
						break;
					case 'avatars':
						this.avatarsOwned = counters[key];
						break;
					case 'likes':
						this.likesReceived = counters[key];
						break;
					case 'views':
						this[key] = counters[key]
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
			case 'humanLink':
				Object.defineProperty(this, key, { value: data[key], writable: false });
				break;
			case 'interests':
				this[key] ||= {};
				for (let interest in data[key]) {
					switch (interest) {
					case 'allow':
					case 'categories':
						this[key].categories = new Set(Array.isArray(data[key][interest]) ? data[key][interest] : data[key][interest].allow);
						break;
					case 'deny':
						break;
					default:
						this[key][interest] = data[key][interest];
					}
				}
				break;
			case 'profileName':
				this.displayName = data[key];
				this.username ||= this.displayName.replace(/\s[👩🚺🚹]+$/, match => (this.gender ||= (match.endsWith('🚹') ? '' : 'FE') + 'MALE', '')).toLowerCase()
			}
		}
		return this
	}

	avatarURL() {
		if (!this.avatar) return null;
		return "https://gfx.antiland.com/avatars/" + this.avatar.id
	}

	block() {
		return this,client.user.contacts.block(this.id)
	}

	/**
	 * Check the user ratings for this user
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<number>}
	 */
	async checkRating({ force } = {}) {
		if (!force && this.averageRating !== null) {
			return this.averageRating
		}
		return this.client.requests.post("functions/v2:profile.rating", {
			userId: this.id
		}).then(r => this.averageRating = r)
	}

	/**
	 * Create a DM with this user
	 * @returns {Promise<Dialogue>}
	 */
	createDM() {
		return this.client.requests.post("functions/v2:chat.createPrivate", {
			userId: this.id
		}).then(data => {
			return Object.defineProperty(this, 'dmChannel', {
				value: new Dialogue(data, this),
				writable: false
			}),
			this.dmChannel
		})
	}

	/**
	 * Fetch this user
	 * @param {boolean} [force]
	 * @returns {Promise<this>}
	 */
	async fetch(force) {
		if (!force && !Object.values(this).includes(null)) {
			return this;
		}
		return this.client.requests.post("functions/v2:profile.byId", {
			userId: this.id
		}).then(this._patch.bind(this))
	}

	/**
	 * Fetch an active DM, or create a DM with this user
	 * @param {object} [options]
	 * @param {boolean} [options.createIfNotExists]
	 * @returns {Promise<Dialogue>}
	 */
	async fetchDM({ createIfNotExists = false } = {}) {
		if (!createIfNotExists && this.dmChannel) {
			return this.dmChannel;
		}
		return this.client.requests.post("functions/v2:chat.getPrivate", {
			createIfNotExists,
			userId: this.id
		}).then(data => {
			return data && (Object.defineProperty(this, 'dmChannel', {
				value: new Dialogue(data, this),
				writable: false
			}),
			this.dmChannel)
		}).catch(err => {
			if (!createIfNotExists) {
				return null
			}
			throw err
		})
	}

	/**
	 * Check if this user is a friend of the client user
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<boolean>}
	 */
	async isPaired({ force } = {}) {
		if (!force && this.client.user.friends.cache.has(this.id)) {
			return true;
		}
		return this.client.requests.post("functions/v2:contact.mate.isPaired", {
			userId: this.id
		}).then(r => r === 'paired')
	}

	/**
	 * Send a message to this user
	 * @param {string} content
	 * @param {object} [options]
	 * @param {Iterable} [options.attachments]
	 * @param {string} [options.content]
	 * @param {object|Message} [options.reference]
	 * @param {string} [options.referenceId]
	 * @returns {Promise<Message>}
	 */
	send() {
		return this.fetchDM({ createIfNotExists: true }).then(dmChannel => {
			return dmChannel.send(...arguments)
		})
	}
}