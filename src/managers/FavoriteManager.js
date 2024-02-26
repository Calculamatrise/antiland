import BaseManager from "./BaseManager.js";

export default class FavoriteManager extends BaseManager {
	async fetch(id, { force } = {}) {
		if (!force && this.cache.size > 0) {
			if (id && this.cache.has(id)) {
				return this.cache.get(id);
			} else if (!id) {
				return this.cache;
			}
		}

		return this.client.client.requests.post("functions/v2:profile.me").then(async data => {
			for (let channelId of data.favorites) {
				let entry = await this.client.client.dialogues.fetch(channelId).catch(err => this.users.fetch(channelId).then(user => user.fetchDM()).catch(err => !1));
				if (!entry) continue;
				this.cache.set(entry.id, entry);
			}
			return id ? this.cache.get(id) ?? null : this.cache
		});
	}

	/**
	 * Add a chat to your favourites
	 * @param {string} channelId
	 * @returns {Promise<object>}
	 */
	async add(channelId) {
		if (channelId instanceof Object) return this.add(channelId.dmChannel !== void 0 ? await channelId.fetchDM().then(c => c.id) : channelId.id);
		if (!this.cache.has(channelId)) {
			let entry = await this.client.client.dialogues.fetch(channelId);
			if (!entry) {
				throw new Error("Dialogue not found!");
			}
			this.cache.set(entry.id, entry);
			await this.backup();
		}
		return true
	}

	/**
	 * Backup favourites
	 * @returns {ClientUser}
	 */
	async backup() {
		return this.client.client.requests.post("functions/v2:profile.backup", {
			favorites: Array.from(this.cache.values()).map(entry => entry.id)
		}).then(this.client._patch.bind(this.client))
	}

	/**
	 * Remove a chat from your favourites
	 * @param {string} channelId
	 * @returns {Promise<object>}
	 */
	async remove(channelId) {
		if (channelId instanceof Object) return this.add(channelId.dmChannel !== void 0 ? await channelId.fetchDM().then(c => c.id) : channelId.id);
		this.cache.has(channelId) && await this.backup();
		return this.cache.delete(channelId)
	}
}