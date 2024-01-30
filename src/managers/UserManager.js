import Client from "../client/Client.js";
import Dialogue from "../structures/Dialogue.js";
import User from "../structures/User.js";
import BaseManager from "./BaseManager.js";

export default class extends BaseManager {
	async fetch(id, { force } = {}) {
		if (!force && this.cache.has(id)) {
			return this.cache.get(id);
		}

		return this.client.requests.post("functions/v2:profile.byId", {
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
	 * @param {boolean} [options.cache]
	 * @returns {Promise<Iterable<User>>}
	 */
	async search(query, { cache } = {}) {
		return this.client.requests.post("functions/v2:profile.search", {
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
	async create({ username, password } = {}, { badgeColor, maxAttempts = 25 } = {}) {
		if (badgeColor) {
			let result;
			let client = new Client();
			for (let i = 0; i < maxAttempts; i++) {
				result = await this.create({ username, password }).then(r => r || this.client.requests.post("functions/v2:profile.login", {
					username,
					password
				}));
				if (!result) throw new Error("Something went wrong!");
				if (result.badgeColor.toLowerCase() === badgeColor.toLowerCase()) {
					result = new User(result, this);
					this.cache.set(entry.id, result);
					break
				}

				// await client.login(result.sessionToken || result.auth.sessionToken);
				await client.requests.attachToken(result.sessionToken || result.auth.sessionToken);
				await client.requests.post("functions/saveUserData", { username: 'throwaway' + Math.random() });
				await client.requests.post("functions/v2:profile.softDelete")
			}
			client.close();
			client = null;
			return result
		}

		return this.client.requests.post("functions/v2:profile.register", {
			username,
			password,
			lang: 'en'
		}).then(data => {
			let entry = new User(data, this);
			this.cache.set(entry.id, entry);
			return entry
		})
	}

	checkPrivateBlocked(userId) {
		return this.client.requests.post("functions/v2:contact.checkPrivateBlocked", { userId })
	}

	getBanInfo(userId) {
		return this.client.requests.post("functions/v2:contact.getBanInfo", { userId }).then(r => {
			r.banned && console.log(r);
			return r.banned && r
		})
	}

	/**
	 * Start a private chat
	 * @param {User|string} userId
	 * @param {object} [options]
	 * @param {boolean} [options.createIfNotExists] 
	 * @returns {Promise<Dialogue>}
	 */
	async getPrivateChat(userId, { createIfNotExists = false } = {}) {
		return this.client.requests.post("functions/v2:chat.getPrivate", {
			createIfNotExists,
			userId: typeof userId == 'object' ? userId.id : userId
		}).then(data => {
			let dialogue = new Dialogue(data, this);
			this.dialogue = dialogue;
			this.dialogueId = dialogue.id;
			return dialogue
		});
	}

	lastUsers = new Set();
	newRandom() {
		return this.client.requests.post("functions/v2:chat.newRandom", {
			lastUsers: this.lastUsers
		}).then(r => {
			// cache last user
			return r
		})
	}

	sendGift({ artifactName, currency = 'karma', dialogueId, receiverId } = {}) {
		return this.client.requests.post("functions/v2:purchase.gift", {
			artifactName,
			currency, // karma or tokens
			dialogueId,
			receiverId
		})
	}
}