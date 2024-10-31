import BaseMessage from "./BaseMessage.js";
import LoverManager from "../managers/LoverManager.js";
import Dialogue from "./Dialogue.js";
import User from "./User.js";
import MessageType from "../utils/MessageType.js";

export default class Message extends BaseMessage {
	author = null;
	lovers = new LoverManager(this);
	reports = 0;
	stickerId = null;
	constructor(data, dialogue, { partial, cache } = {}) {
		if (data instanceof Message) return data;
		if (data instanceof Object && dialogue instanceof Object && dialogue.hasOwnProperty('messages')) {
			let id = data.id || data.objectId;
			let entry = dialogue.messages.cache.get(id);
			if (entry) {
				entry._patch(data);
				return entry
			}
		}
		super(...Array.prototype.slice.call(arguments, 0, 2), { checkCache: true }),
		Object.defineProperties(this, {
			deleted: { value: false, writable: true },
			editHistory: { value: null, writable: true },
			originalContent: { value: null, writable: true },
			partial: { value: partial || this.partial, writable: true },
			sticker: { value: null, writable: true }
		}),
		this._patch(data);
		let userData = data.sender || User.resolve(data, 'sender');
		userData.id !== this.id && (this.author = data.sender instanceof User ? data.sender : new User(userData, this));
		false !== cache && this.id !== null && this.hasOwnProperty('client') && dialogue.messages.cache.set(this.id, this)
	}

	get deletable() {
		return this.dialogue.founderId === this.client.user.id || this.dialogue.admins.has(this.client.user.id)
	}

	_patch(data, shallowPatch) {
		if (typeof data != 'object' || data == null) return;
		shallowPatch || super._patch(...arguments);
		data.sender instanceof User && (this.author ||= data.sender);
		for (let key in data) {
			switch (key) {
			case 'accessories':
				this.author._patch({ avatar: { [key]: data[key] }});
				break;
			case 'avatar':
			case 'blessed':
				this.author._patch({ [key]: data[key] });
				break;
			case 'deleted':
				this[key] = data[key];
				break;
			// case 'color':
			case 'hexColor':
				this.author._patch({ [key]: data[key] });
				break;
			case 'likes':
			case 'likesCount':
				this.author && (this.author.karma += data[key] - this.likes),
				this.likes = data[key],
				this.lovers.total = data[key];
				break;
			// case 'replyToId':
			// 	if (this.reference !== null) break;
			// 	this.referenceId = data[key];
			// 	this.dialogue !== null && Object.defineProperty(this, 'reference', { value: new this.constructor({ id: data[key] }, this.dialogue), writable: false });
			// 	break;
			case 'reports':
			case 'reportsCount':
				this.reports = data[key];
				break;
			case 'sender':
				data.id === '61I6aBTTs6' && console.log(data[key])
				let sender = data[key] instanceof User ? data[key] : new User(data[key], this);
				if (data.type === MessageType.MESSAGE_LIKE) {
					this.lovers.cache.set(sender.id, sender);
					break;
				}
				this.author = sender;
				break;
			case 'senderId':
				if (data.type === MessageType.MESSAGE_LIKE) {
					let liker = new User({ id: data[key] }, this);
					this.lovers.cache.set(liker.id, liker);
					break;
				}
			case 'messageSenderId':
				if (this.author) break;
				if (this.client.users.cache.has(data[key])) {
					this.author = this.client.users.cache.get(data[key]);
					break;
				}
				this.author = new User({ id: data[key] }, this, { partial: this.partial /* , cache: !this.partial */ });
				break;
			case 'sendersName':
				this.author._patch({ profileName: data[key] });
				break;
			case 'sticker':
				this.stickerId = data[key],
				this.sticker === null && (this.sticker = this.attachments.get(data[key]));
				break;
			case 'message':
			case 'text':
				if (typeof data[key] != 'string' || data[key] === this.id) break;
				this.content !== null && (this.originalContent === null && (this.originalContent = this.content),
				this.editHistory === null && (this.editHistory = []),
				this.editHistory.push(this.content))
			}
		}
	}

