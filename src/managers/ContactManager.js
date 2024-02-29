import BaseManager from "./BaseManager.js";
import User from "../structures/User.js";

export default class ContactManager extends BaseManager {
	blocked = new Set();
	async fetch({ force } = {}) {
		if (!force && this.cache.size > 0) {
			return this.cache
		}

		return this.client.client.requests.post("functions/v2:friend.list").then(async entries => {
			for (let item of entries) {
				let entry = new User(item, this.client);
				await entry.getPrivateChat();
				this.cache.set(entry.id, entry);
			}
			return this.cache
		});
	}

	async fetchBlocked({ force } = {}) {
		if (force || this.blocked.size < 1) {
			let blocked = await this.client.client.requests.post("functions/v2:contact.listBlocked");
			if (blocked.length > 0) {
				// this.blocked = new Set(); // new Map();
				for (let data of blocked) {
					let user = new User(data, this.client);
					user.blocked = true;
					this.client.client.users.cache.set(user.id, user);
					this.blocked.add(user.id);
				}
			}
		}
		return this.blocked
	}

	/**
	 * Add a contact
	 * @param {User|string} user 
	 * @returns {Promise<object>}
	 */
	add(user) {
		let id = typeof user == 'object' ? user.id : user;
		return this.client.client.requests.post("functions/v2:friend.add", { id }).then(r => {
			return r && this.cache.set(id, this.client.client.users.cache.get(id));
		})
	}

	/**
	 * Block another user
	 * @param {User|string} user
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<boolean>}
	 */
	async block(user, { force } = {}) {
		let userId = typeof user == 'object' ? user.id : user;
		if (!force && this.blocked.has(userId)) {
			return true;
		} else if (this.client.client.user.friends.cache.has(userId)) {
			if (!force) {
				throw new Error("Cannot block a user that is your friend.");
			}
			await this.client.client.user.friends.remove(userId);
		}
		return this.client.client.requests.post("functions/v2:contact.blockPrivate", { userId }).then(r => {
			return r && (this.blocked.add(userId), r)
		})
	}

	/**
	 * Check if a user is blocked
	 * @param {User|string} user
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<boolean>}
	 */
	async isBlocked(user, { force } = {}) {
		let userId = typeof user == 'object' ? user.id : user;
		if (!force && this.blocked.has(userId)) {
			return true;
		}
		return this.client.client.requests.post("functions/v2:contact.checkPrivateBlocked", { userId }).then(r => {
			return r && (this.blocked.add(userId), r)
		})
	}

	/**
	 * Check if you are blocked
	 * @param {User|string} user
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<boolean>}
	 */
	async isClientBlocked(user, { force } = {}) {
		let userId = typeof user == 'object' ? user.id : user;
		if (!force && this.client.client.user.blockedBy.has(userId)) {
			return true;
		}
		return this.client.client.requests.post("functions/v2:contact.getBanInfo", { userId }).then(r => {
			return r && (this.client.client.user.blockedBy.add(userId), r)
		})
	}

	/**
	 * Save contacts
	 * @param {Set|Array} [contacts]
	 */
	register(contacts) {
		return this.client.client.requests.post("functions/v2:profile.registerContacts", {
			contacts: contacts || Array.from(this.cache.keys())
		})
	}

	/**
	 * Remove friend
	 * @param {User|string} user 
	 * @returns {Promise<object>}
	 */
	remove(user) {
		let id = typeof user == 'object' ? user.id : user;
		return this.client.client.requests.post("functions/v2:friend.delete", { id }).then(r => {
			return r && this.cache.delete(id);
		})
	}

	/**
	 * Unblock a blocked contact
	 * @param {User|string} userId
	 * @returns {Promise<boolean>}
	 */
	unblock(user) {
		let userId = typeof user == 'object' ? user.id : user;
		return this.client.client.requests.post("functions/v2:contact.unblockPrivate", { userId }).then(r => {
			return r && (this.blocked.delete(userId), r)
		})
	}

	unblockAll() {
		return this.client.client.requests.post("functions/v2:contact.unblockAllPrivate").then(r => {
			return r && (this.blocked.clear(), r)
		})
	}
}