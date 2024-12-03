import StickerManager from "./StickerManager.js";

export default class ClientStickerManager extends StickerManager {
	async fetch(id, { force } = {}) {
		if (!force && this.cache.has(id)) {
			return this.cache.get(id);
		}

		return this.client.client.rest.post("functions/v2:profile.me.stickers").then(data => {
			for (let pack of data) {
				this.cache.set(pack.avatar, pack.items);
			}
			return id ? this.cache.get(id) ?? null : this.cache
		})
	}
}