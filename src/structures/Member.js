import User from "./User.js";

export default class Member extends User {
	dialogueId = null;
	position = null;
	priority = null;
	constructor(data, dialogue) {
		if (data instanceof Member) return data;
		if (data instanceof Object && dialogue instanceof Object && dialogue.hasOwnProperty('messages')) {
			let id = data.id || data.objectId;
			let entry = dialogue.members.cache.get(id);
			if (entry) {
				entry._patch(data);
				return entry
			}
		}
		super(...arguments, true);
		Object.defineProperties(this, {
			banInfo: { value: null, writable: true },
			banned: { value: false, writable: true },
			dialogue: { value: dialogue },
			dialogueId: { enumerable: true, value: dialogue.id }
		});
		this._patch(data);
		this.id !== null && this.hasOwnProperty('client') && dialogue.members.cache.set(this.id, this)
	}

	get manageable() {
		return this.dialogue.manageable
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'position':
			case 'priority':
				this[key] = data[key]
			}
		}
		return this
	}

	/**
	 * Ban a user
	 * @protected moderation endpoint for moderators
	 * @param {string} [options]
	 * @param {boolean} [options.force]
	 * @param {string} [options.messageId]
	 * @param {string} [options.reason]
	 * @returns {Promise<object>}
	 */
	async ban({ force, messageId, reason = "No reason provided." } = {}) {
		if (!this.manageable) {
			throw new Error("Insufficient privileges.");
		} else if (!force && this.dialogue.bans.cache.has(this.id)) {
			return this.dialogue.bans.cache.get(this.id);
		}
		return this.client.requests.post("functions/v2:chat.mod.ban", {
			dialogueId: this.dialogueId,
			message: String(messageId),
			reason,
			userId: this.id
		}).then(res => {
			if (res.banned) {
				let createdAt = new Date();
				let endsAt = new Date(typeof res.info.endsAt == 'object' ? res.info.endsAt.iso : res.info.endsAt);
				Object.defineProperties(res.info, {
					createdAt: { value: createdAt },
					createdTimestamp: { value: createdAt.getTime() },
					dialogue: { enumerable: false, value: this.client, writable: false },
					dialogueId: { enumerable: true, value: res.info.dialogue, writable: true },
					endsAt: { value: endsAt },
					endsTimestamp: { value: endsAt.getTime() }
				});
			}
			return res.banned && (this.dialogue.bans.cache.set(this.id, res.info),
			res.info)
		})
	}

	/**
	 * Unban a user
	 * @protected moderation endpoint for moderators
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<object>}
	 */
	async unban({ force } = {}) {
		if (!this.manageable) {
			throw new Error("Insufficient privileges.");
		} else if (!force && !this.dialogue.bans.cache.has(this.id)) {
			return true;
		}
		return this.fetchDM({ createIfNotExists: true }).then(dialogue => {
			return dialogue.send("/forgive " + this.dialogueId).then(({ text }) => {
				let result = parseInt(text.replace(/^.+\n(\d+).+/, "$1"));
				if (result < 1) {
					throw new Error("No bans found.");
				}
				this.dialogue.bans.cache.delete(this.id);
				return result > 0
			})
		})
	}
}