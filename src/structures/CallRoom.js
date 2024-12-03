import BaseStructure from "./BaseStructure.js";
import { WebSocket } from "ws";

export default class CallRoom extends BaseStructure {
	participants = new Map();
	constructor(data) {
		Object.defineProperties(super(...arguments, true), {
			connection: { value: null, writable: true },
			token: { value: null, writable: true }
		}),
		data instanceof Object && this._patch(data)
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'url':
				if (this.connection !== null) break;
				this.createConnection(data[key]);
			case 'id':
			case 'roomName':
				this[key] = data[key];
				break;
			case 'token':
				if (this[key] !== null) break;
				this[key] = data[key]
			}
		}
	}

	createConnection(url, { force } = {}) {
		let connection = new WebSocket((url || this.url) + '/?roomId=' + this.id);
		Object.defineProperty(this, 'connection', { value: connection, writable: false });
		connection.addListener('open', () => {
			console.log('open')
		});
		connection.on('close', () => {
			console.log('close')
		});
		connection.addListener('error', err => {
			console.log('errored', err)
		});
		connection.addListener('message', msg => {
			console.log('message', msg)
		});
		return connection
	}
}