import SystemMessage from "./SystemMessage.js";
import User from "./User.js";

export default class GiftMessage extends SystemMessage {
	artifactName = null;
	brokerId = null;
	icon = 2002;
	karma = 0;
	receiverId = null;
	senderId = null;
	constructor(data, dialogue) {
		if (data instanceof GiftMessage) return data;
		else if (data instanceof Object && dialogue instanceof Object && dialogue.hasOwnProperty('messages')) {
			let id = data.id || data.objectId;
			let entry = dialogue.messages.cache.get(id);
			if (entry) {
				entry._patch(data);
				return entry
			}
		}
		Object.defineProperties(super(...Array.prototype.slice.call(arguments, 0, 2), true), {
			broker: { value: null, writable: true },
			icon: { enumerable: false },
			receiver: { value: null, writable: true },
			sender: { value: null, writable: true }
		}),
		this._patch(data),
		this.id !== null && dialogue.messages.cache.set(this.id, this)
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'giftname':
				this.artifactName = data[key];
				break;
			case 'karma':
				this[key] = data[key],
				this.receiver !== null && this.receiver._patch({ [key]: this.receiver[key] + this[key] });
				break;
			case 'receiver':
			case 'sender':
				this[key] = data[key] instanceof User ? data[key] : new User(data[key], this);
				break;
			case 'receiverId':
				this[key] = data[key],
				this.receiver === null && (this.receiver = new User({ id: this[key] }, this));
				break;
			case 'receiverAva':
			case 'receiverBlessed':
			case 'receiverName':
			case 'senderAva':
			case 'senderBlessed':
			case 'senderName':
			// case 'sendersName':
				let side = key.match(/^[^A-Z]+/);
				if (!this.hasOwnProperty(side[0])) break;
				side = side[0];
				this[side] !== null && this[side]._patch(User.resolve({ [key]: data[key] }, side));
				break;
			case 'giftSenderId':
				this.senderId = data[key],
				this.sender === null && (this.sender = new User({ id: data[key] }, this));
				break;
			case 'senderId':
				this.brokerId = data[key],
				this.broker === null && (this.broker = new User({ id: data[key] }, this))
			}
		}
	}

	artifactURL() {
		return "https://www.antiland.com/chat/gift_" + (this.artifactName ?? 'empty') + "." + this.hash(this.artifactName) + ".png"
	}

	iconURL() {
		if (!this.icon) return null;
		return "https://gfx.antiland.com/avatars/" + this.icon
	}

	static artifactHashMap = {
		diamond: "b5286674a9012b839149",
		heart: "0a245c9df5ebc40bd1bf",
		rose: "a34427cf44ed2f0cc99a",
		teddy: "33468f76659e3bb47df6"
	};
	static hash(artifactName) {
		return this.artifactHashMap[artifactName] ?? "200aaa8db7e6e96954b3"
	}
}