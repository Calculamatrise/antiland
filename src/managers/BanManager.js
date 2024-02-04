import BaseManager from "./BaseManager.js";
import Dialogue from "../structures/Dialogue.js";

export default class BanManager extends BaseManager {
	fetch(id, { force } = {}) {
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
	 * Submit an appeal request
	 * @returns {Promise<Dialogue>}
	 */
	async appeal() {
		return this.client.client.requests.post("functions/v2:chat.mod.appealClubBan", {
			dialogueId: this.client.id
		}).then(data => {
			let entry = new Dialogue(data.appealRoom, this);
			this.client.client.dialogues.cache.set(entry.id, entry);
			return entry
		})
	}

	/**
	 * Ban a user
	 * @protected moderation endpoint for moderators
	 * @param {string} userId 
	 * @returns {Promise<object>}
	 */
	create(userId, { messageId, reason = "No reason provided." } = {}) {
		if (!this.client.founder || this.client.client.user.id !== this.client.founder.id) {
			throw new Error("You must be the founder to perform this action.");
		}
		return this.client.client.requests.post("functions/v2:chat.mod.ban", {
			dialogueId: this.client.id,
			message: messageId,
			reason,
			userId
		})
	}
}