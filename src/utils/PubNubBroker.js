import EventEmitter from "events";
import Opcodes from "./Opcodes.js";

export default class PubNubBroker extends EventEmitter {
	#baseURL = null;
	#client = null;
	#domain = "ps.pndsn.com";
	#pubnub = null;
	#subscriptions = new Map();
	constructor(client) {
		super();
		this.#client = client;
		this.connect();
		Object.defineProperty(this, 'channels', {
			value: this.#subscriptions.keys.bind(this.#subscriptions)
		})
	}

	#handleMessage(data, { channelId } = {}) {
		for (let key in data) {
			switch(key) {
			case 'd':
				this.emit('message', JSON.stringify({
					payload: {
						channelId: (channelId || data.c) ?? null,
						messages: [data[key]]
					},
					type: Opcodes.MESSAGE
				}))
			}
		}
	}

	async connect() {
		this.unsubscribe();
		this.#pubnub || (this.#pubnub = await fetch("https://www.antiland.com/chat/static/config.json").then(r => r.json()).then(({ pubnub }) => pubnub));
		this.#baseURL = "https://" + this.#domain + "/v2/subscribe/" + this.#pubnub + "/";
		this.emit('open')
	}

	close() {
		this.unsubscribe();
		this.emit('close')
	}

	destroy() {
		this.close();
		this.removeAllListeners()
	}

	send(data) {
		try {
			data = JSON.parse(data);
		} catch(e) { return }
		let payload = data.payload;
		switch(data.type) {
		case Opcodes.AUTH:
			this.emit('message', JSON.stringify({
				payload: {
					connectionId: null
				},
				type: Opcodes.AUTH_SUCCESS
			}));
			break;
		case Opcodes.INIT:
			this.send(JSON.stringify(Object.assign({}, data, { type: Opcodes.AUTH })));
		case Opcodes.NAVIGATE:
			let added = new Set();
			let dropped = new Set();
			for (let { channelId } of payload.channels || []) {
				this.subscribe(channelId);
				added.add(channelId)
			}
			for (let { channelId } of payload.deactivatedChannels || []) {
				this.unsubscribe(channelId);
				dropped.add(channelId)
			}
			this.emit('message', JSON.stringify({
				payload: {
					diff: {
						added: Array.from(added),
						dropped: Array.from(dropped)
					}
				},
				type: Opcodes.SUBSCRIPTIONS
			}))
		}
	}

	/**
	 * Unsubscribe from a channel
	 * @param {string} channelId
	 * @returns {Promise<void>}
	 */
	async subscribe(channelId, recurse) {
		let subscription = this.#subscriptions.get(channelId) || {};
		let params = new URLSearchParams({
			heartbeat: 300,
			tt: subscription.tt ?? 0,
			tr: subscription.tr ?? 0,
			uuid: this.#client.user.id,
			pnsdk: 'nodejs/antiland'
		});
		let data = await fetch(this.#baseURL + channelId + "/0?" + params.toString()).then(r => r.json()).catch(err => {
			if (this.listenerCount('error') > 0) {
				return this.emit('error', err);
			} else if (this.#client.listenerCount('error') > 0) {
				return this.#client.emit('error', err);
			}
			throw err
		});
		for (let key in data.t) {
			switch(key) {
			case 'r':
			case 't':
				subscription['t' + key] = data.t[key]
			}
		}
		if (recurse && !this.#subscriptions.has(channelId)) return;
		this.#subscriptions.set(channelId, subscription);
		this.subscribe(channelId, true);
		if (!data.m || data.m.length < 1) return;
		for (let message of data.m) {
			this.#handleMessage(message, { channelId })
		}
	}

	/**
	 * Unsubscribe from a channel
	 * @param {string} [channelId]
	 * @returns {boolean}
	 */
	unsubscribe(channelId = null) {
		if (typeof channelId !== null) {
			return this.#subscriptions.delete(channelId)
		}

		this.#subscriptions.clear();
		return true
	}
}