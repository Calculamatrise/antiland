import BaseManager from "./BaseManager.js";
import User from "../structures/User.js";

export default class FriendManager extends BaseManager {
	async fetch(id, { force } = {}) {
		if (!force && this.cache.size > 0) {
			if (this.cache.has(id)) {
				return this.cache.get(id);
			} else if (!id) {
				return this.cache;
			}
		}

		return this.client.client.requests.post("functions/v2:contact.mate.listByUser", {
			userId: this.client.id
		}).then(({ mates }) => {
			for (let item in mates) {
				let entry = new User(item, this.client);
				this.cache.set(entry.id, entry);
			}
			return id ? this.cache.get(id) ?? null : this.cache
		});
	}
}