import EventEmitter from "events";
import Opcodes from "./Opcodes.js";

export default class PubNubBroker extends EventEmitter {
	#baseURL = null;
	#client = null;
	#domain = "ps.pndsn.com";
	#pubnub = null;
	#subscriptions = new Map();
	#tr = new Map();
	#tt = new Map();
	channels = new Set();
	constructor(client) {
		super();
		this.#client = client;
		this.connect()
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
		this.channels.clear();
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
		case Opcodes.OPEN_CHANNELS_CHANGED:
			for (let { channelId } of payload.channels || []) {
				if (channelId === this.#client.user.channelId) continue;
				this.channels.add(channelId);
				this.subscribe(channelId)
			}
			for (let { channelId } of payload.deactivatedChannels || []) {
				this.channels.delete(channelId)
			}
		}
	}

	async subscribe(channelId) {
		let params = new URLSearchParams({
			heartbeat: 300,
			tt: this.#tt.get(channelId) ?? 0,
			tr: this.#tr.get(channelId) ?? 0,
			uuid: this.#client.user.id,
			pnsdk: 'PubNub-JS-Web/7.5.0-imp'
		});
		let data = await fetch(this.#baseURL + channelId + "/0?" + params.toString()).then(r => r.json());
		for (let key in data.t) {
			switch(key) {
			case 'r':
				this.#tr.set(channelId, data.t[key]);
				break;
			case 't':
				this.#tt.set(channelId, data.t[key])
			}
		}
		this.subscribe(channelId);
		for (let message of data.m) {
			this.#handleMessage(message, { channelId })
		}
	}

	/**
	 * Unsubscribe from a channel
	 * @param {string} [channelId]
	 * @returns {Promise<boolean>}
	 */
	unsubscribe(channelId = null) {
		if (typeof channelId !== null) {
			let timeout = this.#subscriptions.get(channelId);
			return timeout && (clearTimeout(timeout),
			this.#subscriptions.delete(channelId))
		}

		for (let timeout of this.#subscriptions.values()) {
			clearTimeout(timeout);
		}

		this.#subscriptions.clear();
		return true
	}
}