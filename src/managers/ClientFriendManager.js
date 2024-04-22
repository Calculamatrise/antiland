import FriendManager from "./FriendManager.js";
import FriendRequest from "../structures/FriendRequest.js";
import User from "../structures/User.js";

export default class ClientFriendManager extends FriendManager {
	pending = {
		incoming: new Map(),
		outgoing: new Map()
	}
	async fetch(id, { force } = {}) {
		if (!force && this.cache.size > 0) {
			if (this.cache.has(id)) {
				return this.cache.get(id);
			} else if (!id) {
				return this.cache;
			}
		}

		// if id is present, use isPaired to check individual users
		return this.client.client.requests.post("functions/v2:contact.mate.list").then(data => {
			if (data.awaiting.length > 0) {
				for (let item of data.awaiting) {
					let entry = new FriendRequest(item, this);
					this.pending.incoming.set(entry.id, entry);
				}
			}
			if (data.requested.length > 0) {
				for (let item of data.requested) {
					let entry = new FriendRequest(item, this);
					this.pending.outgoing.set(entry.id, entry);
				}
			}
			for (let item of data.mates) {
				let entry = new User(item, this.client);
				this.cache.set(entry.id, entry);
			}
			return id ? this.cache.get(id) ?? null : this.cache
		})
	}

	/**
	 * Send a friend request
	 * @param {User|string} user 
	 * @returns {Promise<object>}
	 */
	request(user, check) {
		let userId = typeof user == 'object' ? user.id : user;
		if (check) {
			if (this.pending.outgoing.has(userId)) {
				return 'requested';
			} else if (this.cache.has(userId)) {
				return 'paired';
			}
		}
		return this.client.client.requests.post("functions/v2:contact.mate.request" + (check ? 'AndCheck' : ''), { userId }).then(async result => {
			switch(result) {
			case 'paired':
				break;
			case 'requested':
				if (!this.pending.outgoing.has(userId)) {
					break;
				}
			case true:
				let user = await this.client.client.users.fetch(userId);
				let entry = new FriendRequest(user, this);
				this.pending.outgoing.set(entry.id, entry);
			}
			return result
		})
	}

	/**
	 * Add friend
	 * @param {User|string} user 
	 * @returns {Promise<object>}
	 */
	accept(user) {
		let userId = typeof user == 'object' ? user.id : user;
		return this.client.client.requests.post("functions/v2:contact.mate.accept", { userId }).then(result => {
			return result && (this.pending.incoming.delete(userId) && this.cache.set(userId, this.client.client.users.cache.get(userId)),
			result)
		})
	}

	/**
	 * Cancel an outgoing friend request
	 * @param {User|string} user
	 * @returns {Promise<boolean>}
	 */
	cancel(user) {
		let userId = typeof user == 'object' ? user.id : user;
		if (!this.pending.outgoing.has(userId)) {
			throw new Error("You have not sent a friend request to this user.");
		}
		return this.client.client.requests.post("functions/v2:contact.mate.reject", { userId }).then(r => {
			return r && this.pending.outgoing.delete(userId)
		})
	}

	/**
	 * Check if a user is your friend
	 * @param {User|string} user 
	 * @returns {Promise<object>}
	 */
	isPaired(user) {
		let userId = typeof user == 'object' ? user.id : user;
		if (this.pending.outgoing.has(userId)) {
			return 'requested';
		} else if (this.cache.has(userId)) {
			return 'paired';
		}
		return this.client.client.requests.post("functions/v2:contact.mate.isPaired", { userId }).then(async result => {
			switch(result) {
			case 'none':
				return false;
			case 'paired':
				if (!this.cache.has(userId)) {
					let user = await this.client.client.users.fetch(userId);
					let entry = new FriendRequest(user, this);
					this.pending.outgoing.set(entry.id, entry);
				}
				return true;
			case 'requested':
				if (!this.pending.outgoing.has(userId)) {
					break;
				}
			default:
				return result
			}
		})
	}

	/**
	 * Reject a friend request
	 * @param {User|string} user
	 * @returns {Promise<object>}
	 */
	reject(user) {
		let userId = typeof user == 'object' ? user.id : user;
		if (!this.pending.incoming.has(userId)) {
			throw new Error("Friend request not found.");
		}
		return this.client.client.requests.post("functions/v2:contact.mate.reject", { userId }).then(r => {
			return r && this.pending.incoming.delete(userId)
		})
	}

	/**
	 * Remove a friend
	 * @param {User|string} user
	 * @returns {Promise<object>}
	 */
	remove(user) {
		let userId = typeof user == 'object' ? user.id : user;
		if (!this.cache.has(userId)) {
			throw new Error("Friend not found.");
		}
		return this.client.client.requests.post("functions/v2:contact.mate.reject", { userId }).then(r => {
			return r && this.cache.delete(userId)
		})
	}
}