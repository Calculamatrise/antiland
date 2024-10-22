import Dialogue from "./Dialogue.js";
import BanManager from "../managers/BanManager.js";
import MemberManager from "../managers/MemberManager.js";
import ModeratorManager from "../managers/ModeratorManager.js";
import Member from "./Member.js";

export default class Group extends Dialogue {
	bans = new BanManager(this);
	categories = new Set();
	description = null;
	founderId = null;
	members = new MemberManager(this); // participants
	minKarma = null;
	moderators = new ModeratorManager(this);
	constructor(data, options) {
		if (data instanceof Group) return data;
		if (data instanceof Object && options instanceof Object && options.hasOwnProperty('client')) {
			let id = data.id || data.objectId;
			let entry = options.client.groups.cache.get(id);
			if (entry) {
				entry._patch(data);
				return entry
			}
		}
		super(...arguments, true);
		Object.defineProperty(this, 'humanLink', { value: null, writable: true });
		this._patch(data);
		this.id !== null && this.hasOwnProperty('client') && (this.client.dialogues.cache.set(this.id, this),
		this.client.groups.cache.set(this.id, this))
	}

	get manageable() {
		return this.founderId === this.client.user.id
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'admins':
				if (typeof data[key] != 'object' || typeof data[key][Symbol.iterator] != 'function') break;
				for (let userId of Array.from(data[key].values()).filter(userId => !this.moderators.cache.has(userId))) {
					this.moderators.cache.set(userId, new Member({ id: userId }, this));
				}
				break;
			case 'categories':
				this[key] = new Set(data[key]);
				break;
			case 'description':
			case 'humanLink':
			case 'minKarma':
				this[key] = data[key];
				break;
			case 'founder':
				this.founderId = typeof data[key] ? data[key].id : data[key];
				break;
			case 'mood':
				this[key] ||= {};
				for (let prop in data[key]) {
					switch(prop) {
					case 'idx':
						this[key].id = data[key][prop];
						break;
					default:
						this[key][prop] = data[key][prop];
					}
				}
			}
		}
		return this
	}

	async edit(options = {}) {
		if (typeof options != 'object') return this;
		if (options.hasOwnProperty('humanLink') && options.humanLink !== this.humanLink) {
			await this.sethumanLink(options.humanLink);
			delete options.humanLink;
		}
		if (options.hasOwnProperty('mood') && options.mood !== this.mood) {
			await this.setMood(options.mood);
			delete options.mood;
		}
		if (options.hasOwnProperty('name') && options.name !== this.name) {
			await this.setName(options.name);
			delete options.name;
		}
		if (Object.keys(options) > 1) {
			// check if any changes have been made
			await this.setInfo(options);
		} else if (options.hasOwnProperty('filters')) {
			let oldEntry = JSON.stringify(Array.from(this.options.filters).sort((a, b) => a > b ? 1 : -1));
			let newEntry = JSON.stringify(Array.from(options.filters).sort((a, b) => a > b ? 1 : -1));
			oldEntry !== newEntry && await this.setFilters(options.filters);
			delete options.filters;
		}
		return this
	}

	/**
	 * Join this chat
	 * @returns {Promise<boolean>}
	 */
	join() {
		return this.client.requests.post("functions/v2:chat.joinGroup", {
			dialogueId: this.id
		})
	}

	resetSpamReport() {
		return this.client.requests.post("functions/v2:chat.resetSpamReport", {
			dialogueId: this.id
		})
	}

	/**
	 * Send a complaint about a user
	 * @param {string} userId
	 * @param {string} messageId
	 * @returns {Promise<boolean>}
	 */
	sendComplaint(userId, messageId) {
		return this.client.requests.post("functions/v2:chat.mod.sendComplaint", {
			dialogueId: this.id,
			userId,
			messageId
		}).then(r => r.bon)
	}

	/**
	 * Set a vanity URL
	 * @param {string} humanLink
	 * @returns {Promise<Group>}
	 */
	async setHumanLink(humanLink) {
		if (!this.manageable) {
			throw new Error("You must be the founder to perform this action.");
		}
		if (humanLink === null) return this.unsetHumanLink();
		return this.client.requests.post("functions/v2:chat.mod.setHumanLink", {
			dialogueId: this.id,
			humanLink
		}).then(this._patch.bind(this))
	}

	/**
	 * Set chat filters for this dialogue
	 * @param {Set|Array} filters
	 * @returns {Promise<Group>}
	 */
	async setFilters(filters) {
		if (!this.manageable) {
			throw new Error("You must be the founder to perform this action.");
		}
		return this.client.requests.post("functions/v2:chat.mod.setFilters", {
			dialogueId: this.id,
			filters: Array.from(filters || this.options.filters)
		}).then(this._patch.bind(this))
	}

	/**
	 * Set the info for the group chat
	 * @param {string} [options]
	 * @param {Array<string>} [options.blockedWords]
	 * @param {Array<string>} [options.categories]
	 * @param {Array<string>} [options.filters]
	 * @param {number} [options.historyLength]
	 * @param {number} [options.minKarma]
	 * @param {Array<string>} [options.setup]
	 * @returns {Promise<Group>}
	 */
	async setInfo({ blockedWords, categories, filters, historyLength, minKarma, setup } = {}) {
		if (!this.manageable) {
			throw new Error("You must be the founder to perform this action.");
		}
		return this.client.requests.post("functions/v2:chat.mod.setInfo", {
			dialogueId: this.id,
			categories: Array.from(categories || this.categories || []),
			customBlockedWords: Array.from(blockedWords || this.options.customBlockedWords || []).join(','),
			filters: Array.from(filters || this.options.filters || []),
			historyLength: historyLength ?? this.options.historyLength,
			minKarma: minKarma ?? this.minKarma,
			setup: Array.from(setup || this.options.setup || [])
		}).then(this._patch.bind(this))
	}

	/**
	 * Set the mood
	 * @protected requires founder permissions
	 * @param {string} mood
	 * @returns {Promise<Group>}
	 */
	async setMood(mood) {
		if (!this.manageable) {
			throw new Error("You must be the founder to perform this action.");
		}
		return this.client.requests.post("functions/v2:chat.mod.setMood", {
			dialogueId: this.id,
			mood
		}).then(this._patch.bind(this))
	}

	/**
	 * Set the name for the group chat
	 * @param {string} name
	 * @returns {Promise<Group>}
	 */
	async setName(name) {
		if (!this.manageable) {
			throw new Error("You must be the founder to perform this action.");
		}
		return this.client.requests.post("functions/v2:chat.mod.setName", {
			dialogueId: this.id,
			name
		}).then(this._patch.bind(this))
	}

	/**
	 * Unset a vanity URL
	 * @returns {Promise<Group>}
	 */
	async unsetHumanLink() {
		if (!this.manageable) {
			throw new Error("You must be the founder to perform this action.");
		}
		return this.client.requests.post("functions/v2:chat.mod.unsetHumanLink", {
			dialogueId: this.id
		}).then(r => {
			console.log(r);
			return r
		})
	}

	async update(options) {
		return this.edit(Object.assign({
			categories: this.categories,
			filters: Array.from(this.options.filters),
			historyLength: this.options.historyLength,
			humanLink: this.humanLink,
			minKarma: this.minKarma,
			mood: this.mood,
			name: this.name,
			setup: Array.from(this.options.setup)
		}, options))
	}

	/**
	 * Update chat filters for this dialogue
	 * @param {function} callback
	 * @returns {Promise<Group>}
	 */
	async updateFilters(callback) {
		if (typeof callback != 'function') {
			throw new TypeError("Callback must be of type: function")
		}
		return this.setFilters(callback(new Set(this.options.filters)))
	}

	async updateInfo(callback) {
		if (typeof callback != 'function') {
			throw new TypeError("Callback must be of type: function")
		}
		return this.setInfo(callback({
			categories: this.categories,
			filters: Array.from(this.options.filters),
			historyLength: this.options.historyLength,
			minKarma: this.minKarma,
			setup: Array.from(this.options.setup)
		}))
	}
}