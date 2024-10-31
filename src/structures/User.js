import BaseStructure from "./BaseStructure.js";
import Dialogue from "./Dialogue.js";
import FriendManager from "../managers/FriendManager.js";

export default class User extends BaseStructure {
	accentColor = null;
	// accessories = null;
	activity = null;
	age = null;
	artifacts = {};
	avatar = {};
	// avatar = null;
	// avatarAccessories = null;
	description = null;
	displayName = null;
	friends = new FriendManager(this);
	gender = null;
	hexAccentColor = null;
	interests = new Set();
	isAdmin = false;
	isInPrison = false;
	isVIP = false;
	karma = null;
	minKarma = null;
	mood = null;
	username = null;
	constructor(data, options, { partial, cache, skipPatch } = {}) {
		if (data instanceof User && data.constructor === User) return data;
		if (data instanceof Object && options instanceof Object && options.hasOwnProperty('client')) {
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
			humanLink: { value: null, writable: true },
			partial: { value: partial || this.partial, writable: true }
		});
		skipPatch || this._patch(data),
		this.id
		false !== cache && this.id !== null && this.hasOwnProperty('client') && this.client.users.cache.set(this.id, this)
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
				this[key] = data[key];
				break;
			case 'artifacts':
				this[key] = Object.assign({}, this[key], data[key]);
				break;
			case 'avatar': // https://gfx.antiland.com/avatars/8
				this[key] ||= {};
				if (typeof data[key] == 'object') {
					for (let prop in data[key]) {
						switch (prop) {
						case 'accs':
							this[key].accessories = new Set(data[key][prop]);
							break;
						case 'blessed':
							this._patch({ [prop]: data[key][prop] });
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
			// case 'color':
			case 'hexColor':
				this.hexAccentColor = data[key];
				this.accentColor = parseInt(this.hexAccentColor.replace(/^#/, ''), 16);
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
						this[key + 'Owned'] = counters[key];
						break;
					case 'friends':
						this.friends.total = counters[key];
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
				this.friends.total = data[key];
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
				for (let interest in data[key]) {
					switch (interest) {
					case 'allow':
					case 'categories':
						if (!Array.isArray(data[key][interest])) {
							this._patch({ [key]: { [interest]: data[key][interest].allow }});
							break;
						}
						this[key] = new Set(data[key][interest])
					}
				}
				break;
			case 'mood':
				this[key] = typeof data[key] == 'object' ? data[key].id || data[key].idx : data[key];
				break;
			case 'profileName':
				this.displayName = data[key];
				this.username ||= this.displayName.replace(/\s[👩🚺🚹]+$/, match => (this.gender ||= (match.endsWith('🚹') ? '' : 'FE') + 'MALE', '')).toLowerCase();
				break;
			case 'views':
				this[key] = Math.max(this[key], data[key])
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
	async createDM() {
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
		if (!force && !this.partial) {
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

	moodURL() {
		if (!this.mood) return null;
		return "https://gfx.antiland.com/moods/" + this.mood
	}

	report() {
		return this.client.requests.post("functions/v2:chat.mod.sendComplaint", {
			dialogueId: 'n/a', // this.dialogueId,
			isPrivate: true, // this.dialogue && this.dialogue.constructor === Dialogue,
			messageId: 'n/a', // this.id,
			reason: 'ChatReportFlags[]', // unfinished
			userId: this.author.id
		})
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
	async send() {
		return this.fetchDM({ createIfNotExists: true }).then(dmChannel => {
			return dmChannel.send(...arguments)
		})
	}

	static resolve(data, target) {
		target && (target = target.toLowerCase()) || (target = 'sender');
		let object = Object.assign({}, data[target])
		  , filterExisting = obj => Object.fromEntries(Object.entries(obj).filter(([key]) => !object.hasOwnProperty(key)));
		if (target) {
			if (!object.id) {
				let id = data['gift' + target.replace(/^\w/, c => c.toUpperCase()) + 'Id'] || data[target + 'Id'] || data[target.charAt(0) + 'id'] || data.id || data.objectId;
				id && (object.id = id);
			}

			if (!object.profileName) {
				let profileName = data[target + 'Name'] || data[target + 'sName'] || data.profileName;
				profileName && (object.profileName = profileName);
			}

			if (!object.avatar) {
				let avatar = data[target + 'Ava'] || data[target + 'Avatar'];
				avatar && (object.avatar = avatar);
			}

			if (!object.blessed) {
				let blessed = data[target + 'Blessed'];
				blessed && (data.blessed = blessed);
			}
		}
		switch (target) {
		case 'receiver':
			for (let key in filterExisting(data)) {
				switch (key) {
				case 'whom':
					object.id = data[key];
					break;
				default:
					object[key] = data[key]
				}
			}
			break;
		default:
			for (let key in filterExisting(data)) {
				switch (key) {
				case 'by':
					object.id = data[key];
					break;
				case 'objectId':
					break;
				default:
					object[key] = data[key]
				}
			}
		}
		'objectId' in object && delete object.objectId,
		'type' in object && delete object.type;
		return object
	}

	static resolveAll(data) {
		const appendMetadata = object => {
			if ('accessories' in data) {
				object.avatar ||= {},
				object.avatar.accessories = data.accessories;
			}

			if ('avatar' in data) {
				object.avatar ||= {},
				object.avatar.id = data.avatar;
			}

			return object
		}

		if ('liker' in data) {
			data.liker = {
				id: data.senderId,
				profileName: data.sendersName || data.senderName
			};
		}

		if ('receiverId' in data) {
			// create user objects
			// new this({
			// 	id: data.receiverId || data.receiver,
			// 	profileName: data.receiverName
			// });
			data.receiver = {
				id: data.receiverId || data.receiver,
				profileName: data.receiverName
			};
		}

		if ('senderId' in data) {
			data.sender = appendMetadata({
				id: data.senderId,
				profileName: data.sendersName || data.senderName
			});
		} else if ('profileName' in data) {
			data.sender = appendMetadata({
				id: data.id,
				profileName: data.profileName
			});
		}

		if ('type' in data) {
			delete data.type;
		}

		return data
	}
}