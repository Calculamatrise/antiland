import BaseClient from "./BaseClient.js";
import CallManager from "../managers/CallManager.js";
import DialogueManager from "../managers/DialogueManager.js";
import GroupManager from "../managers/GroupManager.js";
import StickerManager from "../managers/StickerManager.js";
import UserManager from "../managers/UserManager.js";
// import Message from "../structures/Message.js";

export default class Client extends BaseClient {
	calls = new CallManager(this);
	dialogues = new DialogueManager(this);
	groups = new GroupManager(this);
	stickers = new StickerManager(this);
	users = new UserManager(this);

	/**
	 * Edit the contents of an existing message
	 * @param {string} messageId
	 * @param {string} content
	 * @returns {Promise<object?>}
	 */
	editMessage(messageId, content) {
		return this.requests.post("functions/v2:chat.message.changeText", {
			messageId: messageId,
			text: content
		})
	}

	/**
	 * Like a message
	 * @param {string} messageId
	 * @returns {Promise<number>} Number of likes
	 */
	likeMessage(messageId) {
		return this.requests.post("functions/v2:chat.message.love", { messageId })
	}

	sendAnySticker(dialogueId, stickerId) {
		return this.sendMedia(dialogueId, "https://gfx.antiland.com/stickers/" + stickerId, Array.prototype.slice.call(arguments, 2))
	}

	async sendMedia(dialogueId, mediaURL, { reference } = {}) {
		let contentType = 'image';
		let dataURI = await fetch(mediaURL).then(r => {
			contentType = r.headers.get('content-type');
			return r.arrayBuffer()
		}).then(r => btoa(new Uint8Array(r).reduce((data, byte) => data + String.fromCharCode(byte), '')));
		return this.requests.post("functions/v2:chat.message.send" + (/^image/i.test(contentType) ? 'Photo' : 'Video'), Object.assign({
			body: dataURI,
			dialogueId
		}, reference ? {
			replyToId: reference.id
		} : null)).then(data => {
			if (data.flags === 3) {
				throw new Error(data.text);
			}
			return data
		})
	}

	sendMessage(dialogueId, content, { attachments, reference } = {}) {
		return this.requests.post("functions/v2:chat.message.sendText", Object.assign({
			dialogueId,
			text: content
		}, reference ? {
			replyToId: reference.id,
			text: '>>> ' + reference.content?.replace(/^(?=>).+\n/, '') + '\n' + content
		} : null)).then(data => {
			if (data.flags === 3) {
				throw new Error(data.text);
			} else if (data && attachments && attachments.length > 0) {
				return Promise.all(attachments.map(attachment => {
					return this.sendMedia(attachment.url)
				})).then(results => results.concat(data))
			}
			return data
		})
	}

	async sendSticker(dialogueId, stickerId, { reference } = {}) {
		return this.requests.post("functions/v2:chat.message.sendSticker", Object.assign({
			dialogueId,
			sticker: stickerId
		}, reference ? {
			replyToId: reference.id
		} : null)).then(data => {
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
	unsendMessage(messageId) {
		return this.requests.post("functions/v2:chat.message.delete", { messageId })
	}
}