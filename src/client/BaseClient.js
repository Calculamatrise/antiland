import EventEmitter from "events";
import { WebSocket } from "ws";

import PubNubBroker from "../utils/PubNubBroker.js";
import RequestHandler from "../utils/RequestHandler.js";
import ClientUser from "../structures/ClientUser.js";
import FriendRequest from "../structures/FriendRequest.js";
import GiftMessage from "../structures/GiftMessage.js";
import Message from "../structures/Message.js";

import MessageType from "../utils/MessageType.js";
import Opcodes from "../utils/Opcodes.js";

export default class extends EventEmitter {
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
		!this.#pubnub && this.#reconnectAttempts === this.maxReconnectAttempts - 1 && this.#fallback && (this.#pubnub = true);
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
				this._handleMessage(message, payload).catch(err => {
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
			for (let channelId of payload.diff.dropped)
				this.queueChannels.delete(channelId),
				this.channels.delete(channelId),
				channelId !== this.user.channelId && this.emit('channelDelete', channelId);
			for (let channelId of payload.diff.added)
				this.queueChannels.delete(channelId),
				this.channels.add(channelId),
				channelId !== this.user.channelId && this.emit('channelCreate', channelId);
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

	async _handleMessage(data) {
		await this.preprocessMessage(...arguments).catch(err => {
			console.log('errored', err.message, data);
			if (this.listenerCount('error') > 0) {
				this.emit('error', err);
			} else {
				throw err
			}
		});
		if (data.isPrivate) {
			switch(data.type) {
			case MessageType.BLOCKED_BY:
				this.user.blockedBy.add(data.senderId);
				this.emit('blocked', data.sender)  // relationshipUpdate? // clientBlocked
				return;
			case MessageType.BLOCKED_WHOM:
				this.user.contacts.blocked.add(data.receiverId);
				this.emit('userBlocked', data.receiver)  // relationshipUpdate? // blocked
				return;
			case MessageType.KARMA_TASK_PROGRESS:
				switch(data.body.task.id.toLowerCase()) {
				case 'karmatask.dailybonus':
					this.user.karma += data.body.task.reward.currencyReward?.price?.karma | 0;
					return this.emit('taskComplete', data.body.task);
				default:
					console.warn('unknown karma task', data.body);
					return this.emit('debug', { data: data.body, type: 'UNKNOWN_KARMA_TASK' })
				}
			case MessageType.FRIEND_REQUEST_CREATE:
				let entry = new FriendRequest(data, this.user.friends);
				this.user.friends.pending.incoming.set(entry.id, entry);
				return this.emit('friendRequest', entry);
			case MessageType.MESSAGE_DELETE:
			case MessageType.MESSAGE_UPDATE:
			case MessageType.MESSAGE_LIKE:
				break;
			case MessageType.PRIVATE_NOTIFICATION:
				if (data.hasOwnProperty('message') && data.hasOwnProperty('objectId')) {
					data.type = MessageType.PRIVATE_MESSAGE;
					break;
				}
				data.hasOwnProperty('gift') && this.emit('giftReceived', data);
				this.emit('notification', data);
				return;
			case MessageType.UNBLOCKED_BY:
				this.user.blockedBy.remove(data.senderId);
				this.emit('unblocked', data.sender)  // relationshipUpdate? // clientBlocked
				return;
			case MessageType.UNBLOCKED_WHOM:
				this.user.contacts.blocked.remove(data.receiverId);
				this.emit('userUnblocked', data.receiver)  // relationshipUpdate? // blocked
				return;
			default:
				// if (data.hasOwnProperty())
				console.warn('unknown private notification', data);
				return this.emit('debug', { data, type: 'UNKNOWN_MESSAGE' })
			}
		}
		if (!data.dialogue) {
			console.warn("Dialogue not found:", data);
			return
		}
		// check if message id is present to see if an action occurred on a message
		let temp;
		switch(data.type) {
		case MessageType.CHANNEL_BAN_CREATE:
			return this.emit('channelBanAdd', data);
		case MessageType.CHANNEL_MEMBER_ADD:
			return this.emit('channelMemberAdd', data);
		case MessageType.GIFT_MESSAGE:
			let message = new GiftMessage(data, data.dialogue);
			this.emit('messageCreate', message);
			message.receiverId == this.user.id && this.emit('giftMessageCreate', message);
			return;
		case MessageType.MESSAGE:
		case MessageType.PRIVATE_MESSAGE:
			if (data.message !== null) {
				data.message._patch(data); // updates message author
				return;
			}
			break;
		case MessageType.MESSAGE_DELETE:
			data.update && data.message && data.message._patch(data, true);
			temp = data.message || new Message(data, data.dialogue, true);
			temp._patch({ updatedAt: data.createdAt });
			data.dialogue.messages.cache.delete(temp.id);
			this.emit('messageDelete', temp);
			return;
		case MessageType.MESSAGE_LIKE:
			data.message && data.message._patch(data, true);
			this.emit('messageReactionAdd', data);
			return;
		case MessageType.MESSAGE_UPDATE:
			data.update && data.message._patch(data, true);
			temp = data.message || new Message(data, data.dialogue);
			temp._patch({ updatedAt: data.createdAt });
			this.emit('messageUpdate', temp);
			return;
		default:
			console.warn('unrecognized action', data);
			return;
		}
		let message = new Message(data, data.dialogue);
		let blocked = this.user.contacts.blocked.has(message.author.id);
		blocked && (message.author.blocked = true);
		this.emit('messageCreate', message, blocked);
	}

	subscribe(channelId) {
		if (this.channels.has(channelId)) return;
		this.queueChannels.add(channelId);
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
			return message && "message_like" === message.type ? MessageType.LIKE : "profile.emailVerified" === message.type ? MessageType.EMAIL_VERIFIED : void 0;
		return "join_notification" === message.type ? MessageType.JOIN : "private_notification" === message.type || message.update || message.giftname ? MessageType.PRIVATE_NOTIFICATION : message.whom ? MessageType.BLOCKED_WHOM : message.by ? MessageType.BLOCKED_BY : "alipay_notification" === message.type ? MessageType.ALIPAY : void 0
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

			// if blockedBy included 'all', client is in prison.
			this.queueChannels.add(this.user.channelId);
			let groups = await this.groups.fetchActive({ force: true });
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

	async preprocessMessage(data, { channelId }) {
		let dialogueId = (data.dialogueId || this.constructor.parseId(data.dialogue) || data.did || data.deleteChat || (channelId !== this.user.channelId && channelId)) || null;
		let dialogue = (dialogueId !== null && await this.dialogues.fetch(dialogueId).catch(err => {
			if (err.code !== 141) {
				throw err;
			}
			this.unsubscribe(dialogueId)
		})) || null;
		dialogue !== null && typeof data.dialogue == 'object' && dialogue._patch(data.dialogue);
		let likerId = this.constructor.assertFirst(data.likerId || this.constructor.parseId(data.liker), (data.messageSenderId && (data.senderId || this.constructor.parseId(data.sender))), id => id !== data.messageSenderId) || null;
		let liker = (likerId !== null && await this.users.fetch(likerId)) || null;
		liker !== null && typeof data.liker == 'object' && liker._patch(data.liker);
		let messageId = (data.messageId || data.objectId || (!data.receiver && this.constructor.parseId(data.message)) || data.mid || data.id) || null;
		!data.text && messageId !== null && messageId !== data.message && (data.text = data.message);
		let message = (data.text && dialogue !== null && messageId !== null && dialogue.messages.cache.get(messageId)) || null;
		message !== null && typeof data.message == 'object' && message._patch(data.message);
		let receiverId = (data.receiverId || (messageId === null && this.constructor.parseId(data.receiver)) || (data.hasOwnProperty('whom') && (data.whom || this.user.id))) || null;
		let receiver = (receiverId !== null && await this.users.fetch(receiverId)) || null;
		receiver !== null && typeof data.receiver == 'object' && (// check for changes ,
		receiver._patch(data.receiver, /* callback for changed properties? */));
		let senderId = (data.messageSenderId || data.senderId || this.constructor.parseId(data.sender) || data.sid || (data.hasOwnProperty('by') && (data.by || this.user.id))) || null;
		let sender = (senderId !== null && await this.users.fetch(senderId)) || null;
		sender !== null && typeof data.sender == 'object' && data.sender.id !== likerId && (// check for changes ,
		sender._patch(data.sender, /* callback for changed properties? */));
		let type = (data.type && data.type.toUpperCase()) || null;
		type || (data.hasOwnProperty('blocked') && (type = MessageType[(data.blocked ? '' : 'UN') + 'BLOCKED_' + (data.hasOwnProperty('by') ? 'BY' : 'WHOM')]),
		data.hasOwnProperty('text') && (type = MessageType['MESSAGE' + (data.hasOwnProperty('update') ? ((!message || message.content !== data.text) && /^\*{5}$/.test(data.text) ? '_DELETE' : '_UPDATE') : '')]),
		data.hasOwnProperty('deleteChat') && (type = MessageType.CHANNEL_BAN_CREATE),
		data.hasOwnProperty('giftname') && (type = MessageType.GIFT_MESSAGE));
		Object.defineProperties(data, Object.assign({
			dialogue: { enumerable: true, value: dialogue, writable: dialogue !== null },
			dialogueId: { enumerable: true, value: dialogueId, writable: dialogueId !== null },
			isPrivate: { value: channelId === this.user.channelId },
			sender: { enumerable: true, value: sender, writable: sender !== null },
			senderId: { enumerable: true, value: senderId, writable: senderId !== null },
			type: { enumerable: true, value: type, writable: type !== null }
		}, messageId !== null && Object.assign({
			message: { enumerable: false, value: message, writable: message !== null },
			messageId: { enumerable: true, value: messageId, writable: messageId !== null }
		}, type === MessageType.MESSAGE_LIKE && {
			liker: { enumerable: true, value: liker, writable: liker !== null },
			likerId: { enumerable: true, value: likerId, writable: likerId !== null }
		}), receiverId !== null && {
			receiver: { enumerable: true, value: receiver, writable: receiver !== null },
			receiverId: { enumerable: true, value: receiverId, writable: receiverId !== null },
		}));
		// message !== null && data.text && message._patch(data);
		return data;
	}

	static assert(arbitrary, callback = () => !0) {
		return (callback(arbitrary) && arbitrary) ?? null;
	}

	static assertAll(...args) {
		let callback = args.at(-1);
		typeof callback != 'function' && (callback = () => !0);
		args.splice(args.indexOf(callback), 1);
		return args.filter(arbitrary => this.assert(arbitrary, callback));
	}

	static assertFirst(...args) {
		let results = this.assertAll(...arguments);
		return (results.length > 0 && results[0]) ?? null;
	}

	static parseId(arbitrary) {
		return arbitrary instanceof Object ? arbitrary.id : arbitrary;
	}
}