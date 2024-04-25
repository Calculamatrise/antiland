import BaseManager from "./BaseManager.js";
import GiftMessage from "../structures/GiftMessage.js";
import Message from "../structures/Message.js";

export default class MessageManager extends BaseManager {
	constructor() {
		super(...arguments);
		let maxCacheSize = (this.client.options && (this.client.options.configuredHistoryLength ?? this.client.options.historyLength)) ?? 50;
		Object.defineProperty(this.cache, 'set', {
			value: function set() {
				if (this.size >= maxCacheSize) {
					for (let entry of Array.from(this.values()).sort((a, b) => a.createdAt - b.createdAt).slice(0, 4)) {
						this.delete(entry.id);
					}
				}
				return Map.prototype.set.apply(this, arguments)
			}
		})
	}

	get manageable() {
		return this.client.manageable || this.client.admins.has(this.client.client.user.id)
	}

	async fetch(id, { cache, force, limit = 100, since } = {}) {
		if (id instanceof Object) return this.fetch(null, id);
		if (!force && this.cache.size > 0) {
			if (!id) {
				return this.cache;
			} else if (this.cache.has(id)) {
				return this.cache.get(id);
			}
		}

		return this.client.client.requests.post("functions/v2:chat.message.history", Object.assign({
			dialogueId: this.client.id,
			fetch: limit ?? 300
		}, since instanceof Date && {
			since: {
				__type: 'Date',
				iso: since.toISOString()
			}
		})).then(async ({ messages, removes }) => {
			if (id) {
				if (removes && removes.includes(id)) return new Message({ deleted: true, id }, this.client, { cache: false });
				let data = messages.find(data => data.id == id);
				if (data) {
					await this.client.client.preprocessMessage(data, { channelId: this.client.id });
					let entry = new Message(data, this.client);
					cache && this.cache.set(entry.id, entry);
					return entry;
				}
				return null;
			}
			let sort = this.cache.size === 1 && this.cache.has(this.client.lastMessageId);
			for (let item of messages.sort((a, b) => Date.parse(a.createdAt.iso) - Date.parse(b.createdAt.iso))) {
				await this.client.client.preprocessMessage(item, { channelId: this.client.id });
				let entry = new Message(item, this.client);
				this.cache.set(entry.id, entry);
			}
			if (sort) {
				let values = Array.from(this.cache.values()).sort((a, b) => a.createdAt - b.createdAt);
				this.cache.clear();
				for (let item of values) {
					this.cache.set(item.id, item);
				}
			}
			return id ? this.cache.get(id) ?? null : this.cache
		})
	}

	/**
	 * Await messages
	 * @param {object} [options]
	 * @param {Iterable} [options.errors]
	 * @param {function} [options.filter]
	 * @param {number} [options.idle]
	 * @param {number} [options.max]
	 * @param {number} [options.maxProcessed]
	 * @param {number} [options.time]
	 * @param {function} [callback]
	 * @returns {Promise<Map<string, Message>>}
	 */
	await({ errors, filter, idle, max, maxProcessed, time } = {}, callback) {
		let counter = 0;
		let processedCounter = 0;
		let messages = new Map();
		return new Promise((resolve, reject) => {
			let timeout = time && setTimeout(() => {
				this.client.client.off('messageCreate', listener);
				if (errors && errors.includes('time')) {
					reject(messages);
				}
				reject(new RangeError("Time limit exceeded."));
			}, time);
			let idleTimeout = idle && setTimeout(() => {
				this.client.client.off('messageCreate', listener);
				if (errors && errors.includes('idle')) {
					reject(messages);
				}
				reject(new RangeError("Idle time exceeded."));
			}, idle);
			let listener = message => {
				let checkFilter = filter && !filter(message);
				if (!checkFilter) {
					idle && idleTimeout.refresh();
					messages.set(message.id, message);
					typeof callback == 'function' && callback(message) !== void 0 && (this.client.client.off('messageCreate', listener),
					resolve(messages));
					if (++processedCounter >= maxProcessed) {
						this.client.client.off('messageCreate', listener);
						if (errors && errors.includes('max')) {
							reject(messages);
						}
						return resolve(messages)
					}
				}

				if (++counter >= max) {
					this.client.client.off('messageCreate', listener);
					if (errors && errors.includes('max')) {
						reject(messages);
					}
					return resolve(messages)
				}
			}

			this.client.client.on('messageCreate', listener);
			let removeListener = removedListener => {
				if (removedListener !== listener) return;
				timeout && clearTimeout(timeout);
				idleTimeout && clearTimeout(idleTimeout);
				this.client.client.off('removeListener', removeListener);
				resolve(messages)
			}

			this.client.client.on('removeListener', removeListener)
		})
	}

