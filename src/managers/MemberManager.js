import BaseManager from "./BaseManager.js";
import Member from "../structures/Member.js";

export default class MemberManager extends BaseManager {
	total = null;
	get manageable() {
		return this.client.manageable || this.client.moderators.cache.has(this.client.client.user.id)
	}

	/**
	 * Fetch group members
	 * @param {string} id
	 * @param {object} [options]
	 * @param {boolean} [options.active]
	 * @param {boolean} [options.force]
	 * @param {number} [options.page]
	 * @param {boolean} [options.partial] whether to create a partial member object
	 * @param {string} [options.search]
	 * @returns {Promise<Member>}
	 */
	async fetch({ active, force, id, page, partial, search } = {}) {
		if (typeof arguments[0] == 'string') return this.fetch(Object.assign({}, arguments[1], { id: arguments[0] }));
		else if (active) return this.fetchActive(...arguments);
		else if (!force && this.cache.size > 0) {
			if (this.cache.has(id)) {
				return this.cache.get(id);
			} else if (!id) {
				return this.cache;
			}
		}

		if (partial) {
			return this.client.client.users.fetch(id).then(user => {
				let entry = new Member(user, this.client);
				this.cache.set(entry.id, entry);
				return entry
			});
		}

		page ??= 0;
		return this.client.client.rest.post("functions/v2:chat.getMembers", {
			dialogueId: this.client.id,
			page,
			search: search || null
		}).then(res => {
			this.total = res.total;
			this.client.totalMembers = res.total;
			for (let item of res.members) {
				let entry = new Member(item, this.client);
				this.cache.set(entry.id, entry);
			}
			return id ? this.cache.get(id) ?? (res.isLastPage ? null : this.fetch(Object.assign(arguments[0], { page: 1 + page }))) : this.cache
		})
	}

	/**
	 * Fetch active users in the chat
	 * @param {string} id
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<object>}
	 */
	async fetchActive(id, { force } = {}) {
		if (arguments[0] instanceof Object) return this.fetchActive(null, ...arguments);
		let activeMembers = new Map(Array.from(this.cache.values()).filter(user => user.activity === 'ONLINE').map(entry => [entry.id, entry]));
		if (!force && activeMembers.size > 0) {
			if (activeMembers.has(id)) {
				return activeMembers.get(id);
			} else if (activeMembers.size > 0 && !id) {
				return activeMembers;
			}
		}

		return this.client.client.rest.post("functions/v2:chat.getActiveUsers", {
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

	/**
	 * Ban a user
	 * @protected moderation endpoint for moderators
	 * @param {string} userId
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @param {string} [options.messageId]
	 * @param {string} [options.reason]
	 * @returns {Promise<object>}
	 */
	async ban(userId, { force, messageId = 'null', reason = "No reason provided." } = {}) {
		if (!this.manageable) {
			throw new Error("Insufficient privileges.");
		} else if (!force && this.client.bans.cache.has(userId)) {
			return this.client.bans.cache.get(userId);
		}
		return this.client.client.rest.post("functions/v2:chat.mod.ban", {
			dialogueId: this.client.id,
			message: messageId,
			reason,
			userId
		}).then(async res => {
			if (res.banned) {
				let createdAt = new Date();
				let destroyedAt = new Date(typeof res.info.endsAt == 'object' ? res.info.endsAt.iso : res.info.endsAt);
				delete res.info.endsAt;
				Object.defineProperties(res.info, {
					admin: { value: this.client.client.user },
					adminId: { value: this.client.client.user.id },
					createdAt: { value: createdAt },
					createdTimestamp: { value: createdAt.getTime() },
					dialogue: { enumerable: false, value: this.client, writable: false },
					dialogueId: { enumerable: true, value: res.info.dialogue, writable: true },
					expiresAt: { value: destroyedAt },
					expiresTimestamp: { value: destroyedAt.getTime() },
					receiver: { value: await this.client.client.users.fetch(userId) },
					receiverId: { enumerable: true, value: userId }
				});
			}
			return res.banned && (this.client.bans.cache.set(userId, res.info),
			res.info)
		})
	}

	/**
	 * Check if client can ban
	 * @param {object} [options]
	 * @param {boolean} options.force
	 * @returns {Promise<boolean>}
	 */
	async canIBan({ force } = {}) {
		if (!force && (this.client.founder.id === this.client.client.user.id || this.client.admins.has(this.client.client.user.id))) {
			return true;
		}
		return this.client.client.rest.post("functions/v2:chat.mod.canIBan", {
			dialogueId: this.client.id
		}).then(r => r && (this.client.admins.add(this.client.client.user.id), r))
	}

	/**
	 * Invite friends to join
	 * @param {Iterable} mateIds
	 * @returns {Promise<unknown>}
	 */
	async invite(mateIds) {
		return this.client.client.rest.post(`functions/v2:chat.addMatesToGroup`, {
			dialogueId: this.client.id,
			mateIds: Array.from(new Set(mateIds || this.client.user.friends.cache.keys())).map(m => typeof m == 'object' ? m.id : m)
		})
	}

	/**
	 * Unban a user
	 * @protected moderation endpoint for moderators
	 * @param {string} userId 
	 * @returns {Promise<object>}
	 */
	async unban(userId, { force } = {}) {
		if (!this.manageable) {
			throw new Error("Insufficient privileges.");
		} else if (!force && !this.client.bans.cache.has(userId)) {
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