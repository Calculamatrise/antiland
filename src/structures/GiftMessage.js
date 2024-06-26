import BaseStructure from "./BaseStructure.js";
import Dialogue from "./Dialogue.js";
import User from "./User.js";

export default class GiftMessage extends BaseStructure {
	artifactName = null;
	content = null;
	dialogueId = null;
	karma = 0;
	receiverId = null;
	senderId = null;
	get iconId() {
		return this.constructor.icon(this.artifactName)
	}

	constructor(data, dialogue) {
		if (data instanceof GiftMessage) return data;
		if (dialogue.hasOwnProperty('messages')) {
			let id = data.id || data.objectId;
			let entry = dialogue.messages.cache.get(id);
			if (entry) {
				entry._patch(data);
				return entry
			}
		}
		super(...arguments, true);
		Object.defineProperties(this, {
			avatar: { value: { id: 2002 }},
			dialogue: { value: null, writable: true },
			receiver: { value: null, writable: true },
			sender: { value: null, writable: true }
		});
		this._patch(data);
		this.id !== null && dialogue.messages.cache.set(this.id, this)
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
				Object.defineProperty(this, 'dialogue', { value: this.client.dialogues.cache.get(data[key]?.id ?? data[key]) || new Dialogue({ id: data[key] }, this), writable: false })
				break;
			case 'giftname':
				this.artifactName = data[key];
				break;
			// case 'color':
			case 'hexColor':
				this.color = parseInt(data[key].replace(/^#/, ''), 16);
				this[key] = data[key];
			case 'karma':
				this[key] = data[key];
				// this.receiver !== null && this.receiver.patch({ [key]: this.receiver[key] + this[key] });
				break;
			case 'receiver':
				this[key] = data[key] instanceof User ? data[key] : new User(data[key], this);
				break;
			case 'receiverId':
				this[key] = data[key];
				this.receiver === null && (this.receiver = new User({ id: this[key] }));
				break;
			case 'sender':
				this[key] = data[key] instanceof User ? data[key] : new User(data[key], this);
				break;
			case 'senderId':
				this[key] = data[key];
				this.sender === null && (this.sender = new User({ id: this[key] }));
				break;
			case 'message':
			case 'text':
				this.content = data[key];
			}
		}
	}

	giftAvatarURL() {
		if (!this.avatar) return null;
		return "https://gfx.antiland.com/avatars/" + this.avatar.id
	}

	iconURL() {
		return "https://www.antiland.com/chat/gift_" + (this.artifactName ?? 'empty') + "." + this.iconId + ".png"
	}

	static icon(artifactName) {
		switch (artifactName) {
		case 'rose':
			return "a34427cf44ed2f0cc99a";
		case 'teddy':
			return "33468f76659e3bb47df6";
		case 'heart':
			return "0a245c9df5ebc40bd1bf";
		case 'diamond':
			return "b5286674a9012b839149";
		default:
			return "200aaa8db7e6e96954b3"
		}
	}
}