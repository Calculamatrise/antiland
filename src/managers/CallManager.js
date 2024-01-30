import BaseManager from "./BaseManager.js";
import CallRoom from "../structures/Room.js";

export default class extends BaseManager {
	incoming = new Set();

	/**
	 * Start a call
	 * @returns {Promise<object>}
	 */
	async start(guestId) {
		let guest = await this.client.users.fetch(guestId);
		if (!guest) {
			throw new Error("Guest user does not exist!");
		}
		return this.client.requests.post("functions/v2:call.start", { guestId }).then(async r => {
			let room = new CallRoom(r, this);
			room.participants
			.set(this.client.user.id, this.client.user)
			.set(guestId, guest),
			this.cache.set(room.id, room);
			return room
		})
	}

	/**
	 * Cancel an outgoing call
	 * @returns {Promise<unknown>}
	 */
	cancel(guestId) {
		return this.client.requests.post("functions/v2:call.cancel", { guestId })
	}

	/**
	 * Accept an incoming call
	 * @param {string} callerId
	 * @returns {Promise<unknown>}
	 */
	accept(callerId) {
		return this.client.requests.post("functions/v2:call.accept", { callerId })
	}

	/**
	 * Accept an incoming call
	 * @param {string} callerId
	 * @returns {Promise<unknown>}
	 */
	reject(callerId) {
		return this.client.requests.post("functions/v2:call.reject", { callerId })
	}
}