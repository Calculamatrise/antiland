import BaseManager from "./BaseManager.js";

export default class PurchaseManager extends BaseManager {
	constructor() {
		Object.defineProperties(super(...arguments), {
			accessories: { value: null, writable: true },
			actionPrices: { value: null, writable: true },
			avatars: { value: null, writable: true },
			chatMoods: { value: null, writable: true },
			classes: { value: null, writable: true },
			moods: { value: null, writable: true },
			stickers: { value: null, writable: true }
		})
	}

	/**
	 * Fetch all in-app purchases
	 * @param {string} [id]
	 * @param {object} [options]
	 * @param {boolean} options.force
	 * @returns {Promise<object>}
	 */
	async fetch(id, { force } = {}) {
		if (!force && this.cache.has(id)) {
			return this.cache.get(id);
		}
		await this.fetchAll({ force });
		return this.cache.get(id) ?? null
	}

	async fetchAll({ force } = {}) {
		if (!force && this.cache.size > 0) {
			return this.cache;
		}
		return this.client.rest.post("functions/v2:purchase.allIaps").then(data => {
			for (let key in data) {
				switch (key) {
				case 'actionPrices':
				case 'classes':
					this[key] = data[key];
				default:
					if (typeof data[key] != 'object' || !data[key].hasOwnProperty('items')) break;
					let { items } = data[key];
					for (let item of items) {
						this.cache.set(item.idx /* item.purchase.iap.sku */, item),
						this.key instanceof Map && this.key.set(item.idx, item);
					}
				}
			}
			return this.cache
		})
	}

	/**
	 * Purchase item(s)
	 * @param {Iterable} skus
	 * @param {object} [options]
	 * @param {string} options.currency
	 * @returns {Promise<boolean>}
	 */
	async purchase(skus, { currency = 'karma' } = {}) {
		if (typeof skus[Symbol.iterator] != 'function') return this.purchase([skus], ...Array.prototype.slice.call(arguments, 1));
		return this.client.rest.post("functions/v2:purchase.iaps", {
			currency,
			skus
		}).then(result => {
			if (typeof result != 'boolean') {
				throw new Error(result);
			}
			return result
		})
	}

	/**
	 * Purchase gift
	 * @param {object} [options]
	 * @param {string} [options.artifactName]
	 * @param {string} [options.currency]
	 * @param {string} [options.dialogueId]
	 * @returns {Promise<unknown>}
	 */
	purchaseGift({ artifactName = 'rose', currency = 'karma', dialogueId = null } = {}) {
		return this.client.rest.post("functions/v2:purchase.gift", {
			artifactName,
			currency, // karma or tokens
			dialogueId,
			receiverId: this.client.user.id
		}).then(result => {
			console.log(result)
			return result
		})
	}

	/**
	 * Purchase superpowers
	 * @returns {Promise<unknown>}
	 */
	purchaseSPTrial() {
		return this.client.rest.post("functions/v2:purchase.spTrial")
	}
}