import BaseStructure from "./BaseStructure.js";
import User from "./User.js";

export default class Member extends BaseStructure {
	dialogueId = null;
	position = null;
	priority = null;
	user = null;
	constructor(data, dialogue) {
		if (data instanceof Member) return data;
		if (data instanceof Object && dialogue instanceof Object && dialogue.hasOwnProperty('messages')) {
			let id = data.id || data.objectId;
			let entry = dialogue.members.cache.get(id);
			if (entry) {
				entry._patch(data);
				return entry
			}

			data.position ||= dialogue.founderId === id ? 'founder' : (dialogue.moderators && dialogue.moderators.cache.has(id)) ? 'moderator' : 'member';
		}
		super(...Array.prototype.slice.call(arguments, 0, 2), true),
		Object.defineProperties(this, {
			banInfo: { value: null, writable: true },
			banned: { value: false, writable: true },
			dialogue: { value: dialogue },
			dialogueId: { value: dialogue.id }
		}),
		this.user = data instanceof User ? data : new User(data, dialogue),
		data instanceof User || this._patch(data),
		this.user.id !== null && this.hasOwnProperty('client') && dialogue.members.cache.set(this.user.id, this)
	}

	get manageable() {
		return this.dialogue.manageable
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments),
		data instanceof User || this.user._patch(...arguments);
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
		} else if (!force && this.dialogue.bans.cache.has(this.user.id)) {
			return this.dialogue.bans.cache.get(this.user.id);
		}
		return this.client.requests.post("functions/v2:chat.mod.ban", {
			dialogueId: this.dialogueId,
			message: String(messageId),
			reason,
			userId: this.user.id
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
			return res.banned && (this.dialogue.bans.cache.set(this.user.id, res.info),
			res.info)
		})
	}

	/**
	 * Fetch this member
	 * @param {boolean} [force]
	 * @returns {Promise<this>}
	 */
	async fetch(force) {
		await this.user.fetch(force);
		if (!force && !this.partial) {
			return this;
		}
		return this.dialogue.members.fetch(this.user.id, { force: true }).then(this._patch.bind(this))
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
		} else if (!force && !this.dialogue.bans.cache.has(this.user.id)) {
			return true;
		}
		return this.fetchDM({ createIfNotExists: true }).then(dialogue => {
			return dialogue.send("/forgive " + this.dialogueId).then(({ text }) => {
				let result = parseInt(text.replace(/^.+\n(\d+).+/, "$1"));
				if (result < 1) {
					throw new Error("No bans found.");
				}
				this.dialogue.bans.cache.delete(this.user.id);
				return result > 0
			})
		})
	}

	// mod() {}
	// unmod() {}

	static resolve(data) {
		data = User.resolve(data, 'member');
		// for (let key in data) {
		// 	switch (key) {
		// 	}
		// }
		data.position ||= 'member';
		return data
	}
}