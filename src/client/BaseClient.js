import EventEmitter from "events";
import { WebSocket } from "ws";

import PubNubBroker from "../utils/PubNubBroker.js";
import RequestHandler from "../utils/RequestHandler.js";
import ClientUser from "../structures/ClientUser.js";
import FriendRequest from "../structures/FriendRequest.js";
import GiftMessage from "../structures/GiftMessage.js";
import Message from "../structures/Message.js";

import MessageTypes from "../utils/MessageTypes.js";
import Opcodes from "../utils/Opcodes.js";

export default class extends EventEmitter {
	static sharedGroups = new Set();
	static lastMessageId = new Map();
	static lastMessageTimestamp = new Map();
	#connectionId = null;
	#reconnectAttempts = 0;
	#clientVersion = "nodejs/antiland";
	#host = "ps.anti.land";
	#url = "wss://" + this.#host + "/v1/";
	#fallback = false;
	#pingTimeout = null;
	#pingTimestamp = Date.now();
	#pubnub = false;
	#ws = null;
	_outgoing = new Set(); // use this to guaruntee a response from the server/make promises
	channels = new Set();
	queueChannels = new Set();
	maxReconnectAttempts = 3;
	ping = 0;
	requests = new RequestHandler();
	user = null;

	/**
	 * @param {object} [options]
	 * @param {boolean} [options.fallback] whether to fallback to a pubnub connection
	 * @param {number} [options.maxReconnectAttempts]
	 * @param {boolean} [options.pubnub] prefer pubnub
	 */
	constructor(options) {
		super();
		Object.defineProperty(this, 'debug', { value: false, writable: true });
		for (let key in options) {
			switch(key.toLowerCase()) {
			case 'debug':
				this.debug = options[key];
				break;
			case 'fallback':
				this.#fallback = Boolean(options[key]);
				break;
			case 'maxReconnectAttempts':
				this[key] = options[key] | 0;
				break;
			case 'pubnub':
				this.#pubnub = Boolean(options[key])
			}
		}
	}

