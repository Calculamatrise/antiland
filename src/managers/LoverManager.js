import BaseManager from "./BaseManager.js";
import User from "../structures/User.js";

export default class LoverManager extends BaseManager {
	total = 0;

	/**
	 * Fetch the users that sent love to this message
	 * @param {string} id
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<string|Map<string, User>>}
	 */
	async fetch(id, { force } = {}) {
		if (!force && this.cache.size > 0) {
			if (this.cache.has(id)) {
				return this.cache.get(id);
			} else if (!id) {
				return this.cache;
			}
		}

		return this.client.client.requests.post("functions/v2:chat.message.getLovers", {
			messageId: this.client.id
		}).then(entries => {
			for (let item of entries) {
				let entry = new User(item, this.client);
				this.cache.set(entry.id, entry);
			}
			return id ? this.cache.get(id) ?? null : this.cache
		})
	}
}