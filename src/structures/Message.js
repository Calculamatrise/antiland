import Structure from "./Structure.js";
import Dialogue from "./Dialogue.js";
import User from "./User.js";

export default class Message extends Structure {
	author = new User(null, this);
	content = null;
	reactions = new Map();
	constructor(data, dialogue) {
		super(...arguments, true);
		if (dialogue.hasOwnProperty('messages')) {
			super._update(data);
			let entry = dialogue.messages.cache.get(this.id);
			if (entry) {
				entry._update(data);
				return entry
			}

			this.id !== null && dialogue.messages.cache.set(this.id, this)
		}

		this._update(data)
	}

	_update(data) {
		if (typeof data != 'object' || data == null) return;
		super._update(...arguments);
		for (let key in data) {
			switch (key) {
			case 'avatar':
				this.author._update({ avatar: { idx: data[key] }});
				break;
			case 'dialogue':
				if (typeof data[key] == 'object') {
					if (this.dialogue instanceof Dialogue) {
						this.dialogue._update(data[key]);
						break;
					}
					this.dialogue = new Dialogue(data[key], this);
					break;
				}
			case 'dialogueId':
				// check private chats and group chats // this.client.users // this.client.groups
				this.dialogue = this.client.dialogues.cache.get(data[key]?.id ?? data[key]) || new Dialogue({ id: data[key] }, this);
				this.dialogueId = data[key];
				break;
			// case 'color':
			case 'hexColor':
				this.color = parseInt(data[key].replace(/^#/, ''), 16);
			case 'blessed':
				this[key] = data[key];
				break;
			case 'likesCount':
				// this.likes = data[key];
				// this.likeCount = data[key];
				this.reactions.set('❤️', data[key]);
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
				this.referenceId = data[key];
				this.reference = null;
				if (this.dialogue) {
					let reference = this.dialogue.messages.cache.get(this.referenceId);
					reference && (this.reference = reference)
				}
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
				this.author._update({ id: data[key] });
				break;
			case 'sendersName':
				this.author._update({ displayName: data[key] });
				break;
			case 'sticker': // https://gfx.antiland.com/stickers/a10
				this.content = "https://gfx.antiland.com/stickers/" + data[key];
				break;
			case 'message': // [sticker=svd2021:3]
			case 'text':
				this.content = data[key];
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