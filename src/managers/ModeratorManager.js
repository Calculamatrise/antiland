import BaseManager from "./BaseManager.js";

export default class ModeratorManager extends BaseManager {
	get manageable() {
		return this.client.manageable
	}

	/**
	 * Fetch current moderators
	 * @param {string} id
	 * @param {object} [options]
	 * @param {boolean} options.force
	 * @returns {Promise<Member|Map<string, Member>>}
	 */
	async fetch(id, { force } = {}) {
		if (!force && this.cache.size > 0) {
			if (this.cache.has(id)) {
				return this.cache.get(id);
			} else if (!id) {
				return this.cache;
			}
		}

		return this.client.members.fetch(id, { force }).then(entry => {
			/^moderator$/i.test(entry.position) && this.cache.set(entry.id, entry);
			return id ? this.cache.get(id) ?? null : this.cache
		})
	}

	/**
	 * Add a chat moderator
	 * @protected requires founder permissions
	 * @param {string} userId
	 * @returns {Promise<boolean>}
	 */
	async add(userId) {
		if (!this.manageable) {
			throw new Error("You must be the founder to perform this action.");
		} else if (this.cache.has(userId)) {
			return true;
		}
		return this.client.client.rest.post("functions/v2:chat.mod.add", {
			dialogueId: this.client.id,
			userId
		}).then(async res => {
			if (res.includes(userId) && !this.cache.has(userId)) {
				let member = await this.client.members.fetch(userId);
				this.cache.set(member.id, member);
			}
			this.client._patch({ admins: res });
			return this.cache.has(userId)
		})
	}

	/**
	 * Remove a chat moderator
	 * @protected requires founder permissions
	 * @param {string} userId
	 * @returns {Promise<boolean>}
	 */
	async remove(userId) {
		if (!this.manageable) {
			throw new Error("Insufficient privileges.");
		} else if (!this.cache.has(userId)) {
			return true;
		}
		return this.client.client.rest.post("functions/v2:chat.mod.delete", {
			dialogueId: this.client.id,
			userId
		}).then(res => {
			if (!res.includes(userId) && this.cache.has(userId)) {
				this.cache.delete(userId);
			}
			this.client._patch({ admins: res });
			return !this.cache.has(userId)
		})
	}
}