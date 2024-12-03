import BaseManager from "../../../../../src/managers/BaseManager.js";
import CallRoom from "../structures/CallRoom.js";

export default class CallManager extends BaseManager {
	incoming = new Set();
	outgoing = new Set();

	/**
	 * Accept an incoming call
	 * @param {string} callerId
	 * @returns {Promise<CallRoom>}
	 */
	accept(callerId) {
		return this.client.rest.post("functions/v2:call.accept", { callerId })
	}

	/**
	 * Cancel an outgoing call
	 * @returns {Promise<unknown>}
	 */
	cancel(guestId) {
		return this.client.rest.post("functions/v2:call.cancel", { guestId })
	}

	/**
	 * Give the call a rating
	 * @param {string} callId
	 * @param {number?} rating
	 * @param {object} [options]
	 * @param {string} [options.comments]
	 * @returns {Promise<unknown>}
	 */
	rate(callId, rating, { comments } = {}) {
		return this.client.rest.post("functions/v2:call.rate", {
			id: callId,
			score: rating | 0,
			comments: comments || null
		})
	}

	/**
	 * Accept an incoming call
	 * @param {string} callerId
	 * @returns {Promise<unknown>}
	 */
	reject(callerId) {
		return this.client.rest.post("functions/v2:call.reject", { callerId })
	}

	/**
	 * Start a call
	 * @returns {Promise<CallRoom>}
	 */
	async start(guestId) {
		let guest = await this.client.users.fetch(guestId);
		if (!guest) {
			throw new Error("Guest user does not exist!");
		}
		return this.client.rest.post("functions/v2:call.start", { guestId }).then(async r => {
			let room = new CallRoom(r, this);
			room.participants
			.set(this.client.user.id, this.client.user)
			.set(guestId, guest),
			this.cache.set(room.id, room);
			return room
		})
	}
}