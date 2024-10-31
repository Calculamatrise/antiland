import BaseManager from "./BaseManager.js";

export default class ClientPresenceManager extends BaseManager {
	/**
	 * Fetch presence
	 * @param {string} dialogueId
	 * @returns {Promise<unknown>}
	 */
	async fetch(dialogueId) {
		return this.client.client.requests.post("functions/v2:chat.presence.presence", {
			dialogueId,
			// lastUsers: uid
		})
	}

	/**
	 * Ping presence
	 * @param {string} dialogueId
	 * @returns {Promise<boolean>}
	 */
	async ping(dialogueId) {
		return this.client.client.requests.post("functions/v2:chat.presence.ping", { dialogueId }) // cache, ping cached presences every once in a while
	}

	/**
	 * Recall presence
	 * @param {string} dialogueId
	 * @returns {Promise<boolean>}
	 */
	async recall(dialogueId) {
		return this.client.client.requests.post("functions/v2:chat.presence.leave", { dialogueId })
	}

	/**
	 * Screenshot presence
	 * @param {string} dialogueId
	 * @param {string} messageId
	 * @returns {Promise<unknown>}
	 */
	screenshot(dialogueId, messageId) {
		return this.client.client.requests.post("functions/v2:chat.presence.ss", {
			dialogueId,
			eventType: 'screenshot' || 'video', // ?
			messageId
		})
	}
}