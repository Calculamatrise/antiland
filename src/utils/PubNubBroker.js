import EventEmitter from "events";
import Opcodes from "./Opcodes.js";

export default class PubNubBroker extends EventEmitter {
	#client = null;
	#interval = null;
	#pubnub = null;
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
		this.#interval && clearInterval(this.#interval);
		this.#pubnub = await fetch("https://www.antiland.com/chat/static/config.json").then(r => r.json()).then(({ pubnub }) => pubnub);
		this.#interval = setInterval(async () => {
			let baseUrl = "https://ps.pndsn.com/v2/subscribe/" + this.#pubnub + "/";
			for (let channelId of this.channels) {
				let params = new URLSearchParams({
					heartbeat: 300,
					tt: this.#tt.get(channelId) ?? 0,
					tr: this.#tr.get(channelId) ?? 0,
					uuid: this.#client.user.id,
					pnsdk: 'PubNub-JS-Web/4.37.0'
				});
				let data = await fetch(baseUrl + channelId + "/0?" + params.toString()).then(r => r.json());
				for (let key in data.t) {
					switch(key) {
					case 'r':
						this.#tr.set(channelId, data.t[key]);
						break;
					case 't':
						this.#tt.set(channelId, data.t[key])
					}
				}
				for (let message of data.m) {
					this.#handleMessage(message, { channelId })
				}
			}
		}, 3e3);
		this.emit('open')
	}

	close() {
		this.#interval && (clearInterval(this.#interval),
		this.#interval = null);
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
		case Opcodes.INIT:
		case Opcodes.OPEN_CHANNELS_CHANGED:
			for (let { channelId } of payload.channels || []) {
				if (channelId === this.#client.user.channelId) continue;
				this.channels.add(channelId)
			}
			for (let { channelId } of payload.deactivatedChannels || []) {
				this.channels.delete(channelId)
			}
		}
	}
}