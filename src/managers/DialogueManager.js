import BaseManager from "./BaseManager.js";
import Dialogue from "../structures/Dialogue.js";

export default class extends BaseManager {
	async fetch(id, { force } = {}) {
		if (!force && this.cache.has(id)) {
			return this.cache.get(id);
		}

		return this.client.requests.post("functions/v2:chat.byId", {
			dialogueId: id
		}).then(data => {
			if (data) {
				let entry = new Dialogue(data, this);
				this.cache.set(entry.id, entry);
				return entry
			}
			return null
		})
	}

	/**
	 * Start a random chat
	 * @param {Iterable} lastUsers
	 * @returns {Promise<unknown>}
	 */
	random(lastUsers = null) {
		return this.client.fetch("functions/v2:chat.newRandom", {
			lastUsers: Array.from(lastUsers || [])
		})
	}

	/**
	 * Fetch message history
	 * @param {string} dialogueId
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<Iterable<object>>}
	 */
	history(dialogueId, { force } = {}) {
		return this.client.requests.post("functions/v2:chat.message.history", {
			dialogueId
		}).then(r => {
			console.log(r) // cache
			return r
		})
	}

	/**
	 * Leave a dialogue
	 * @param {string} dialogueId
	 * @returns {Promise<unknown>}
	 */
	leave(dialogueId) {
		this.client.closeChannel(dialogueId);
		return this.client.requests.post("functions/v2:chat.leave", { dialogueId }).then(data => {
			if (data) {
				this.cache.delete(dialogueId);
				this.client.groups.cache.delete(dialogueId);
				for (let [_, user] of this.client.users.cache) {
					if (!user.dialogue) continue;
					if (user.dialogueId == dialogueId) {
						user.dialogue = null;
						user.dialogueId = null;
						break;
					}
				}
			}
			return data
		});
	}
}