	/**
	 * Bulk delete messages sent by a user
	 * @protected moderation endpoint for moderators
	 * @param {Iterable|object} options
	 * @param {number} [options.limit] Only valid when no userId is present
	 * @param {string} [options.senderId]
	 * @returns {Promise<boolean>}
	 */
	async bulkDelete({ limit, senderId }) {
		if (typeof arguments[0] == 'number') {
			return this.bulkDelete({ limit: arguments[0] });
		} else if (typeof arguments[0] == 'object' && typeof arguments[0][Symbol.iterator] == 'function') {
			return this.bulkDelete(Array.from(arguments[0].values()));
		} else if (!this.manageable) {
			throw new Error("Insufficient privileges.");
		}
		if (Array.isArray(arguments[0])) {
			for (let message of arguments[0]) {
				await this.delete(typeof message == 'object' ? message.id : message);
			}
			return true
		} else if (!senderId && isFinite(limit)) {
			let messages = Array.from(this.cache.values());
			for (let message of messages.slice(0, limit)) {
				await this.delete(message.id);
			}
			return true
		}
		return this.client.client.requests.post("functions/v2:chat.mod.delete1dMessages", {
			// dialogueId: this.client.id, // not needed???
			senderId
		}).then(result => {
			let messages = Array.from(this.cache.values());
			if (result) {
				for (let message of messages.filter(({ author }) => author.id === senderId)) {
					this.cache.delete(message.id);
				}
			} else {
				return Promise.all(messages.filter(({ author }) => author.id === senderId)).then(() => true);
			}
			return result
		})
	}

	create() {
		return this.client.send(...arguments)
	}

	/**
	 * Delete a message
	 * @protected moderation endpoint for moderators
	 * @param {Message|string} message
	 * @returns {Promise<boolean>}
	 */
	async delete(message) {
		let messageId = typeof message == 'object' ? message.id : message;
		let entry = this.cache.get(messageId);
		if (entry && entry.author.id !== this.client.client.user.id || !this.client.options.setup?.has('OWN_MSG_REMOVE_ALLOWED')) {
			if (!this.manageable) {
				throw new Error("Insufficient privileges.");
			}
			return this.client.client.requests.post("functions/v2:chat.mod.deleteMessage", {
				dialogueId: this.client.id,
				messageId
			}).then(r => r && (entry.deleted = true))
		}
		return this.client.client.requests.post("functions/v2:chat.message.delete", {
			messageId
		}).then(r => r && (entry && (entry.deleted = true), r))
	}

	/**
	 * Edit a message
	 * @param {string} messageId
	 * @param {string} content
	 * @returns {Promise<boolean?>}
	 */
	edit(messageId, content) {
		return this.client.client.requests.post("functions/v2:chat.message.changeText", {
			messageId: messageId,
			text: content
		}).then(r => {
			console.log(r);
			return r
		})
	}

	/**
	 * Like a message - costs K1
	 * @param {string} messageId
	 * @returns {Promise<number>} Number of likes
	 */
	like(messageId) {
		return this.client.requests.post("functions/v2:chat.message.love", { messageId })
	}

	/**
	 * Translate a message
	 * @param {string|Message|object} message
	 * @param {string} [locale]
	 * @returns {Promise<string>}
	 */
	async translate(message, locale = 'en') {
		message = typeof message == 'object' ? message : await this.fetch(message);
		return this.client.client.requests.post("functions/v2:chat.message.translate", {
			lang: locale,
			messageId: message.id,
			persist: false,
			text: message.content
		})
	}
}