	/**
	 * Delete this message
	 * @returns {Promise<Message>}
	 */
	delete() {
		return this.client.requests.post("functions/v2:chat.message.delete", {
			messageId: this.id
		}).then(res => {
			if (!res) {
				throw new Error("Something went wrong! Failed to delete message.");
			}
			this.deleted = true;
			return this
		})
	}

	/**
	 * Edit the contents of this message
	 * @returns {Promise<Message>}
	 */
	async edit(text) {
		return this.client.requests.post("functions/v2:chat.message.changeText", {
			messageId: this.id,
			text
		}).then(res => {
			if (!res) {
				throw new Error("Something went wrong! Failed to edit message.");
			}
			this.client.debug && console.log(res);
			this.client.emit('debug', { event: "editMessage", result: res });
			return this._patch(res)
		})
	}

	/**
	 * Fetch this message
	 * @param {boolean} [force]
	 * @returns {Promise<this>}
	 */
	async fetch(force) {
		await this.author.fetch(force);
		if (!force && !this.partial) {
			return this;
		}
		return this.dialogue.messages.fetch(this.id, { force: true }).then(this._patch.bind(this))
	}

	/**
	 * Send love to the author for this message
	 * @returns {Promise<Message>}
	 */
	async like() {
		return this.client.requests.post("functions/v2:chat.message.love", {
			messageId: this.id
		}).then(result => {
			this.lovers.cache.set(this.client.user.id, this.client.user);
			return this._patch({ likesCount: result })
		})
	}

	/**
	 * Reply to this message
	 * @param {string} content
	 * @param {object} [options]
	 * @param {Iterable} [options.attachments]
	 * @param {boolean} [options.prependReference] whether to quote the reference message in your message
	 * @returns {Promise<Message>}
	 */
	async reply({ attachments, content, prependReference } = {}) {
		if (typeof arguments[0] != 'object') return this.reply(Object.assign(...Array.prototype.slice.call(arguments, 1), { content: arguments[0] }));
		return this.client.requests.post("functions/v2:chat.message.sendText", {
			dialogueId: this.dialogueId,
			replyToId: this.id,
			text: (prependReference ? '>>> ' + this.content.replace(/^(?=>).+\n/, '').replace(/^(.{40})(.|\n)+/, "$1…") + '\n' : '') + content
		}).then(data => {
			if (data.flags === 3) {
				throw new Error(data.text);
			} else if (attachments && attachments.length > 0) {
				return Promise.all(attachments.map(attachment => {
					return this.sendMedia(attachment.url)
				})).then(attachments => Object.assign(data, { attachments }))
			}
			return new this.constructor(data, this.dialogue)
		})
	}

	/**
	 * Reply to this message with a media file
	 * @param {string} mediaURL
	 * @returns {Promise<Message>}
	 */
	async replyWithMedia(mediaURL) {
		let contentType = 'image'
		  , dataURI = await fetch(mediaURL).then(r => {
			contentType = r.headers.get('content-type');
			return r.arrayBuffer()
		}).then(r => btoa(new Uint8Array(r).reduce((data, byte) => data + String.fromCharCode(byte), '')));
		return this.client.requests.post("functions/v2:chat.message.send" + (/^image/i.test(contentType) ? 'Photo' : 'Video'), {
			body: dataURI,
			dialogueId: this.dialogueId,
			replyToId: this.id
		}).then(data => {
			if (data.flags === 3) {
				throw new Error(data.text);
			}
			return new this.constructor(data, this.dialogue)
		})
	}

	report() {
		return this.client.requests.post("functions/v2:chat.mod.sendComplaint", {
			dialogueId: this.dialogueId,
			isPrivate: this.dialogue && this.dialogue.constructor === Dialogue,
			messageId: this.id,
			reason: 'ChatReportFlags[]', // unfinished
			userId: this.author.id
		})
		// return this.client.requests.post("functions/v2:chat.message.action", {
		// 	action: 'report',
		// 	messageId: this.id
		// })
	}

	stickerURL() {
		if (this.stickerId === null) return null;
		return "https://gfx.antiland.com/stickers/" + this.stickerId
	}
}