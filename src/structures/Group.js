import Dialogue from "./Dialogue.js";
import GroupMemberManager from "../managers/GroupMemberManager.js";

export default class Group extends Dialogue {
	members = new GroupMemberManager(this); // participants
	constructor(data) {
		super(...arguments);
		if (this.hasOwnProperty('client')) {
			let entry = this.client.groups.cache.get(this.id);
			if (entry) {
				entry._update(data);
				return entry;
			}

			this.client.groups.cache.set(this.id, this);
		}
	}

	_update(data) {
		if (typeof data != 'object' || data == null) return;
		super._update(...arguments);
		for (let key in data) {
			switch (key) {
			case 'categories':
				this[key] = new Set(data[key]);
				break;
			case 'description':
			case 'minKarma':
				this[key] = data[key]
			}
		}
		return this
	}

	#throwFounder() {
		if (!this.founder || this.client.user.id !== this.founder.id) {
			throw new Error("You must be the founder to perform this action.");
		}
	}

	/**
	 * Submit an appeal request
	 * @returns {Promise<Dialogue>}
	 */
	appealBan() {
		return this.client.requests.post("functions/v2:chat.mod.appealClubBan", {
			dialogueId: this.id
		}).then(data => {
			let entry = new Dialogue(data.appealRoom, this);
			this.client.dialogues.cache.set(entry.id, entry);
			return entry
		})
	}

	/**
	 * Check if a user is banned from the chat
	 * @param {string} [userId] 
	 * @returns {Promise<object>}
	 */
	checkBan(userId) {
		return this.client.requests.post("functions/v2:chat.checkBan", {
			dialogueId: this.id,
			userId: userId ?? this.client.user.id
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
	 * Add a chat moderator
	 * @protected requires founder permissions
	 * @param {string} userId
	 * @returns {Promise<boolean>}
	 */
	async addModerator(userId) {
		this.#throwFounder();
		return this.client.requests.post("functions/v2:chat.mod.add", {
			dialogueId: this.id,
			userId
		}).then(r => r && (this.admins.add(userId), r))
	}

	/**
	 * Remove a chat moderator
	 * @protected requires founder permissions
	 * @param {string} userId
	 * @returns {Promise<boolean>}
	 */
	async removeModerator(userId) {
		this.#throwFounder();
		return this.client.requests.post("functions/v2:chat.mod.delete", {
			dialogueId: this.id,
			userId
		}).then(r => r && this.admins.delete(userId))
	}

	resetSpamReport() {
		// this.#throwFounder();
		return this.client.requests.post("functions/v2:chat.resetSpamReport", {
			dialogueId: this.id
		}).then(r => {
			console.log(r);
			return r
		})
	}

	/**
	 * Set a vanity URL
	 * @param {string} humanLink
	 * @returns {Promise<Group>}
	 */
	setHumanLink(humanLink) {
		this.#throwFounder();
		return this.client.requests.post("functions/v2:chat.mod.setHumanLink", {
			dialogueId: this.id,
			humanLink
		}).then(this._update.bind(this))
	}

	/**
	 * Set chat filters for this dialogue
	 * @param {Set|Array} filters
	 * @returns {Promise<Group>}
	 */
	setFilters(filters) {
		this.#throwFounder();
		return this.client.requests.post("functions/v2:chat.mod.setFilters", {
			dialogueId: this.id,
			filters: Array.from(filters || this.options.filters)
		}).then(this._update.bind(this))
	}

	/**
	 * Set the info for the group chat
	 * @param {string} [options]
	 * @param {Set|Array} [options.categories]
	 * @param {string} [options.filters]
	 * @param {string} [options.historyLength]
	 * @param {number} [options.minKarma]
	 * @param {string} [options.setup]
	 * @returns {Promise<Group>}
	 */
	setInfo({ categories, filters, historyLength, minKarma, setup } = {}) {
		this.#throwFounder();
		return this.client.requests.post("functions/v2:chat.mod.setInfo", {
			dialogueId: this.id,
			categories: Array.from(categories || this.categories),
			filters: Array.from(filters || this.options.filters),
			historyLength: historyLength ?? this.options.historyLength,
			minKarma: minKarma ?? this.minKarma,
			setup: Array.from(setup || this.options.setup)
		}).then(this._update.bind(this))
	}

	/**
	 * Set the mood
	 * @protected requires founder permissions
	 * @param {string} mood
	 * @returns {Promise<boolean>}
	 */
	setMood(mood) {
		this.#throwFounder();
		return this.client.requests.post("functions/v2:chat.mod.setMood", {
			dialogueId: this.id,
			mood
		}).then(r => {
			console.log(r)
			return r
		})
	}

	/**
	 * Set the name for the group chat
	 * @param {string} name
	 * @returns {Promise<Group>}
	 */
	setName(name) {
		this.#throwFounder();
		return this.client.requests.post("functions/v2:chat.mod.setName", {
			dialogueId: this.id,
			name
		}).then(this._update.bind(this))
	}

	/**
	 * Unset a vanity URL
	 * @returns {Promise<Group>}
	 */
	unsetHumanLink(humanLink) {
		this.#throwFounder();
		return this.client.requests.post("functions/v2:chat.mod.unsetHumanLink", {
			dialogueId: this.id,
			humanLink
		}).then(r => {
			console.log(r);
			return r
		})
	}

	/**
	 * Update chat filters for this dialogue
	 * @param {function} callback
	 * @returns {Promise<Group>}
	 */
	updateFilters(callback) {
		if (typeof callback != 'function') {
			throw new TypeError("Callback must be of type: function")
		}
		return this.setFilters(callback(new Set(this.options.filters)))
	}
}