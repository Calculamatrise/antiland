import BaseStructure from "./BaseStructure.js";
import { WebSocket } from "ws";

export default class CallRoom extends BaseStructure {
	connection = null;
	createdAt = new Date();
	participants = new Map();
	constructor() {
		super();
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'url':
				// create connection through url
				this.connection = this.createConnection(data[key]);
			case 'id':
			case 'roomName':
			case 'token':
			// case 'url':
				this[key] = data[key];
			}
		}
	}

	createConnection(url) {
		this.connection = new WebSocket((url || this.url) + '/?roomId=' + this.id);
		this.connection.addListener('open', () => {
			console.log('open')
		})
		this.connection.on('close', () => {
			console.log('close')
		})
		this.connection.addListener('error', err => {
			console.log('test')
		});
		this.connection.addListener('message', msg => {
			console.log('message', msg)
		})
	}
}