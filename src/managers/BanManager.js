import BaseManager from "./BaseManager.js";
import Dialogue from "../structures/Dialogue.js";

export default class BanManager extends BaseManager {
	async fetch(id, { force } = {}) {
		if (!force && this.cache.has(id)) {
			return this.cache.get(id);
		}
		return this.client.client.requests.post("functions/v2:chat.checkBan", {
			dialogueId: this.client.id,
			userId: id
		}).then(async ({ banned }) => {
			if (banned) {
				let entry = await this.client.client.users.fetch(id);
				this.cache.set(entry.id, entry);
				return entry
			}
			return null
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
	async add(userId, { force, messageId, reason = "No reason provided." } = {}) {
		if (!this.client.founder || this.client.client.user.id !== this.client.founder.id) {
			throw new Error("You must be the founder to perform this action.");
		} else if (!force && this.cache.has(userId)) {
			return this.cache.get(userId);
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
			return res.baned && (this.cache.set(userId, res.info),
			res.info)
		})
	}

	/**
	 * Submit an appeal request
	 * @returns {Promise<Dialogue>}
	 */
	async appeal() {
		return this.client.client.requests.post("functions/v2:chat.mod.appealClubBan", {
			dialogueId: this.client.id
		}).then(data => {
			let entry = new Dialogue(data.appealRoom, this.client);
			this.client.client.dialogues.cache.set(entry.id, entry);
			return entry
		})
	}

	/**
	 * Unan a user
	 * @protected moderation endpoint for moderators
	 * @param {string} userId 
	 * @returns {Promise<boolean>}
	 */
	async remove(userId, { force } = {}) {
		if (!this.client.founder || this.client.client.user.id !== this.client.founder.id) {
			throw new Error("You must be the founder to perform this action.");
		} else if (!force && !this.cache.has(userId)) {
			return true;
		}
		return this.client.client.users.fetch(userId).then(res => {
			return user.fetchDM({ createIfNotExists: true }).then(dialogue => {
				return dialogue.send("/forgive " + this.client.id).then(({ text }) => {
					let result = parseInt(text.replace(/^.+\n(\d+).+/, "$1"));
					if (result < 1) {
						throw new Error("No bans found.");
					}
					this.cache.delete(userId);
					return result > 0
				})
			})
		})
	}
}