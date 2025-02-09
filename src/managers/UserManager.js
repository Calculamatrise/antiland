import Dialogue from "../structures/Dialogue.js";
import User from "../structures/User.js";
import BaseManager from "./BaseManager.js";

export default class extends BaseManager {
	#randomCache = null;
	async fetch(id, { force } = {}) {
		if (!force && this.cache.has(id)) {
			return this.cache.get(id);
		}

		return this.client.rest.post("functions/v2:profile.byId", {
			userId: id
		}).then(data => {
			if (data) {
				let entry = new User(data, this);
				this.cache.set(entry.id, entry);
				return entry
			}
			return null
		})
	}

	/**
	 * Search existing users
	 * @param {string} query
	 * @param {object} [options]
	 * @param {boolean} options.cache
	 * @returns {Promise<Iterable<User>>}
	 */
	async search(query, { cache } = {}) {
		return this.client.rest.post("functions/v2:profile.search", {
			search: query
		}).then(data => {
			for (let item in data) {
				let entry = new User(data[item], this);
				cache && this.cache.set(entry.id, entry);
				data[item] = entry;
			}
			return data
		})
	}

	/**
	 * Register an account
	 * @param {object} options
	 * @param {string} options.username
	 * @param {string} options.password
	 * @returns {Promise<User>}
	 */
	async create({ username, password }) {
		return this.client.rest.post("functions/v2:profile.register", {
			username,
			password,
			lang: 'en'
		}).then(data => {
			let entry = new User(data, this);
			this.cache.set(entry.id, entry);
			return entry
		})
	}

	/**
	 * Check if a user is blocked
	 * @param {User|string} user
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<boolean>}
	 */
	async checkPrivateBlocked(user, { force } = {}) {
		let userId = typeof user == 'object' ? user.id : user;
		if (!force && this.client.user.blockedBy.has(userId)) {
			return true;
		}
		return this.client.rest.post("functions/v2:contact.checkPrivateBlocked", { userId })
	}

	/**
	 * Check if you are blocked
	 * @param {User|string} user
	 * @param {object} [options]
	 * @param {boolean} options.force
	 * @returns {Promise<boolean>}
	 */
	async getBanInfo(userId) {
		return this.client.rest.post("functions/v2:contact.getBanInfo", { userId }).then(r => {
			r.banned && console.log(r);
			return r.banned && r
		})
	}

	/**
	 * Start a private chat
	 * @param {User|string} user
	 * @param {object} [options]
	 * @param {boolean} options.createIfNotExists
	 * @returns {Promise<Dialogue>}
	 */
	async fetchDM(user, { createIfNotExists = false } = {}) {
		let userId = typeof user == 'object' ? user.id : user;
		if (this.client.user.blockedBy.has(userId)) {
			throw new Error("You are blocked by this user.");
		} else if (this.cache.has(userId)) {
			let user = this.cache.get(userId);
			if (user.dmChannel !== null) {
				return user.dmChannel
			}
		}
		return this.client.rest.post("functions/v2:chat.getPrivate", {
			createIfNotExists,
			userId
		}).then(data => new Dialogue(data, this))
	}

	/**
	 * Find a random user profile
	 * @param {Iterable} [lastUsers]
	 * @param {object} [options]
	 * @param {boolean} options.unique Whether to filter old randoms
	 * @returns {Promise<User>}
	 */
	async random(lastUsers, { unique } = {}) {
		if (lastUsers instanceof Object && !Array.isArray(lastUsers)) return this.random(null, lastUsers);
		return this.client.rest.post("functions/v2:profile.random", {
			lastUsers: Array.from(lastUsers || (unique && this.#randomCache) || [])
		}).then(data => {
			let entry = new User(data, this.client);
			this.#randomCache ||= new Set();
			this.#randomCache.add(entry.id);
			return entry
		})
	}

	/**
	 * Gift another user
	 * @param {string|object} user
	 * @param {object} [options]
	 * @param {string} [options.artifactName]
	 * @param {string} [options.currency]
	 * @param {string} [options.dialogueId]
	 * @param {string} [options.receiverId]
	 * @returns {Promise<unknown>}
	 */
	async sendGift(user, { artifactName = 'rose', currency = 'karma', dialogueId } = {}) {
		if (typeof user == 'object') return this.sendGift(user.receiverId, user);
		let receiverId = typeof user == 'object' ? user.id : user;
		return this.client.rest.post("functions/v2:purchase.gift", {
			artifactName,
			currency, // karma or tokens
			dialogueId,
			receiverId
		})
	}
}