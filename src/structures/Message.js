import Structure from "./BaseStructure.js";
import Dialogue from "./Dialogue.js";
import User from "./User.js";

export default class Message extends Structure {
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

	delete() {
		return this.client.requests.post("functions/v2:chat.message.delete", {
			messageId: this.id
		})
	}

	edit(text) {
		return this.client.requests.post("functions/v2:chat.message.changeText", {
			messageId: this.id,
			text
		}).then(r => {
			console.log(r);
			return r
		})
	}

	fetchLovers(id, { force } = {}) {
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

	like() {
		return this.client.requests.post("functions/v2:chat.message.love", {
			messageId: this.id
		})
	}

	reply(content) {
		return this.client.requests.post("functions/v2:chat.message.sendText", {
			dialogueId: this.dialogueId,
			replyToId: this.id,
			text: '>>> ' + this.content.replace(/^(?=>).+\n/, '') + '\n' + content
		}).then(r => {
			// new Message(r);
			return r
		})
	}

	translate() {
		return this.client.requests.post("functions/v2:chat.message.translate", {
			lang: 'en',
			messageId: this.id,
			persist: false,
			text: this.content
		})
	}
}