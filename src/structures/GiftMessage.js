import BaseStructure from "./BaseStructure.js";
import Dialogue from "./Dialogue.js";
import User from "./User.js";

export default class GiftMessage extends BaseStructure {
	artifactName = null;
	author = new User(null, this);
	avatar = { id: 2002 };
	content = null;
	dialogueId = null;
	victim = new User(null, this);
	get iconId() {
		return this.constructor.icon(this.artifactName)
	}

	constructor(data, dialogue) {
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
			avatar: { enumerable: false, writable: false },
			dialogue: { value: null, writable: true }
		});
		this._patch(data);
		this.id !== null && dialogue.messages.cache.set(this.id, this)
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		data = this.constructor.convert(data);
		for (let key in data) {
			switch (key) {
			case 'dialogue':
				if (typeof data[key] == 'object') {
					if (this.dialogue instanceof Dialogue) {
						this.dialogue._patch(data[key]);
						break;
					}
					if (this[key] !== null) break;
					Object.defineProperty(this, key, { value: new Dialogue(data[key], this), writable: false })
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
				this.author.color = this.color;
				this[key] = data[key];
			case 'blessed':
				this.author._patch({ [key]: data[key] });
				break;
			case 'karma':
				this[key] = data[key];
				break;
			case 'receiver':
				this.victim = new User(data[key], this);
				break;
			case 'sender':
				this.author = new User(data[key], this);
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

	static convert(data) {
		if (typeof data != 'object' || data == null) return;
		typeof data.receiver == 'string' && (data.receiver = { id: data.receiver });
		typeof data.sender == 'string' && (data.sender = { id: data.sender });
		for (let key in data) {
			switch (key) {
			case 'giftSenderId':
				data.sender ||= {};
				data.sender.id = data[key];
				break;
			case 'receiverId':
				data.receiver ||= {};
				data.receiver.id = data[key];
				break;
			case 'receiverAcc':
				data.receiver ||= {};
				data.receiver.accessories = data[key];
				break;
			case 'receiverAva':
				data.receiver ||= {};
				data.receiver.avatar = data[key];
				break;
			case 'receiverBlessed':
				data.receiver ||= {};
				data.receiver.blessed = data[key];
				break;
			case 'receiverName':
				data.receiver ||= {};
				data.receiver.profileName = data[key];
				break;
			case 'senderId':
				data.sender ||= {};
				data.sender.accessories = data[key];
				break;
			case 'senderAcc':
				data.sender ||= {};
				data.sender.accessories = data[key];
				break;
			case 'senderAva':
				data.sender ||= {};
				data.sender.avatar = data[key];
				break;
			case 'senderBlessed':
				data.sender ||= {};
				data.sender.blessed = data[key];
				break;
			case 'senderName':
				data.sender ||= {};
				data.sender.profileName = data[key];
				break;
			case 'sendersName':
				data.title = data[key];
				break;
			default:
				continue
			}
			delete data[key]
		}
		return data
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