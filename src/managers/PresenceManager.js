import BaseManager from "./BaseManager.js";

export default class PresenceManager extends BaseManager {
	ping(dialogueId) {
		return this.client.requests.post("functions/v2:chat.presence.ping", { dialogueId })
	}

	recall(dialogueId) {
		return this.client.requests.post("functions/v2:chat.presence.leave", { dialogueId })
	}
}