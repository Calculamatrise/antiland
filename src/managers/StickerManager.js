import BaseManager from "./BaseManager.js";

export default class extends BaseManager {
	async fetch(id, { force } = {}) {
		if (!force && this.cache.has(id)) {
			return this.cache.get(id);
		}

		return this.client.requests.post("functions/v2:purchase.allIaps").then(data => {
			for (let pack of data.stickers.items) {
				this.cache.set(pack.avatar, pack.items);
			}
			return id ? this.cache.get(id) ?? null : this.cache
		})
	}
}