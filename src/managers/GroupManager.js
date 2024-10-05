import DialogueManager from "./DialogueManager.js";
import Dialogue from "../structures/Dialogue.js";
import Group from "../structures/Group.js";

export default class GroupManager extends DialogueManager {
	async fetchActive({ force, ignore, limit } = {}) {
		if (!force && this.cache.size > 0) {
			return this.cache;
		}

		return this.client.requests.post("functions/v2:chat.my").then(entries => {
			for (let item of entries.filter(({ type }) => /^private$/i.test(type))) {
				let entry = new Dialogue(item, this);
				this.client.dialogues.cache.set(entry.id, entry);
				if (!this.client.user.favorites.cache.has(entry.friendId)) {
					this.client.user.messages.set(entry.id, entry);
				}
			}
			for (let item of entries.filter(({ id, type }) => /^(group|public)$/i.test(type) && (!ignore || !ignore.includes(id))).slice(0, limit)) {
				let entry = new Group(item, this);
				this.cache.set(entry.id, entry),
				this.client.dialogues.cache.set(entry.id, entry);
			}
			return this.cache
		})
	}

	/**
	 * Fetch top chats
	 * @param {object} [options]
	 * @param {string} [options.interest]
	 * @returns {Promise<Iterable>}
	 */
	async top({ interest } = {}) {
		return this.client.requests.post("functions/v2:chat.top" + (interest ? 'ByInterest' : ''), interest && { interest })
	}

	/**
	 * Search public group chats
	 * @param {string} query
	 * @param {object} [options]
	 * @param {number} [options.limit]
	 * @returns {Promise<Array<Group>>}
	 */
	async search(query, { limit } = {}) {
		if (query instanceof Object) return this.search(null, query);
		return this.client.requests.post("functions/v2:chat.search", {
			search: query
		}).then(entries => {
			let groups = entries.filter(({ type }) => /^(group|public)$/i.test(type)).slice(0, limit);
			for (let item in groups) {
				let entry = new Group(groups[item], this);
				this.cache.set(entry.id, entry);
				groups[item] = entry;
			}
			return groups
		})
	}

	/**
	 * Create a group chat
	 * @param {object} options
	 * @param {string} options.name
	 * @param {boolean} [options.isPublic]
	 * @returns {Promise<Group>}
	 */
	async create({ name, isPublic = true } = {}) {
		return this.client.requests.post("functions/v2:chat.newGroup", { name, isPublic }).then(item => {
			let entry = new Group(item, this);
			this.cache.set(entry.id, entry);
			return entry
		})
	}

	/**
	 * Edit a group chat
	 * @param {string} dialogueId
	 * @param {object} [options]
	 * @param {Iterable<string>} [options.categories]
	 * @param {Iterable<string>} [options.filters]
	 * @param {number} [options.historyLength]
	 * @param {number} [options.minKarma]
	 * @param {Iterable<string>} [options.setup]
	 * @returns {Promise<Group>}
	 */
	async edit(dialogueId, { categories, filters, historyLength, minKarma, setup } = {}) {
		return this.fetch(dialogueId).then(dialogue => {
			return this.client.requests.post("functions/v2:chat.mod.setInfo", {
				dialogueId,
				categories: Array.from(categories || dialogue.categories),
				filters: Array.from(filters || dialogue.options.filters),
				historyLength: historyLength ?? dialogue.options.historyLength,
				minKarma: minKarma ?? dialogue.minKarma,
				setup: Array.from(setup || dialogue.options.setup)
			}).then(dialogue._patch.bind(dialogue))
		})
	}

	/**
	 * Send invites to mates
	 * @param {string} dialogueId
	 * @param {string} mateIds
	 * @returns {Promise<boolean>}
	 */
	async invite(dialogueId, mateIds) {
		return this.client.requests.post(`functions/v2:chat.addMatesToGroup`, {
			dialogueId,
			mateIds: Array.from(new Set(mateIds)).map(m => typeof m == 'object' ? m.id : m)
		})
	}

	/**
	 * Join a group chat
	 * @param {string} dialogueId
	 * @returns {Promise<boolean>}
	 */
	async join(dialogueId) {
		return this.client.requests.post(`functions/v2:chat.joinGroup`, {
			dialogueId
		})
	}

	/**
	 * Edit a group chat
	 * @param {string} dialogueId
	 * @param {function} callback
	 * @returns {Promise<Group>}
	 */
	async update(dialogueId, callback) {
		if (typeof callback != 'function') {
			throw new TypeError("Callback must be of type: function")
		}
		return this.fetch(dialogueId).then(dialogue => {
			return this.edit(dialogueId, callback(dialogue))
		})
	}
}