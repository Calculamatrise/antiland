import EventEmitter from "../../EventEmitter.js";

import PubNubBroker from "../utils/PubNubBroker.js";
import RequestHandler from "../utils/RequestHandler.js";
import ClientUser from "../../../../../src/structures/ClientUser.js";
import FriendRequest from "../../../../../src/structures/FriendRequest.js";
import GiftMessage from "../../../../../src/structures/GiftMessage.js";
import Message from "../../../../../src/structures/Message.js";

import Events from "../../../../../src/utils/Events.js";
import MessageType from "../../../../../src/utils/MessageType.js";
import Opcodes from "../../../../../src/utils/Opcodes.js";

export default class extends EventEmitter {
	#reconnectAttempts = 0;
	#clientVersion = "antiland/web";
	#gateway = "wss://ps.anti.land/v1/";
	#lastMessageTimestamp = new Map();
	#pingTimeout = null;
	#pingTimestamp = Date.now();
	#subscriptionQueue = new Set();
	#timeouts = [];
	#ws = null;
	_outgoing = new Set(); // use this to guaruntee a response from the server/make promises
	connectionId = null;
	options = null;
	ping = 0;
	requests = new RequestHandler(this);
	subscriptions = new Set();
	token = null;
	user = null;

	/**
	 * @param {object} [options]
	 * @param {Iterable<string>} [options.channels] initial subscriptions
	 * @param {boolean} [options.fallback] whether to fallback to a pubnub connection
	 * @param {number} [options.maxReconnectAttempts]
	 * @param {boolean} [options.pubnub] prefer pubnub
	 * @param {boolean} [options.subscribe] whether to automatically subscribe to active chats
	 */
	constructor(options) {
		super();
		this.options = Object.assign({}, this.options, {
			fallback: false,
			pubnub: false,
			subscribe: true
		});
		for (let [key, value] of Object.entries(options).filter(([key, value]) => {
			return this.options.hasOwnProperty(key) && (this.options[key] === null || typeof this.options[key] == typeof value);
		})) {
			this.options[key] = value;
		}
		Object.defineProperties(this, {
			_outgoing: { enumerable: false },
			connectionId: { enumerable: false },
			token: { enumerable: false }
		})
	}

