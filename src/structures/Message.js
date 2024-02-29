import BaseStructure from "./BaseStructure.js";
import Dialogue from "./Dialogue.js";
import User from "./User.js";

export default class Message extends BaseStructure {
	author = new User(null, this);
	content = null;
	dialogueId = null;
	reactions = new Map();
	referenceId = null;
	constructor(data, dialogue) {
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
		this.id !== null && this.hasOwnProperty('client') && dialogue.messages.cache.set(this.id, this)
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
						break;
					} else if (data[key] instanceof Dialogue) {
						Object.defineProperty(this, key, { value: data[key], writable: false });
					}
					Object.defineProperty(this, key, { value: new Dialogue(data[key], this), writable: false });
					break;
				}
			case 'dialogueId':
				if (this[key] !== null) break;
				Object.defineProperty(this, 'dialogue', { value: new Dialogue({ id: data[key] }, this), writable: false });
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
				this.reactions.set('❤️', data[key]);
				data[key] > 1 && this.reactions.set('❤️', data[key]);
				break;
			case 'media':
				let media = data[key];
				this.media = {}
				for (let key in media) {
					switch (key) {
					case 'source':
					case 'url':
						this.media.url = media[key];
						break;
					case 'thumb':
					case 'thumbUrl':
						this.media.thumb = media[key];
					}
				}
				break;
			case 'replyToId':
				if (this.reference !== null) break;
				this.referenceId = data[key];
				this.dialogue !== null && Object.defineProperty(this, 'reference', { value: new Message({ id: data[key] }, this.dialogue), writable: false });
				break;
			case 'sender':
				this.author = new User(data[key], this);
				break;
			case 'senderId':
				let author = this.client.users.cache.get(data[key]);
				if (author) {
					this.author = author;
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
				if (data[key] === this.id) break;
				this.content !== null && (this.edits === null && Object.defineProperty(this, 'edits', { value: [], writable: false }),
				this.edits.push(this.content));
				this.content = data[key];
				this.originalContent === null && Object.defineProperty(this, 'originalContent', { value: data[key], writable: false })
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
	 * Fetch the users that sent love to this message
	 * @param {string} id
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<string|Map<string, User>>}
	 */
	async fetchLovers(id, { force } = {}) {
		if (!force && this.lovers && this.lovers.size > 0) {
			if (this.lovers.has(id)) {
				return this.lovers.get(id);
			} else if (!id) {
				return this.lovers;
			}
		}
		return this.client.requests.post("functions/v2:chat.message.getLovers", {
			messageId: this.id
		}).then(entries => {
			this.lovers ||= new Map();
			for (let item of entries) {
				let entry = new User(item, this.client);
				this.lovers.set(entry.id, entry);
			}
			return id ? this.lovers.get(id) ?? null : this.lovers
		})
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
	 * @returns {Promise<Message>}
	 */
	async reply({ attachments, content } = {}) {
		if (typeof content != 'object') return this.reply(Object.assign(...Array.prototype.slice.call(arguments, 1), { content }));
		return this.client.requests.post("functions/v2:chat.message.sendText", {
			dialogueId: this.dialogueId,
			replyToId: this.id,
			text: '>>> ' + this.content.replace(/^(?=>).+\n/, '').replace(/(.{40})..+/, "$1…") + '\n' + content
		}).then(async data => {
			if (data.flags === 3) {
				throw new Error(data.text);
			} else if (attachments && attachments.length > 0) {
				return Object.assign(data, {
					attachments: await Promise.all(attachments.map(attachment => {
						return this.sendMedia(attachment.url)
					}))
				})
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