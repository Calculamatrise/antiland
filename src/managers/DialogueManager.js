import BaseManager from "./BaseManager.js";
import Dialogue from "../structures/Dialogue.js";
import Group from "../structures/Group.js";

export default class DialogueManager extends BaseManager {
	async fetch(id, { force } = {}) {
		if (!force && this.cache.has(id)) {
			return this.cache.get(id);
		}

		return this.client.requests.post("functions/v2:chat.byId", {
			dialogueId: id
		}).then(data => {
			if (data) {
				let entry = new (/^(group|public)$/i.test(data.type) ? Group : Dialogue)(data, this);
				this.cache.set(entry.id, entry);
				return entry
			}
			return null
		})
	}

	/**
	 * Block a dialogue - unsure what this does
	 * @param {string} dialogueId
	 * @returns {Promise<boolean>}
	 */
	block(dialogueId) {
		return this.client.requests.post("functions/v2:chat.block", {
			dialogueId
		}).then(result => {
			if (result && this.cache.has(dialogueId)) {
				let dialogue = this.cache.get(dialogueId);
				dialogue.blocked = true;
			}
			return result
		})
	}

	/**
	 * Edit the contents of an existing message
	 * @param {string} messageId
	 * @param {string} content
	 * @returns {Promise<object?>}
	 */
	editMessage(messageId, content) {
		return this.client.requests.post("functions/v2:chat.message.changeText", {
			messageId: messageId,
			text: content
		})
	}

	/**
	 * Fetch message history
	 * @param {string} dialogueId
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<Iterable<object>>}
	 */
	async history(dialogueId, { force } = {}) {
		let dialogue = this.cache.get(dialogueId);
		if (!dialogue) {
			dialogue = await this.fetch(dialogueId);
		}
		return dialogue.messages.fetch({ force })
	}

	/**
	 * Leave a dialogue
	 * @param {string} dialogueId
	 * @returns {Promise<unknown>}
	 */
	leave(dialogueId) {
		this.client.closeChannel(dialogueId);
		return this.client.requests.post("functions/v2:chat.leave", { dialogueId }).then(result => {
			result && (this.cache.delete(dialogueId),
			this.client.groups.cache.delete(dialogueId));
			return result
		})
	}

	/**
	 * Start a random chat
	 * @param {Iterable} lastUsers
	 * @param {object} [options]
	 * @param {boolean} [options.unique] Whether to find a unique chat
	 * @returns {Promise<unknown>}
	 */
	random(lastUsers = null, { unique } = {}) {
		if (lastUsers instanceof Object && !Array.isArray(lastUsers)) return this.random(null, lastUsers);
		return this.client.fetch("functions/v2:chat.newRandom", {
			lastUsers: Array.from(lastUsers || (unique && lastUsers) || [])
		})
	}

	/**
	 * Send a message
	 * @param {string} dialogueId
	 * @param {string} content
	 * @param {object} [options]
	 * @param {Iterable} [options.attachments]
	 * @param {object} [options.reference]
	 * @param {string} [options.referenceId]
	 * @returns {Promise<object>}
	 */
	send(dialogueId, content, { attachments, reference, referenceId } = {}) {
		referenceId && (reference = Object.assign({}, reference, { id: referenceId }));
		return this.client.requests.post("functions/v2:chat.message.sendText", Object.assign({
			dialogueId,
			text: content
		}, reference && Object.assign({
			replyToId: reference.id
		}, reference.content && {
			text: '>>> ' + reference.content?.replace(/^(?=>).+\n/, '').replace(/(.{36})..+/, "$1…") + '\n' + content
		}))).then(data => {
			if (data.flags === 3) {
				throw new Error(data.text);
			} else if (data && attachments && attachments.length > 0) {
				return Promise.all(attachments.map(attachment => {
					return this.sendMedia(attachment.url)
				})).then(results => results.concat(data))
			}
			return data // new Message() ?
		})
	}

	/**
	 * Send any sticker regardless of whether you own it
	 * @param {string} dialogueId
	 * @param {string} stickerId
	 * @returns {Promise<unknown>}
	 */
	sendAnySticker(dialogueId, stickerId) {
		return this.sendMedia(dialogueId, "https://gfx.antiland.com/stickers/" + stickerId, Array.prototype.slice.call(arguments, 2))
	}

	/**
	 * Like a message
	 * @param {string} messageId
	 * @returns {Promise<number>} Number of likes
	 */
	sendLove(messageId) {
		return this.client.requests.post("functions/v2:chat.message.love", { messageId }).then(r => {
			console.log(r);
			return r
		})
	}

	/**
	 * Send media files
	 * @param {string} dialogueId
	 * @param {string} mediaURL
	 * @param {object} [options]
	 * @param {object} [options.reference]
	 * @param {string} [options.referenceId]
	 * @returns {Promise<object>}
	 */
	async sendMedia(dialogueId, mediaURL, { reference, referenceId } = {}) {
		let contentType = 'image';
		let dataURI = await fetch(mediaURL).then(r => {
			contentType = r.headers.get('content-type');
			return r.arrayBuffer()
		}).then(r => btoa(new Uint8Array(r).reduce((data, byte) => data + String.fromCharCode(byte), '')));
		referenceId && (reference = Object.assign({}, reference, { id: referenceId }));
		return this.client.requests.post("functions/v2:chat.message.send" + (/^image/i.test(contentType) ? 'Photo' : 'Video'), Object.assign({
			body: dataURI,
			dialogueId
		}, reference && {
			replyToId: reference.id
		})).then(data => {
			if (data.flags === 3) {
				throw new Error(data.text);
			}
			return data
		})
	}

	sendSticker(dialogueId, stickerId, { force, reference, referenceId } = {}) {
		referenceId && (reference = Object.assign({}, reference, { id: referenceId }));
		return this.client.requests.post("functions/v2:chat.message.sendSticker", Object.assign({
			dialogueId,
			sticker: stickerId
		}, reference && {
			replyToId: reference.id
		})).then(data => {
			if (data.flags === 3) {
				throw new Error(data.text);
			}
			return data
		})
	}

	/**
	 * Unsend a message
	 * @param {string} messageId
	 * @returns {Promise<boolean>}
	 */
	unsend(messageId) {
		return this.client.requests.post("functions/v2:chat.message.delete", { messageId })
	}
}