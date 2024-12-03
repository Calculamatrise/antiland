import BaseStructure from "./BaseStructure.js";
import Dialogue from "./Dialogue.js";
import User from "./User.js";

export default class BaseMessage extends BaseStructure {
	attachments = new Map();
	// brokerId = null;
	color = null;
	content = null;
	dialogueId = null;
	ephemeral = false;
	hexColor = null;
	referenceId = null;
	constructor(data, dialogue) {
		let isDialogue = dialogue instanceof Dialogue;
		Object.defineProperties(super(...arguments, true), {
			// broker: { value: null, writable: true },
			dialogue: { value: isDialogue ? dialogue : null, writable: !isDialogue },
			ephemeral: { enumerable: false },
			reference: { value: null, writable: true }
			// sender: { value: null, writable: true }
		})
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'dialogue':
				if (typeof data[key] == 'object') {
					if (this.dialogue instanceof Dialogue) {
						this.dialogue._patch(data[key]);
						break;
					} else if (this[key] !== null) break;
					Object.defineProperty(this, key, { value: data[key] instanceof Dialogue ? data[key] : new Dialogue(data[key], this), writable: false })
					break;
				}
			case 'dialogueId':
				this.dialogueId = data[key];
				if (this.dialogue !== null) break;
				Object.defineProperty(this, 'dialogue', {
					value: this.client.dialogues.cache.get(data[key]?.id ?? data[key]) || new Dialogue({ id: data[key] }, this),
					writable: false
				});
				break;
			// case 'color':
			case 'hexColor':
				this.color = parseInt(data[key].replace(/^#/, ''), 16),
				this[key] = data[key];
				break;
			// case 'sender':
			// 	this[key] = data[key] instanceof User ? data[key] : new User(data[key], this);
			// 	break;
			// case 'senderAva':
			// case 'senderBlessed':
			// case 'senderName':
			// // case 'sendersName':
			// 	let side = key.match(/^[^A-Z]+/);
			// 	if (!this.hasOwnProperty(side[0])) break;
			// 	side = side[0];
			// 	this[side] !== null && this[side]._patch(User.resolve({ [key]: data[key] }, side));
			// 	break;
			// case 'senderId':
			// 	this.brokerId = data[key],
			// 	this.broker === null && (this.broker = new User({ id: data[key] }));
			// 	break;
			case 'media':
				this[key] ||= {};
				for (let prop in data[key]) {
					switch (prop) {
					case 'source':
					case 'url':
						this[key].url = data[key][prop];
						this[key].type ||= /\.((jpe?|pn)g|webp)$/i.test(data[key][prop]) ? 'photo' : 'video';
						this.attachments.set(data[key][prop].replace(/.+\/([^_]+).+/, '$1'), this[key]);
						break;
					case 'thumb':
					case 'thumbUrl':
						this[key].thumb = data[key][prop];
						break;
					case 'type':
						this[key][prop] = data[key][prop]
					}
				}
				break;
			case 'message':
			case 'text':
				if (typeof data[key] != 'string' || data[key] === this.id) break;
				/^\[sticker=\w+\]$/i.test(data[key]) && this._patch({ sticker: data[key].replace(/^\[sticker=(\w+)\]/i, '$1') }),
				this.content = data[key];
				break;
			case 'replyToId':
				if (this.reference !== null) break;
				this.referenceId = data[key];
				this.dialogue !== null && Object.defineProperty(this, 'reference', { value: new this.constructor({ id: data[key] }, this.dialogue), writable: false });
				break;
			case 'sticker':
				this.content = "[sticker=" + data[key] + "]",
				this.attachments.set(data[key], {
					id: data[key],
					url: "https://gfx.antiland.com/stickers/" + data[key],
					type: 'sticker'
				})
			}
		}
	}

	// stickerURL() {
	// 	// check if attachments has sticker
	// 	if (this.stickerId === null) return null;
	// 	return "https://gfx.antiland.com/stickers/" + this.stickerId
	// }

	/**
	 * Translate this message
	 * @param {string} [locale] preferred locale
	 * @returns {Promise<string>}
	 */
	translate(locale = 'en') {
		return this.client.rest.post("functions/v2:chat.message.translate", {
			lang: locale,
			messageId: this.id,
			persist: false,
			text: this.content
		})
	}
}