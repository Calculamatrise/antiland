import BaseClient from "./BaseClient.js";
import CallManager from "../managers/CallManager.js";
import DialogueManager from "../managers/DialogueManager.js";
import GroupManager from "../managers/GroupManager.js";
import StickerManager from "../managers/StickerManager.js";
import UserManager from "../managers/UserManager.js";

export default class Client extends BaseClient {
	calls = new CallManager(this);
	dialogues = new DialogueManager(this);
	groups = new GroupManager(this);
	stickers = new StickerManager(this);
	users = new UserManager(this);

	/**
	 * Fetch all in-app purchases
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<object>}
	 */
	fetchPurchases({ force } = {}) {
		if (!force && this.iaps) {
			return this.iaps;
		}
		return this.requests.post("functions/v2:purchase.allIaps").then(data => {
			!this.iaps && Object.defineProperty(this, 'iaps', { value: {}});
			return Object.assign(this.iaps, data)
		})
	}

	/**
	 * Purchase items
	 * @param {Iterable} skus
	 * @param {object} [options]
	 * @param {string} [options.currency]
	 * @returns {Promise<boolean>}
	 */
	purchase(skus, { currency = 'karma' } = {}) {
		if (typeof skus[Symbol.iterator] != 'function') return this.purchase([skus], ...Array.prototype.slice.call(arguments, 1));
		return this.requests.post("functions/v2:purchase.iaps", {
			currency,
			skus
		}).then(result => {
			if (typeof result != 'boolean') {
				throw new Error(result);
			}
			return result
		})
	}
}