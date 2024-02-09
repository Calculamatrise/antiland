import BaseManager from "./BaseManager.js";
import Member from "../structures/Member.js";

export default class MemberManager extends BaseManager {
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
				let entry = new Member(item, this.client);
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
				let entry = new Member(item, this.client);
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

	/**
	 * Check if client can ban
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<boolean>}
	 */
	async canIBan({ force } = {}) {
		if (!force && (this.client.founder.id === this.client.client.user.id || this.client.admins.has(this.client.client.user.id))) {
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
	 * Ban a user
	 * @protected moderation endpoint for moderators
	 * @param {string} userId 
	 * @returns {Promise<object>}
	 */
	async ban(userId, { force, messageId, reason = "No reason provided." } = {}) {
		this.#throwAdmin();
		if (!force && this.client.bans.cache.has(userId)) {
			return this.client.bans.cache.get(userId);
		}
		return this.client.client.requests.post("functions/v2:chat.mod.ban", {
			dialogueId: this.client.id,
			message: messageId,
			reason,
			userId
		}).then(res => {
			if (res.banned) {
				let createdAt = new Date();
				let endsAt = new Date(typeof res.info.endsAt == 'object' ? res.info.endsAt.iso : res.info.endsAt);
				Object.defineProperties(res.info, {
					createdAt: { value: createdAt },
					createdTimestamp: { value: createdAt.getTime() },
					dialogue: { enumerable: false, value: this.client, writable: false },
					dialogueId: { enumerable: true, value: res.info.dialogue, writable: true },
					endsAt: { value: endsAt },
					endsTimestamp: { value: endsAt.getTime() }
				});
			}
			return res.banned && (this.client.bans.cache.set(userId, res.info),
			res.info)
		})
	}

	/**
	 * Unban a user
	 * @protected moderation endpoint for moderators
	 * @param {string} userId 
	 * @returns {Promise<object>}
	 */
	async unban(userId, { force } = {}) {
		this.#throwAdmin();
		if (!force && !this.client.bans.cache.has(userId)) {
			return true;
		}
		return this.client.client.users.fetch(userId).then(user => {
			return user.fetchDM({ createIfNotExists: true }).then(dialogue => {
				return dialogue.send("/forgive " + this.client.id).then(({ text }) => {
					let result = parseInt(text.replace(/^.+\n(\d+).+/, "$1"));
					if (result < 1) {
						throw new Error("No bans found.");
					}
					this.client.bans.cache.delete(userId);
					return result > 0
				})
			})
		})
	}
}