	#connect(cb) {
		return new Promise((resolve, reject) => {
			let socket = this.options.pubnub ? new PubNubBroker(this) : new WebSocket(this.#gateway + "?client=" + this.#clientVersion + (this.connectionId ? '&connectionId=' + this.connectionId : ''));
			socket.addEventListener('close', code => (this.#ws = null, this.emit('disconnect', code))),
			socket.addEventListener('error', err => this.options.maxReconnectAttempts > this.#reconnectAttempts++ ? resolve(this.options.fallback && (this.options.pubnub = true), this.#connect(cb)) : (this.emit(Events.Error, err), reject(err))),
			socket.addEventListener('message', event => this.#messageListener(event.data)),
			socket.addEventListener('open', () => (this.#ws = socket, typeof cb == 'function' && cb(socket), resolve(socket)))
		})
	}

	async destroy(disconnect) {
		disconnect && (this.connectionId = null);
		this.#pingTimeout && clearTimeout(this.#pingTimeout);
		if (!this.#ws) return true;
		return new Promise((resolve, reject) => {
			this.#ws.addEventListener('close', resolve, { once: true }),
			this.#ws.addEventListener('error', reject, { once: true }),
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
		!this.options.pubnub && this.#reconnectAttempts === this.options.maxReconnectAttempts - 1 && this.options.fallback && (this.options.pubnub = true);
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
		})
	}

	#messageListener(message) {
		let data = message.toString('utf-8');
		try {
			data = JSON.parse(data)
		} catch(e) { return }
		let payload = data && data.payload;
		switch (data.type) {
		case Opcodes.AUTH_SUCCESS:
			this.connectionId = payload.connectionId;
			this.#pingTimestamp = Date.now();
			this.#reconnectAttempts = 0;
			this.emit(Events.ClientReady);
			this.sendCommand(Opcodes.PING);
			break;
		// case Opcodes.AUTH_FAILURE:
		// 	this.emit(Events.Error, payload);
		// 	break;
		case Opcodes.MESSAGE:
			this.emit(Events.Raw, payload);
			for (let message of payload.messages) {
				this._handleMessage(message, payload).catch(err => {
					if (this.listenerCount('error') > 0) {
						this.emit(Events.Error, err);
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
			});
			break;
		case Opcodes.SUBSCRIPTIONS:
			if (!payload) break; // channel not found
			for (let channelId of payload.diff.dropped)
				this.#subscriptionQueue.delete(channelId),
				this.subscriptions.delete(channelId),
				channelId !== this.user.channelId && this.emit(Events.ChannelDelete, channelId);
			for (let channelId of payload.diff.added)
				this.#subscriptionQueue.delete(channelId),
				this.subscriptions.add(channelId),
				channelId !== this.user.channelId && this.emit(Events.ChannelCreate, channelId);
			break;
		case Opcodes.ACK:
			this._outgoing.delete(payload.id);
			this.emit('ack', payload);
			break;
		case Opcodes.PONG:
			this.ping = Date.now() - this.#pingTimestamp;
			this.emit(Events.Ping, this.ping);
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
			this.emit(Events.Debug, { message, type: 'UNKNOWN_OPCODE' });
			this.emit(Events.Warn, "Unrecognized opcode:", data);
		}
	}

	async _handleMessage(data, { channelId }) {
		await this.preprocessMessage(...arguments).catch(err => {
			console.warn('errored', err.message, data);
			throw err
		});
		if (data.isPrivate) {
			switch(data.type) {
			case MessageType.BLOCKED_BY:
				this.user.blockedBy.add(data.senderId);
				this.emit(Events.Blocked, data.sender); // relationshipUpdate? // clientBlocked
				return;
			case MessageType.BLOCKED_WHOM:
				this.user.contacts.blocked.add(data.receiverId);
				this.emit(Events.UserBlocked, data.receiver); // relationshipUpdate? // blocked
				return;
			case MessageType.CHANNEL_BAN_CREATE:
				// setTimeout for ban, then emit ChannelBanRemove/Expire
				return this.emit(Events.ChannelBanAdd, data);
			case MessageType.KARMA_TASK_PROGRESS:
				switch(data.body.task.id.toLowerCase()) {
				case 'karmatask.dailybonus':
					// start 24 hour timeout then emit Events.KarmaTaskCreate
					this.user.karma += data.body.task.reward.currencyReward?.price?.karma | 0;
					this.user.tasks.update(data.body.task);
					this.emit(Events.KarmaTaskUpdate, data.body.task);
					if (data.body.task.localNotifications && data.body.task.localNotifications.length > 0) {
						for (let { onBeforeExpire: { iso }} of data.body.task.localNotifications) {
							this.#timeouts.push(setTimeout(() => {
								this.emit(Events.KarmaTaskCreate, data.body.task);
							}, Date.parse(iso) - Date.now()));
						}
					}
					return;
				default:
					console.warn('unknown karma task', data.body);
					this.emit(Events.Warn, "Unknown KarmaTask:", data.body);
					return this.emit(Events.Debug, { data: data.body, type: 'UNKNOWN_KARMA_TASK' })
				}
			case MessageType.FRIEND_REQUEST_CREATE:
				let entry = new FriendRequest(data, this.user.friends);
				this.user.friends.pending.incoming.set(entry.id, entry);
				return this.emit(Events.FriendRequestCreate, entry);
			case MessageType.MESSAGE_DELETE:
			case MessageType.MESSAGE_LIKE:
			case MessageType.MESSAGE_UPDATE:
			case MessageType.STICKER:
				break;
			case MessageType.PRIVATE_NOTIFICATION:
				if (data.hasOwnProperty('message') && data.hasOwnProperty('objectId')) {
					data.type = MessageType.PRIVATE_MESSAGE;
					break;
				}
				data.hasOwnProperty('gift') && this.emit('giftReceived', data);
				this.emit(Events.Notification, data);
				return;
			case MessageType.UNBLOCKED_BY:
				this.user.blockedBy.delete(data.senderId);
				this.emit(Events.Unblocked, data.sender)  // relationshipUpdate? // clientBlocked
				return;
			case MessageType.UNBLOCKED_WHOM:
				this.user.contacts.blocked.delete(data.receiverId);
				this.emit(Events.UserUnblocked, data.receiver)  // relationshipUpdate? // blocked
				return;
			default:
				// if (data.hasOwnProperty())
				console.warn('unknown private notification', data);
				return this.emit(Events.Debug, { data, type: 'UNKNOWN_MESSAGE' })
			}
		}
		if (!data.dialogue) {
			console.warn("Dialogue not found:", data);
			return
		}
		let temp;
		switch(data.type) {
		case MessageType.CHANNEL_MEMBER_ADD:
			return this.emit(Events.ChannelMemberAdd, data);
		case MessageType.GIFT_MESSAGE:
			let message = new GiftMessage(data, data.dialogue);
			this.emit(Events.GiftMessageCreate, message);
			message.receiverId == this.user.id && (this.user.karma += message.karma,
			this.emit('giftReceive', message)); // emit notification?
			return;
		case MessageType.MESSAGE:
		case MessageType.PRIVATE_MESSAGE:
		case MessageType.STICKER:
			if (data.message !== null) {
				data.message._patch(data); // updates message author
				return;
			}
			break;
		case MessageType.MESSAGE_DELETE:
			data.update && data.message && data.message._patch(data, true);
			temp = data.message || new Message(data, data.dialogue, true);
			temp._patch({ deleted: true, updatedAt: data.createdAt });
			this.emit(Events.MessageDelete, temp);
			return;
		case MessageType.MESSAGE_LIKE:
			data.message && data.message._patch(data, true);
			this.emit(Events.MessageReactionAdd, data);
			return;
		case MessageType.MESSAGE_REPORT:
			this.emit(Events.MessageReportAdd, data);
			return;
		case MessageType.MESSAGE_UPDATE:
			data.update && data.message._patch(data, true);
			temp = data.message || new Message(data, data.dialogue);
			temp._patch({ updatedAt: data.createdAt });
			this.emit(Events.MessageUpdate, temp);
			return;
		default:
			console.warn('unrecognized action', data);
			return;
		}
		let message = new Message(data, data.dialogue);
		if (this.#lastMessageTimestamp.has(channelId) && message.createdTimestamp <= this.#lastMessageTimestamp.get(channelId)) return;
		this.#lastMessageTimestamp.set(channelId, message.createdTimestamp);
		data.dialogue.lastMessage = message;
		data.dialogue.lastMessageId = message.id;
		this.user.contacts.blocked.has(message.author.id) && (message.author.blocked = true);
		this.emit(Events.MessageCreate, message);
	}

	subscribe(channelId) {
		if (this.subscriptions.has(channelId) || this.#subscriptionQueue.has(channelId)) return;
		this.#subscriptionQueue.add(channelId);
		this.sendCommand(Opcodes.NAVIGATE, {
			channels: Array(Array.from(this.subscriptions.values()), Array.from(this.#subscriptionQueue.values())).flat().map(channelId => ({
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
		this.#subscriptionQueue.delete(channelId);
		if (!this.subscriptions.delete(channelId)) return;
		this.sendCommand(Opcodes.NAVIGATE, {
			channels: Array(Array.from(this.subscriptions.values()), Array.from(this.#subscriptionQueue.values())).flat().map(channelId => ({
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
		} else if (!token) {
			token = globalThis.process && process.env.ANTILAND_TOKEN;
		}

		let data = await this.requests.post("functions/v2:profile.me", null, token).then(data => {
			data.auth && data.auth.sessionToken && (this.token = data.auth.sessionToken);
			return data
		});
		this.user = new ClientUser(data, { client: this });
		this.users.cache.set(this.user.id, this.user);
		await this.#connect(async socket => {
			typeof listener == 'function' && this.once('ready', listener);
			// if blockedBy included 'all', client is in prison or .isInPrison
			this.#subscriptionQueue.add(this.user.channelId);
			if (this.options.subscribe) {
				let groups = await this.groups.fetchActive({ force: true });
				for (let channelId of groups.keys()) {
					this.#subscriptionQueue.add(channelId);
				}
			} else if (this.options.channels) {
				for (let channelId of this.options.channels) {
					this.#subscriptionQueue.add(channelId);
				}
			}

			this.sendCommand(Opcodes[this.#subscriptionQueue.size > 0 ? "INIT" : "AUTH"], {
				channels: Array.from(this.#subscriptionQueue.values()).flat().map(channelId => ({
					channelId,
					offset: ''
				})),
				deactivatedChannels: [],
				sessionId: token,
				verbose: true
			});
			await this.user.friends.fetch();
			await this.user.contacts.fetchBlocked();
			for (let entry of await Promise.all(data.favorites.map(item => {
				return this.dialogues.fetch(item).catch(err => {
					return this.users.fetch(item).then(user => user.fetchDM()).catch(err => null)
				})
			})).then(entries => entries.filter(entry => entry))) {
				this.user.favorites.cache.set(entry.id, entry);
			}
			let pingInterval = this.options.pubnub || setInterval(() => {
				if (Date.now() - this.#pingTimestamp > 3e4) {
					clearInterval(pingInterval);
					this.emit('stale');
					this.emit('timeout');
					if (this.#reconnectAttempts++ > this.options.maxReconnectAttempts) {
						throw new Error("Connection timed out! Failed to reconnect. Max reconnect attempts reached.");
					}
					this.#reconnectAttempts > 1 && (this.connectionId = null);
					this.reconnect()
				}
			})
		})
	}

	async preprocessMessage(data, { channelId }) {
		data.body && data.header && Object.assign(data, data.body, data.header);
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