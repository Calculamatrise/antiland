import BaseManager from "./BaseManager.js";
import User from "../structures/User.js";

export default class extends BaseManager {
	async fetch(id, { force } = {}) {
		if (!force && this.cache.size > 0) {
			if (this.cache.has(id)) {
				return this.cache.get(id);
			} else if (!id) {
				return this.cache;
			}
		}

		return this.client.client.requests.post("functions/v2:chat.getMembers", {
			dialogueId: this.client.id,
			page: 0,
			search: null
		}).then(entries => {
			for (let item of entries) {
				let entry = new User(item, this.client);
				this.cache.set(entry.id, entry);
			}
			return id ? this.cache.get(id) ?? null : this.cache
		})
	}

	/**
	 * Fetch active users in the chat
	 * @returns {Promise<object>}
	 */
	async fetchActive(id, { force } = {}) {
		let activeMembers = new Map(Array.from(this.cache.values()).filter(user => user.activity === 'ONLINE').map(entry => [entry.id, entry]));
		if (!force && activeMembers.size > 0) {
			if (activeMembers.has(id)) {
				return activeMembers.get(id);
			} else if (activeMembers.size > 0 && !id) {
				return activeMembers;
			}
		}

		return this.client.client.requests.post("functions/v2:chat.getActiveUsers", {
			dialogueId: this.client.id
		}).then(entries => {
			for (let item of entries) {
				let entry = new User(item, this.client);
				this.cache.set(entry.id, entry);
				activeMembers.set(entry.id, entry)
			}
			return id ? activeMembers.get(id) ?? null : activeMembers
		})
	}

	#throwAdmin() {
		if ((!this.client.founder || this.client.client.user.id !== this.client.founder.id) && !this.client.admins.has(this.client.client.user.id)) {
			throw new Error("Insufficient privileges.");
		}
	}

	#throwFounder() {
		if (!this.client.founder || this.client.client.user.id !== this.client.founder.id) {
			throw new Error("You must be the founder to perform this action.");
		}
	}

	/**
	 * Check if client can ban
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<boolean>}
	 */
	async canIBan({ force } = {}) {
		if (!force && this.client.admins.has(this.client.client.user.id)) {
			return true
		}
		return this.client.client.requests.post("functions/v2:chat.mod.canIBan", {
			dialogueId: this.client.id
		}).then(r => r && (this.client.admins.add(this.client.client.user.id), r))
	}

	/**
	 * Invite friends to join
	 * @param {Iterable} mateIds
	 * @returns {Promise<unknown>}
	 */
	invite(mateIds) {
		return this.client.client.requests.post(`functions/v2:chat.addMatesToGroup`, {
			dialogueId: this.client.id,
			mateIds: Array.from(new Set(mateIds)).map(m => typeof m == 'object' ? m.id : m)
		})
	}

	/**
	 * Add a chat moderator
	 * @protected requires founder permissions
	 * @param {string} userId
	 * @returns {Promise<boolean>}
	 */
	async addModerator(userId) {
		this.#throwFounder();
		return this.client.client.requests.post("functions/v2:chat.mod.add", {
			dialogueId: this.client.id,
			userId
		}).then(r => r && (this.client.admins.add(userId), r))
	}

	/**
	 * Ban a user
	 * @protected moderation endpoint for moderators
	 * @param {string} userId 
	 * @returns {Promise<object>}
	 */
	ban(userId, { messageId, reason = "No reason provided." } = {}) {
		this.#throwAdmin();
		return this.client.client.requests.post("functions/v2:chat.mod.ban", {
			dialogueId: this.client.id,
			message: messageId,
			reason,
			userId
		})
	}

	/**
	 * Remove a chat moderator
	 * @protected requires founder permissions
	 * @param {string} userId
	 * @returns {Promise<boolean>}
	 */
	async removeModerator(userId) {
		userId !== this.client.client.user.id && this.#throwFounder();
		return this.client.client.requests.post("functions/v2:chat.mod.delete", {
			dialogueId: this.client.id,
			userId
		}).then(r => r && (this.client.admins.delete(userId), r))
	}
}