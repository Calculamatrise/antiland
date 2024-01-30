import BaseManager from "./BaseManager.js";
import User from "../structures/User.js";

export default class extends BaseManager {
	async fetch({ force } = {}) {
		if (!force && this.cache.size > 0) {
			return this.cache
		}

		return this.client.client.requests.post("functions/v2:profile.me").then(async data => {
			for (let item of data.favorites) {
				let entry = await this.client.client.dialogues.fetch(item).then(dialogue => {
					return dialogue && dialogue.friend;
				}).catch(err => this.users.fetch(item).catch(err => !1));
				if (!entry) continue;
				this.cache.set(entry.id, entry);
			}
			return this.cache
		});
	}

	/**
	 * Add friend
	 * @param {User|string} user 
	 * @returns {Promise<object>}
	 */
	async add(user) {
		let id = typeof user == 'object' ? user.id : user;
		if (!this.cache.has(id)) {
			let entry = await this.client.client.users.fetch(id);
			if (!entry) {
				throw new Error("User not found!");
			}
			let privateChat = await entry.getPrivateChat();
			if (!privateChat) {
				throw new Error("Private chat with user not found!");
			}
			this.cache.set(entry.id, entry);
			await this.backup();
		}
		return true
	}

	/**
	 * Backup favourites
	 * @param {Map|Array|object} [favorites]
	 */
	async backup(favorites) {
		for (let item of Array.from(this.cache.values()).filter(item => !item.dialogueId)) {
			await item.getPrivateChat();
		}
		return this.client.client.requests.post("functions/v2:profile.backup", {
			favorites: favorites || Array.from(this.cache.values()).map(entry => entry.dialogueId ?? entry.id)
		}).then(this.client._update.bind(this.client))
	}

	/**
	 * Remove friend
	 * @param {User|string} user 
	 * @returns {Promise<object>}
	 */
	async remove(user) {
		let id = typeof user == 'object' ? user.id : user;
		return this.cache.delete(id) && (await this.backup(), !0)
	}
}