import BaseManager from "./BaseManager.js";

export default class PresenceManager extends BaseManager {
	async fetch() {}

	/**
	 * Ping your presence
	 * @param {string} dialogueId
	 * @returns {Promise<boolean>}
	 */
	async ping(dialogueId) {
		return this.client.client.requests.post("functions/v2:chat.presence.ping", { dialogueId }) // cache, ping cached presences every once in a while
	}

	/**
	 * Recall your presence
	 * @param {string} dialogueId
	 * @returns {Promise<boolean>}
	 */
	async recall(dialogueId) {
		return this.client.client.requests.post("functions/v2:chat.presence.leave", { dialogueId })
	}
}