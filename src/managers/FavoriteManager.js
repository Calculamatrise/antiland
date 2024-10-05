import BaseManager from "./BaseManager.js";

export default class FavoriteManager extends BaseManager {
	async _cache(...items) {
		let backup = false;
		if (items.length > 0) {
			if (Array.isArray(items[0])) {
				return this._cache(...items[0])
			}

			for (let channelId of items.filter(({ id } = {}) => id)) {
				await this.client.client.dialogues.fetch(channelId).then(entry => {
					this.cache.set(entry.id, entry)
				}).catch(err => {
					backup = true,
					this.client.client.emit('warn', 'Channel favourite not found: ' + err.message)
				})
			}
		}

		backup && await this.backup();
		return this.cache
	}

	async fetch(id, { force } = {}) {
		if (!force && this.cache.size > 0) {
			if (id && this.cache.has(id)) {
				return this.cache.get(id);
			} else if (!id) {
				return this.cache;
			}
		}

		return this.client.client.requests.post("functions/v2:profile.me").then(async data => {
			return this._cache(data.favorites).then(cache => {
				return id ? cache.get(id) ?? null : cache
			})
		})
	}

	/**
	 * Add a chat to your favourites
	 * @param {string} channelId
	 * @returns {Promise<object>}
	 */
	async add(channelId) {
		channelId instanceof Object && (channelId = channelId.id);
		if (!this.cache.has(channelId)) {
			let entry = await this.client.client.dialogues.fetch(channelId);
			if (!entry) {
				throw new Error("Dialogue not found!");
			}
			this.cache.set(entry.id, entry),
			await this.backup()
		}
		return true
	}

	/**
	 * Backup favourites
	 * @returns {ClientUser}
	 */
	async backup() {
		return this.client.client.requests.post("functions/v2:profile.backup", {
			favorites: Array.from(this.cache.keys())
		}).then(this.client._patch.bind(this.client))
	}

	/**
	 * Remove a chat from your favourites
	 * @param {string} channelId
	 * @returns {Promise<object>}
	 */
	async remove(channelId) {
		channelId instanceof Object && (channelId = channelId.id);
		return this.cache.has(channelId) && (this.cache.delete(channelId),
		await this.backup())
	}
}