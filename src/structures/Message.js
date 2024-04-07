import BaseStructure from "./BaseStructure.js";
import LoverManager from "../managers/LoverManager.js";
import Dialogue from "./Dialogue.js";
import User from "./User.js";

export default class Message extends BaseStructure {
	author = new User(null, this);
	content = null;
	dialogueId = null;
	lovers = new LoverManager(this);
	referenceId = null;
	constructor(data, dialogue, ignoreCache) {
		if (data instanceof Message) return data;
		if (data instanceof Object && dialogue instanceof Object && dialogue.hasOwnProperty('messages')) {
			let id = data.id || data.objectId;
			let entry = dialogue.messages.cache.get(id);
			if (entry) {
				entry._patch(data);
				return entry
			}
		}
		super(...arguments, true);
		let isDialogue = dialogue instanceof Dialogue;
		Object.defineProperties(this, {
			dialogue: { value: isDialogue ? dialogue : null, writable: !isDialogue },
			edits: { value: null, writable: true },
			originalContent: { value: null, writable: true },
			reference: { value: null, writable: true }
		});
		this._patch(data);
		!ignoreCache && this.id !== null && this.hasOwnProperty('client') && dialogue.messages.cache.set(this.id, this)
	}

	get deletable() {
		return this.dialogue.founderId === this.client.user.id || this.dialogue.admins.has(this.client.user.id)
	}

	_patch(data, shallowPatch) {
		if (typeof data != 'object' || data == null) return;
		shallowPatch || super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'avatar':
				this.author._patch({ avatar: { idx: data[key] }});
				break;
			case 'dialogue':
				if (this[key] !== null) break;
				if (typeof data[key] == 'object') {
					if (this.dialogue instanceof Dialogue) {
						this.dialogue._patch(data[key]);
					} else if (data[key] instanceof Dialogue) {
						Object.defineProperty(this, key, { value: data[key], writable: false });
					} else {
						Object.defineProperty(this, key, { value: new Dialogue(data[key], this), writable: false });
					}
					this.dialogueId === null && this.dialogue.id && (this.dialogueId = this.dialogue.id);
					break;
				}
			case 'dialogueId':
				this.dialogue === null && Object.defineProperty(this, 'dialogue', { value: new Dialogue({ id: data[key] }, this), writable: false });
				this.dialogueId = data[key];
				break;
			// case 'color':
			case 'hexColor':
				this.color = parseInt(data[key].replace(/^#/, ''), 16);
			case 'blessed':
				this[key] = data[key];
				break;
			case 'likes':
			case 'likesCount':
				this.likes = data[key];
				break;
			case 'media':
				this[key] ||= {};
				for (let prop in data[key]) {
					switch (prop) {
					case 'source':
					case 'url':
						this[key].url = data[key][prop];
						break;
					case 'thumb':
					case 'thumbUrl':
						this[key].thumb = data[key][prop];
					}
				}
				break;
			case 'replyToId':
				if (this.reference !== null) break;
				this.referenceId = data[key];
				this.dialogue !== null && Object.defineProperty(this, 'reference', { value: new Message({ id: data[key] }, this.dialogue), writable: false });
				break;
			case 'sender':
				let author = data[key] instanceof User ? data[key] : new User(data[key], this);
				this.author = author;
				break;
			case 'senderId':
				if (/^message_like$/i.test(data.type)) {
					let liker = new User({ id: data[key] }, this);
					this.lovers.cache.set(liker.id, liker);
					break;
				}
			case 'messageSenderId':
				if (this.client.users.cache.has(data[key])) {
					this.author = this.client.users.cache.get(data[key]);
					break;
				}
				this.author._patch({ id: data[key] });
				break;
			case 'sendersName':
				this.author._patch({ profileName: data[key] });
				break;
			case 'sticker': // https://gfx.antiland.com/stickers/a10
				this.content = "https://gfx.antiland.com/stickers/" + data[key];
				break;
			case 'message': // [sticker=svd2021:3]
			case 'text':
				if (typeof data[key] != 'string' || data[key] === this.id) break;
				this.content !== null && (this.originalContent === null && Object.defineProperty(this, 'originalContent', { value: this.content, writable: false }),
				this.edits === null && Object.defineProperty(this, 'edits', { value: [], writable: false }),
				this.edits.push(this.content));
				this.content = data[key]
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
			return this
		})
	}

	/**
	 * Edit the contents of this message
	 * @returns {Promise<Message>}
	 */
	edit(text) {
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
		if (!force && !Object.values(this).includes(null)) {
			return this;
		}
		return this.dialogue.messages.fetch(this.id, { force }).then(this._patch.bind(this))
	}

	/**
	 * Send love to the author for this message
	 * @returns {Promise<Message>}
	 */
	like() {
		return this.client.requests.post("functions/v2:chat.message.love", {
			messageId: this.id
		}).then(result => {
			(this.lovers ||= new Map()).set(this.client.user.id, this.client.user);
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
		let contentType = 'image';
		let dataURI = await fetch(mediaURL).then(r => {
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

	/**
	 * Translate this message
	 * @param {string} [locale] preferred locale
	 * @returns {Promise<string>}
	 */
	translate(locale = 'en') {
		return this.client.requests.post("functions/v2:chat.message.translate", {
			lang: locale,
			messageId: this.id,
			persist: false,
			text: this.content
		})
	}
}