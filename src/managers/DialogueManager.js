import BaseManager from "./BaseManager.js";
import Dialogue from "../structures/Dialogue.js";
import Group from "../structures/Group.js";

export default class DialogueManager extends BaseManager {
	async fetch(id, { force } = {}) {
		if (!force && this.cache.has(id)) {
			return this.cache.get(id);
		}

		return this.client.requests.post("functions/v2:chat.byId", {
			dialogueId: id
		}).then(data => {
			if (data) {
				let entry = new (/^(group|public)$/i.test(data.type) ? Group : Dialogue)(data, this);
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
		if (this.cache.has(dialogueId)) {
			let dialogue = this.cache.get(dialogueId);
			if (!force && dialogue.messages.cache.size > 0) {
				return dialogue.messages.cache;
			}
			return dialogue.messages.fetch();
		}
		return this.client.requests.post("functions/v2:chat.message.history", {
			dialogueId
		})
	}

	/**
	 * Leave a dialogue
	 * @param {string} dialogueId
	 * @returns {Promise<unknown>}
	 */
	leave(dialogueId) {
		this.client.closeChannel(dialogueId);
		return this.client.requests.post("functions/v2:chat.leave", { dialogueId }).then(result => {
			if (result) {
				this.cache.delete(dialogueId);
				this.client.groups.cache.delete(dialogueId);
				for (let user of this.client.users.cache.values()) {
					if (!user.dmChannel) continue;
					if (user.dmChannel.id == dialogueId) {
						user.dmChannel = null;
						break;
					}
				}
			}
			return result
		})
	}
}