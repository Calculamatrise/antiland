import BaseManager from "./BaseManager.js";

export default class PresenceManager extends BaseManager {
	fetch() {}

	/**
	 * Ping your presence
	 * @param {string} dialogueId
	 * @returns {Promise<boolean>}
	 */
	ping(dialogueId) {
		return this.client.client.requests.post("functions/v2:chat.presence.ping", { dialogueId }) // cache
	}

	/**
	 * Recall your presence
	 * @param {string} dialogueId
	 * @returns {Promise<boolean>}
	 */
	recall(dialogueId) {
		return this.client.client.requests.post("functions/v2:chat.presence.leave", { dialogueId })
	}
}