	#connect(cb) {
		return new Promise((resolve, reject) => {
			let socket = this.#pubnub ? new PubNubBroker(this) : new WebSocket(this.#url + "?client=" + this.#clientVersion + (this.#connectionId ? '&connectionId=' + this.#connectionId : ''));
			socket.on('close', code => (this.#ws = null, this.emit('disconnect', code))),
			socket.on('error', err => this.maxReconnectAttempts > this.#reconnectAttempts++ ? resolve(this.#fallback && (this.#pubnub = true), this.#connect(cb)) : (this.emit('error', err), reject(err))),
			socket.on('message', this.#messageListener.bind(this)),
			socket.on('open', () => (this.#ws = socket, typeof cb == 'function' && cb(socket), resolve(socket)))
		})
	}

	async destroy(disconnect) {
		disconnect && (this.#connectionId = null);
		this.#pingTimeout && clearTimeout(this.#pingTimeout);
		if (!this.#ws) return true;
		return new Promise((resolve, reject) => {
			this.#ws.once('close', resolve),
			this.#ws.once('error', reject),
			this.#ws.close()
		})
	}

	async reconnect() {
		let config = await this.requests.fetchConfigBody();
		await this.destroy();
		if (!config._SessionToken) {
			throw new Error("Session token not found!");
		}
		this.emit('reconnecting');
		return this.login(config._SessionToken)
	}

	sendCommand(code, payload, uniqueId) {
		uniqueId && (uniqueId = Date.now().toString() + Math.random(),
		this._outgoing.add(uniqueId));
		return this.#ws.send(JSON.stringify(Object.assign({
			type: typeof code == 'number' ? code : Opcodes[code],
			payload
		}, uniqueId ? {
			id: uniqueId
		} : null)))
	}

	sendCommandAsync(code, payload, cb) {
		return new Promise((resolve, reject) => {
			let uniqueId = (Date.now() - performance.now()) + '.' + Math.random();
			let listener;
			this.on('ack', listener = message => {
				if (message.id !== uniqueId) return;
				this.removeListener('ack', listener);
				listener = null;
				typeof cb == 'function' && cb(message);
				resolve(message)
			});
			arguments.splice(2, 0, uniqueId);
			this.sendCommand(...arguments);
			setTimeout(() => reject("Request timed out"), 3e4)
		});
	}

	#messageListener(message) {
		let data = message.toString('utf-8');
		try {
			data = JSON.parse(data)
		} catch(e) { return }
		let payload = data && data.payload;
		switch (data.type) {
		case Opcodes.AUTH_SUCCESS:
			this.#connectionId = payload.connectionId;
			this.#pingTimestamp = Date.now();
			this.#reconnectAttempts = 0;
			this.emit('ready');
			this.sendCommand(Opcodes.PING);
			break;
		// case Opcodes.AUTH_FAILURE:
		// 	this.emit('error', payload);
		// 	break;
		case Opcodes.MESSAGE:
			this.emit('raw', payload);
			for (let message of payload.messages) {
				this.#handleMessage(message, payload).catch(err => {
					if (this.listenerCount('error') > 0) {
						this.emit('error', err);
					} else {
						throw err
					}
				});
			}
			let filteredMessages = payload.messages.filter(({ objectId }) => objectId);
			filteredMessages.length > 0 && this.sendCommand(Opcodes.SYN, {
				messages: filteredMessages.map(({ objectId }) => ({
					channelId: payload.channelId,
					messageId: objectId,
					transport: 'anti',
					ts: Date.now()
				}))
			}, true);
			break;
		case Opcodes.SUBSCRIPTIONS:
			if (!payload) break; // channel not found
			for (let channel of payload.diff.dropped)
				this.queueChannels.delete(channel),
				this.channels.delete(channel),
				this.emit('channelDelete', channel);
			for (let channel of payload.diff.added)
				this.queueChannels.delete(channel),
				this.channels.add(channel),
				this.emit('channelCreate', channel);
			break;
		case Opcodes.ACK:
			this._outgoing.delete(payload.id);
			this.emit('ack', payload);
			break;
		case Opcodes.PONG:
			this.ping = Date.now() - this.#pingTimestamp;
			this.emit('ping', this.ping);
			// this.requests.post("functions/v2:chat.presence.ping", {
			// 	dialogueId: this.user.id
			// })
			this.#pingTimeout = setTimeout(() => {
				this.#pingTimestamp = Date.now();
				this.#ws && this.sendCommand(Opcodes.PING);
			}, 1e4 /* 6e4 */);
			break;
		default:
			console.warn('unrecognized opcode', data);
			this.emit('debug', { message, type: 'UNKNOWN_OPCODE' })
		}
	}

	async #handleMessage(data, { channelId }) {
		if (channelId == this.user.channelId) {
			data.hasOwnProperty('blocked') && (data.type = 'blocked');
			if (data.hasOwnProperty('blocked')) {
				let userId = (data.by || this.user.id) ?? null;
				let user = (userId && this.users.cache.get(userId) || await this.users.fetch(userId)) ?? null;
				Object.defineProperty(data, 'userId', { enumerable: true, value: userId, writable: userId === null });
				Object.defineProperty(data, 'user', { enumerable: false, value: user, writable: user === null });
				let receiverId = (data.whom || this.user.id) ?? null;
				let receiver = (receiverId && this.users.cache.get(receiverId) || await this.users.fetch(receiverId)) ?? null;
				Object.defineProperty(data, 'receiverId', { enumerable: true, value: receiverId, writable: receiverId === null });
				Object.defineProperty(data, 'receiver', { enumerable: false, value: receiver, writable: receiver === null });
				if (data.receiverId === this.user.id) {
					this.user.blockedBy[data.blocked ? 'add' : 'delete'](data.userId);
					this.emit((data.blocked ? '' : 'un') + 'blocked', data.user)  // relationshipUpdate?
				} else {
					this.user.contacts.blocked[data.blocked ? 'add' : 'delete'](data.receiverId);
					this.emit('user' + (data.blocked ? 'B' : 'Unb') + 'locked', data.receiver)
				}
				return
			} else if (typeof data.type == 'string') {
				data.hasOwnProperty('dialogueId') && Object.defineProperty(data, 'dialogue', { enumerable: false, value: await this.dialogues.fetch(data.dialogueId), writable: false });
				data.hasOwnProperty('senderId') && Object.defineProperty(data, 'sender', { enumerable: false, value: await this.users.fetch(data.senderId), writable: false });
				switch(data.type.toLowerCase()) {
				case 'join_notification':
					return this.emit('channelMemberAdd', data.dialogue, data.sender || data);
				case 'karmaTask.event.progress':
					switch(data.body.task.id) {
					case 'karmaTask.dailyBonus':
						console.log(data.body.task.reward);
						return this.emit('taskComplete', data.body.task);
					default:
						console.warn('unknown karma task', data.body);
						return this.emit('debug', { data: data.body, type: 'UNKNOWN_KARMA_TASK' })
					}
				case 'mate.event.request':
					let entry = new FriendRequest(data, this.user.friends);
					this.user.friends.pending.incoming.set(entry.id, entry);
					return this.emit('friendRequest', entry);
				case 'message_like':
					// this.emit('clientMessageLiked');
					break;
				case 'private_notification':
					if (data.hasOwnProperty('message') && data.hasOwnProperty('objectId')) {
						break;
					}
					data.hasOwnProperty('gift') && this.emit('giftReceived', data);
					this.emit('notification', data);
					return;
				default:
					// if (data.hasOwnProperty())
					console.warn('unknown private notification', data);
					return this.emit('debug', { data, type: 'UNKNOWN_MESSAGE' })
				}
			}
		}

		let dialogueId = ((typeof data.dialogue == 'object' ? data.dialogue.id : data.dialogue) || data.dialogueId || data.did || data.deleteChat || (channelId !== this.user.channelId && channelId)) ?? null;
		let dialogue = (dialogueId && (this.dialogues.cache.get(dialogueId) || await this.dialogues.fetch(dialogueId).then(async dialogue => {
			/^(group|public)$/i.test(dialogue.type) && await dialogue.members.fetchActive();
			// await dialogue.members.fetch(); // fetch active members only?? // make sure type is group
			return dialogue
		}).catch(err => {
			if (this.listenerCount('error') > 0) {
				this.emit('error', err);
			} else {
				throw err
			}
		}))) ?? null;
		if (!dialogue) {
			console.warn("Dialogue not found:", data);
			return
		} else if (data.deleteChat) {
			this.emit('channelBanAdd', dialogue);
			return
		}
		Object.defineProperty(data, 'dialogue', { enumerable: false, value: dialogue, writable: dialogue === null });
		Object.defineProperty(data, 'dialogueId', { enumerable: true, value: dialogueId, writable: dialogueId === null });
		if (data.giftname || data.giftName) {
			let message = new GiftMessage(data, dialogue);
			this.emit('messageCreate', message);
			if (message.victim.id == this.user.id) {
				this.emit('giftMessageCreate', message);
			}
			return
		}
		let senderId = ((typeof data.sender == 'object' ? data.sender.id : data.sender) || data.senderId) ?? null;
		let sender = (senderId && (this.users.cache.get(senderId) || await this.users.fetch(senderId).catch(err => {
			console.warn('sender not found???', senderId, data)
			if (this.listenerCount('error') > 0) {
				this.emit('error', err);
			}
			return null
		}))) ?? null;
		Object.defineProperty(data, 'sender', { enumerable: false, value: sender, writable: sender === null });
		Object.defineProperty(data, 'senderId', { enumerable: true, value: senderId, writable: senderId === null });
		// check if message id is present to see if an action occurred on a message
		let messageId = ((typeof data.message == 'object' ? data.message.id : !data.receiver && data.message || data.objectId) || data.messageId || data.mid) ?? null;
		if (messageId !== null && (!data.createdAt || data.createdAt <= this.constructor.lastMessageTimestamp.get(dialogueId))) {
			let message = (messageId && (dialogue.messages.cache.get(messageId) || await dialogue.messages.fetch(messageId)) || (data.update && new Message(data, dialogue))) ?? null;
			data.update && message && message._patch(data, true);
			Object.defineProperty(data, 'message', { enumerable: false, value: message, writable: message === null });
			Object.defineProperty(data, 'messageId', { enumerable: true, value: messageId, writable: messageId === null });
			if (data.update) {
				message && message._patch({ updatedAt: data.createdAt });
				this.emit('messageUpdate', message);
				if (message.originalContent !== message.content && /^\*{5}$/.test(message.content)) {
					this.emit('messageDelete', message);
					dialogue.messages.cache.delete(message.id);
				}
			} else if (/^message_like$/i.test(data.type)) {
				message && message._patch(data, true);
				let admirerId = ((typeof data.liker == 'object' ? data.liker.id : data.liker) || data.likerId) ?? null;
				let admirer = (admirerId && (this.users.cache.get(admirerId) || await this.users.fetch(admirerId))) ?? null;
				Object.defineProperty(data, 'admirer', { enumerable: false, value: admirer, writable: admirer === null });
				Object.defineProperty(data, 'admirerId', { enumerable: true, value: admirerId, writable: admirerId === null });
				this.emit('messageReactionAdd', data);
			} else if (data.hasOwnProperty('type')) {
				console.warn('unrecognized action', data)
			}
			return
		}
		let message = new Message(data, dialogue);
		if (this.constructor.sharedGroups.has(dialogueId) && this.constructor.lastMessageId.get(dialogueId) === message.id) return;
		this.constructor.lastMessageTimestamp.set(dialogueId, message.createdTimestamp);
		this.constructor.lastMessageId.set(dialogue.id, message.id);
		let blocked = this.user.contacts.blocked.has(message.author.id);
		blocked && (message.author.blocked = true);
		this.emit('messageCreate', message, blocked);
	}

	subscribe(channelId) {
		// if (this.constructor.sharedGroups.has(channelId)) return;
		if (this.channels.has(channelId)) return;
		this.queueChannels.add(channelId);
		this.constructor.sharedGroups.add(channelId);
		this.sendCommand(Opcodes.NAVIGATE, {
			channels: Array(Array.from(this.channels.values()), Array.from(this.queueChannels.values())).flat().map(channelId => ({
				channelId,
				offset: ''
			})).concat({
				channelId,
				offset: ''
			}),
			verbose: true
		});
	}

	unsubscribe(channelId) {
		this.queueChannels.delete(channelId);
		if (!this.channels.delete(channelId)) return;
		this.sendCommand(Opcodes.NAVIGATE, {
			channels: Array(Array.from(this.channels.values()), Array.from(this.queueChannels.values())).flat().map(channelId => ({
				channelId,
				offset: ''
			})),
			deactivatedChannels: [{
				channelId,
				offset: ''
			}],
			verbose: true
		});
	}

	#parseMessageType(message, channel) {
		if (channel !== this.user.channelId)
			return message && "message_like" === message.type ? MessageTypes.LIKE : "profile.emailVerified" === message.type ? MessageTypes.EMAIL_VERIFIED : void 0;
		return "join_notification" === message.type ? MessageTypes.JOIN : "private_notification" === message.type || message.update || message.giftname ? MessageTypes.PRIVATE : message.whom ? MessageTypes.BLOCKED_WHOM : message.by ? MessageTypes.BLOCKED_BY : "alipay_notification" === message.type ? MessageTypes.ALIPAY : void 0
	}

	async login(token, listener) {
		if (typeof token == 'object' && token != null) {
			token = await this.requests.post("functions/v2:profile.login", {
				username: token.username ?? token.login,
				password: token.password
			}, true).then(({ auth }) => auth.sessionToken);
			if (!token) {
				throw new Error("Invalid login info");
			}
		}

		let data = await this.requests.attachToken(token);
		this.user = new ClientUser(data, { client: this });
		this.users.cache.set(this.user.id, this.user);
		await this.#connect(async socket => {
			typeof listener == 'function' && this.once('ready', listener);
			await this.user.friends.fetch();
			await this.user.contacts.fetchBlocked();
			for (let entry of await Promise.all(data.favorites.map(item => {
				return this.dialogues.fetch(item).then(dialogue => {
					return dialogue && (dialogue.friend || dialogue.founder);
				}).catch(err => this.users.fetch(item).then(user => user.fetchDM()).catch(err => null))
			})).then(entries => entries.filter(entry => entry))) {
				this.user.favorites.cache.set(entry.id, entry);
			}

			this.queueChannels.add(this.user.channelId);
			let groups = await this.groups.fetchActive();
			for (let channelId of groups.keys()) {
				this.queueChannels.add(channelId);
			}

			this.sendCommand(Opcodes[this.queueChannels.size > 1 ? "INIT" : "AUTH"], {
				channels: Array.from(this.queueChannels.values()).flat().map(channelId => ({
					channelId,
					offset: ''
				})),
				deactivatedChannels: [],
				sessionId: token,
				verbose: true
			});
			let pingInterval = this.#pubnub || setInterval(() => {
				if (Date.now() - this.#pingTimestamp > 3e4) {
					clearInterval(pingInterval);
					this.emit('stale');
					this.emit('timeout');
					if (this.#reconnectAttempts++ > this.maxReconnectAttempts) {
						throw new Error("Connection timed out! Failed to reconnect. Max reconnect attempts reached.");
					}
					this.#reconnectAttempts > 1 && (this.#connectionId = null);
					this.reconnect()
				}
			})
		})
	}
}