import BaseMessage from "./BaseMessage.js";
import Dialogue from "./Dialogue.js";
import User from "./User.js";

export default class SystemMessage extends BaseMessage {
	// brokerId = null;
	ephemeral = true;
	// title = null; // ? sendersName ("Gift!")
	constructor(data, dialogue, skipPatch) {
		if (data instanceof SystemMessage) return data;
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
			// broker: { value: null, writable: true },
			receiver: { value: null, writable: true },
			// sender: { value: null, writable: true }
		}),
		skipPatch || this._patch(data),
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
				Object.defineProperty(this, 'dialogue', {
					value: this.client.dialogues.cache.get(data[key]?.id ?? data[key]) || new Dialogue({ id: data[key] }, this),
					writable: false
				})
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
			case 'message':
			case 'text':
				this.content = data[key]
			}
		}
	}

	iconURL() {
		// return "https://www.antiland.com/chat/gift_" + (this.artifactName ?? 'empty') + "." + this.iconId + ".png"
	}
}