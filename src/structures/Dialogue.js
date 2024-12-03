import BaseStructure from "./BaseStructure.js";
import ChannelFlagsBitField from "../utils/ChannelFlagsBitField.js";
import MessageManager from "../managers/MessageManager.js";
import Message from "./Message.js";
import User from "./User.js";

export default class Dialogue extends BaseStructure {
	flags = new ChannelFlagsBitField();
	lastMessageId = null;
	messages = new MessageManager(this);
	constructor(data, options, isGroup) {
		if (data instanceof Dialogue) return data;
		else if (data instanceof Object && options instanceof Object && options.hasOwnProperty('client')) {
			let id = data.id || data.objectId;
			let entry = options.client.dialogues.cache.get(id);
			if (entry) {
				entry._patch(data);
				return entry
			}
		}
		Object.defineProperties(super(...arguments, true), {
			[isGroup ? 'founder' : 'friend']: { value: null, writable: true },
			lastMessage: { value: null, writable: true }
		}),
		isGroup || this._patch(data),
		this.id !== null && this.hasOwnProperty('client') && this.client.dialogues.cache.set(this.id, this)
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'admins':
				this.admins = new Set(data[key]);
				break;
			case 'channelId':
				this.id ??= data[key];
			case 'badgeColor':
			case 'founderId':
			case 'friendId':
			case 'lastMessageId':
			case 'name':
			case 'subType':
			case 'title':
				this[key] = data[key];
				break;
			case 'flags':
				this[key].bitfield = data[key];
				break;
			case 'founder':
			case 'friend':
				this._patch({ [key + 'Id']: typeof data[key] == 'object' ? data[key].id : data[key] });
				if (this[key] !== null) break;
				Object.defineProperty(this, key, { value: new User(data[key], this), writable: false })
				break;
			case 'lastMessage':
				this._patch({ [key + 'Id']: typeof data[key] == 'object' ? data[key].id : data[key] });
				this[key] = data[key] instanceof Message ? data[key] : new Message(typeof data[key] == 'string' ? { id: data[key] } : data[key], this, { partial: true });
				break;
			case 'msgCount':
				this.messages.total = data[key];
				break;
			case 'options':
				this.options ||= {};
				for (let option in data[key]) {
					switch(option) {
					case 'filters':
					case 'setup':
						this[key][option] = new Set(data[key][option]);
						break;
					case 'historySince':
						this[key][option] = new Date(typeof data[key][option] == 'object' ? data[key][option].iso : data[key][option]);
						break;
					default:
						this[key][option] = data[key][option]
					}
				}
			}
		}
		this.friend && !this.friend.dmChannel && Object.defineProperty(this.friend, 'dmChannel', { value: this, writable: false })
	}

	get url() {
		return "https://anti.land/g/" + this.id
	}

	/**
	 * Fetch this dialogue
	 * @param {boolean} [force]
	 * @returns {Promise<this>}
	 */
	async fetch(force) {
		if (!force && !this.partial) {
			return this;
		}
		return this.client.rest.post("functions/v2:chat.byId", {
			dialogueId: this.id
		}).then(this._patch.bind(this))
	}

	leave() {
		return this.client.rest.post("functions/v2:chat.leave", {
			dialogueId: this.id
		})
	}

	rating() {
		return this.client.rest.post("functions/v2:chat.rating", {
			dialogueId: this.id
		})
	}

	/**
	 * Send a message
	 * @param {string|object} content
	 * @param {object} [options]
	 * @param {Iterable<object>} [options.attachments]
	 * @param {string} [options.content]
	 * @param {boolean} [options.prependReference] whether to quote the reference message in your message
	 * @param {Message|string} [options.reference]
	 */
	async send({ attachments, content, prependReference, reference } = {}) {
		if (typeof arguments[0] == 'string') {
			return this.send(Object.assign({}, ...Array.prototype.splice.call(arguments, 1), { content: arguments[0] }));
		} else if (typeof content != 'string' || content.length < 1) {
			if (!attachments) {
				throw new TypeError("You cannot send empty messages to this chat");
			}
			return Promise.all(attachments.map(attachment => {
				return this.sendMedia(attachment.url, { reference })
			}));
		}
		return this.client.rest.post("functions/v2:chat.message.sendText", Object.assign({
			dialogueId: this.id,
			text: content
		}, reference && Object.assign({
			replyToId: reference.id
		}, prependReference && typeof reference.content == 'string' && {
			text: '>>> ' + reference.content.replace(/^(?=>).+\n/, '').replace(/^(.{40})(.|\n)+/, "$1…") + '\n' + content
		}))).then(data => {
			if (data.flags === 3) {
				throw new Error(data.text); // ephemeral response
			} else if (data && attachments && attachments.length > 0) {
				return Promise.all(attachments.map(attachment => {
					return this.sendMedia(attachment.url, { reference })
				})).then(results => results.concat(data))
			}
			this.client._handleMessage(data, { channelId: this.id });
			return data // this.client._handleMessage(data, { channelId: this.id })
		})
	}

	async sendGift() {
		return this.client.users.sendGift(...arguments)
	}

	/**
	 * Send media
	 * @param {string} mediaURL
	 * @param {object} [options]
	 * @param {Message|string} [options.reference]
	 * @returns {Promise<object>}
	 */
	async sendMedia(mediaURL, { reference } = {}) {
		let contentType;
		let dataURI = await fetch(mediaURL).then(r => {
			contentType = r.headers.get('content-type');
			return r.arrayBuffer()
		}).then(r => btoa(new Uint8Array(r).reduce((data, byte) => data + String.fromCharCode(byte), '')));
		return this.client.rest.post("functions/v2:chat.message.send" + (/^image/i.test(contentType) ? 'Photo' : 'Video'), Object.assign({
			body: dataURI,
			dialogueId: this.id
		}, reference ? {
			replyToId: reference.id
		} : null)).then(data => {
			if (data.flags === 3) {
				throw new Error(data.text);
			}
			return data
		})
	}

	sendSticker(stickerId, { reference } = {}) {
		return this.client.rest.post("functions/v2:chat.message.sendSticker", Object.assign({
			dialogueId: this.id,
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
}