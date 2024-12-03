import EventEmitter from "events";
import { WebSocket } from "ws";

import PubNubBroker from "../utils/PubNubBroker.js";
import RequestHandler from "../utils/RequestHandler.js";
import ClientUser from "../structures/ClientUser.js";
import Dialogue from "../structures/Dialogue.js";
import FriendRequest from "../structures/FriendRequest.js";
import GiftMessage from "../structures/GiftMessage.js";
import Group from "../structures/Group.js";
import Member from "../structures/Member.js";
import Message from "../structures/Message.js";
import SystemMessage from "../structures/SystemMessage.js";
import User from "../structures/User.js";

import Events from "../utils/Events.js";
import KarmaTask from "../utils/KarmaTask.js";
import MessageType from "../utils/MessageType.js";
import Opcodes from "../utils/Opcodes.js";

export default class extends EventEmitter {
	#reconnectAttempts = 0;
	#clientVersion = "nodejs/antiland";
	#gateway = "wss://ps.anti.land/v";
	#lastMessageTimestamp = new Map();
	#pingTimeout = null;
	#pingTimestamp = Date.now();
	#subscriptionQueue = new Set();
	#timeouts = [];
	#ws = null;
	_outgoing = new Set();
	connectionId = null;
	options = {
		fallback: true,
		gatewayVersion: 2,
		localization: 'en',
		maxReconnectAttempts: 3,
		pubnub: false,
		reconnectDelay: 0,
		staleTimer: 3e4,
		subscribe: true
	};
	ping = 0;
	readyAt = null;
	readyTimestamp = null;
	rest = new RequestHandler(this);
	subscriptions = new Set();
	token = null;
	user = null;

	get uptime() {
		return Number(this.readyTimestamp && (Date.now() - this.readyTimestamp))
	}

	/**
	 * @param {ClientOptions} [options]
	 * @param {Iterable<string>} [options.channels] initial subscriptions
	 * @param {boolean} [options.fallback] whether to fallback to a pubnub connection
	 * @param {number} [options.gatewayVersion]
	 * @param {string} [options.localization]
	 * @param {number} [options.maxReconnectAttempts]
	 * @param {boolean} [options.pubnub] prefer pubnub
	 * @param {number} [options.reconnectDelay] delay before attempting to reconnect
	 * @param {number} [options.staleTimer] stale determinator
	 * @param {boolean} [options.subscribe] whether to automatically subscribe to active chats
	 */
	constructor(options) {
		Object.defineProperties(super(), {
			_outgoing: { enumerable: false },
			connectionId: { enumerable: false },
			readyAt: { enumerable: false },
			token: { enumerable: false }
		});
		for (let [key, value] of Object.entries(options).filter(([key, value]) => {
			return this.options.hasOwnProperty(key) && (this.options[key] === null || typeof this.options[key] == typeof value);
		})) {
			this.options[key] = value;
		}
	}

	#connect(cb) {
		return new Promise((resolve, reject) => {
			let socket = this.options.pubnub ? new PubNubBroker(this) : new WebSocket(this.#gateway + this.options.gatewayVersion + "/?client=" + this.#clientVersion + (this.connectionId ? '&connectionId=' + this.connectionId : ''))
			  , errHandler = err => this.options.maxReconnectAttempts > this.#reconnectAttempts++ ? resolve(this.options.fallback && (this.options.pubnub = true), this.#connect(cb)) : reject(err);
			socket.on('error', err => {
				if (socket.readyState === socket.OPEN) {
					this.emit(Events.Error, err);
					if (0 < this.listenerCount('error')) {
						return;
					}
				} else if (this.options.maxReconnectAttempts > this.#reconnectAttempts++) {
					this.options.fallback && (this.options.pubnub = true),
					this.#connect(cb);
					return;
				}
				throw err
			}),
			socket.once('error', errHandler),
			socket.on('close', code => {
				for (const timeout of this.#timeouts) {
					clearTimeout(timeout);
				}

				this.#timeouts.splice(0);
				if (1000 !== code && this.options.maxReconnectAttempts > this.#reconnectAttempts++) {
					this.options.fallback && (this.options.pubnub = true),
					this.#connect(cb);
					return;
				}
				this.#ws._staleTimer && clearInterval(this.#ws._staleTimer),
				this.#ws = null,
				this.emit('disconnect', code)
			}),
			socket.on('message', (...args) => this.#ws.readyState === this.#ws.OPEN && this.#messageListener(...args)),
			socket.once('open', () => {
				this.#ws = socket,
				socket.off('error', errHandler),
				typeof cb == 'function' && cb(socket),
				resolve(socket),
				this.options.pubnub || (socket._staleTimer = setInterval(() => {
					if (this.ping > 1e4) {
						clearInterval(socket._staleTimer),
						this.emit('stale'),
						this.emit('timeout');
						if (this.#reconnectAttempts++ > this.options.maxReconnectAttempts) {
							throw new Error("Connection timed out! Failed to reconnect. Max reconnect attempts reached.");
						}
						this.#reconnectAttempts > 1 && (this.connectionId = null),
						socket.isStale = !0,
						this.reconnect()
					}
				}))
			})
		})
	}

	#errorHandler(err) {
		if (this.listenerCount('error') > 0) {
			this.emit(Events.Error, err);
		} else throw err
	}

	#messageListener(message) {
		let data = message.toString('utf-8');
		try {
			data = JSON.parse(data)
		} catch(e) { return }
		let payload = data && data.payload;
		switch (data.type) {
		case Opcodes.AUTH_SUCCESS:
			this.connectionId = payload.connectionId,
			this.#pingTimestamp = Date.now(),
			this.#reconnectAttempts = 0,
			this.readyTimestamp = Date.now(),
			this.readyAt = new Date(this.readyTimestamp),
			this.emit(Events.ClientReady),
			this.sendCommand(Opcodes.PING);
			break;
		case Opcodes.AUTH_FAILURE:
			this.#errorHandler(new Error('Authentication failed.', { cause: payload }));
			break;
		case Opcodes.MESSAGE:
			this.emit(Events.Raw, payload);
			for (let message of payload.messages) {
				this._handleMessage(message, payload).catch(this.#errorHandler.bind(this));
			}
			break;
		case Opcodes.SUBSCRIPTIONS:
			if (!payload) break; // channel not found
			if (this.options.gatewayVersion > 1) {
				if ('channels' in payload) {
					for (let channelId of payload.channels)
						this.#subscriptionQueue.delete(channelId),
						this.subscriptions.add(channelId),
						channelId !== this.user.channelId && this.emit(Events.ChannelCreate, channelId);
				}

				if ('deactivatedChannels' in payload) {
					for (let channelId of payload.deactivatedChannels)
						this.#subscriptionQueue.delete(channelId),
						this.subscriptions.delete(channelId),
						channelId !== this.user.channelId && this.emit(Events.ChannelDelete, channelId);
				}
			}

			if ('diff' in payload) {
				for (let channelId of payload.diff.dropped)
					this.#subscriptionQueue.delete(channelId),
					this.subscriptions.delete(channelId),
					channelId !== this.user.channelId && this.emit(Events.ChannelDelete, channelId);
				for (let channelId of payload.diff.added)
					this.#subscriptionQueue.delete(channelId),
					this.subscriptions.add(channelId),
					channelId !== this.user.channelId && this.emit(Events.ChannelCreate, channelId);
			}
			break;
		case Opcodes.ACK:
			this._outgoing.delete(payload.id),
			this.emit('ack', payload);
			break;
		case Opcodes.PONG:
			this.ping = Date.now() - this.#pingTimestamp,
			// ping all chat presences
			// this.rest.post("functions/v2:chat.presence.ping", {
			// 	dialogueId: this.user.id
			// }),
			this.#pingTimeout = setTimeout(() => {
				this.#pingTimestamp = Date.now(),
				this.#ws && this.sendCommand(Opcodes.PING)
			}, 1e4 /* 6e4 */);
			break;
		default:
			if ('error' in data) {
				this.#errorHandler(new Error(data.error));
				break;
			}
			console.warn('unrecognized opcode', data),
			this.emit(Events.Debug, { message, type: 'UNKNOWN_OPCODE' }),
			this.emit(Events.Warn, "Unrecognized opcode:", data)
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
				this.user.blockedBy.add(data.senderId),
				this.emit(Events.ClientBlockAdd, data.senderId); // relationshipUpdate? // clientBlocked
				return;
			case MessageType.BLOCKED_WHOM:
				this.user.contacts.blocked.add(data.receiverId),
				this.emit(Events.ContactBlockAdd, data.receiverId); // relationshipUpdate? // blocked
				return;
			case MessageType.CHANNEL_BAN_CREATE:
				// setTimeout for ban, then emit ChannelBanRemove/Expire
				return this.emit(Events.ChannelBanAdd, data);
			case MessageType.GIFT_MESSAGE:
				let message = new SystemMessage(data, data.dialogue);
				this.emit(Events.SystemMessageCreate, message);
				// message.receiverId == this.user.id && (this.user.karma += message.karma,
				// this.emit('giftReceive', message)); // emit notification?
				return;
			case MessageType.KARMA_TASK_PROGRESS:
				switch(data.body.task.id?.replace(/\d+/g, '#')) {
				case KarmaTask.DAILY_BONUS:
					// start 24 hour timeout then emit Events.KarmaTaskCreate
					this.user.karma += data.body.task.reward.currencyReward?.price?.karma | 0,
					this.user.tasks.update(data.body.task),
					this.emit(Events.KarmaTaskUpdate, data.body.task);
					if (data.body.task.localNotifications && data.body.task.localNotifications.length > 0) {
						for (let { onBeforeExpire: { iso }} of data.body.task.localNotifications) {
							this.#timeouts.push(setTimeout(() => {
								this.emit(Events.KarmaTaskCreate, data.body.task)
							}, Date.parse(iso) - Date.now()));
						}
					}
					break;
				default:
					console.warn('unknown karma task', data.body),
					this.emit(Events.Warn, "Unknown KarmaTask:", data.body);
					return this.emit(Events.Debug, { data: data.body, type: 'UNKNOWN_KARMA_TASK' })
				}
				this.emit(Events.KarmaTaskUpdate, data);
				return;
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
				// data.hasOwnProperty('gift') && this.emit('giftReceived', data),
				this.emit(Events.NotificationCreate, data);
				return;
			case MessageType.UNBLOCKED_BY:
				this.user.blockedBy.delete(data.senderId),
				this.emit(Events.ClientBlockRemove, data.sender)  // relationshipUpdate? // clientBlocked
				return;
			case MessageType.UNBLOCKED_WHOM:
				this.user.contacts.blocked.delete(data.receiverId),
				this.emit(Events.ContactBlockRemove, data.receiver)  // relationshipUpdate? // blocked
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
			this.emit(Events.ChannelMemberAdd, data.member);
			return;
		case MessageType.CHANNEL_PRESENCE_CREATE:
			this.emit(Events.ChannelPresenceCreate, data);
			return;
		case MessageType.CHANNEL_PRESENCE_DELETE:
			this.emit(Events.ChannelPresenceDelete, data);
			return;
		case MessageType.CHANNEL_TYPING_START:
			this.emit(Events.ChannelTypingStart, data);
			return;
		case MessageType.CHANNEL_TYPING_END:
			this.emit(Events.ChannelTypingEnd, data);
			return;
		case MessageType.GIFT_MESSAGE:
			let message = new GiftMessage(data, data.dialogue);
			this.emit(Events.GiftMessageCreate, message),
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
			data.update && data.message && data.message._patch(data, true),
			temp = data.message || new Message(data, data.dialogue, true),
			temp._patch({ deleted: true, updatedAt: data.createdAt }),
			this.emit(Events.MessageDelete, temp);
			return;
		case MessageType.MESSAGE_LIKE:
			data.message && data.message._patch(data, true),
			this.emit(Events.MessageReactionAdd, data);
			return;
		case MessageType.MESSAGE_REPORT:
			this.emit(Events.MessageReport, data);
			return;
		case MessageType.MESSAGE_UPDATE:
			data.update && data.message._patch(data, true),
			temp = data.message || new Message(data, data.dialogue),
			temp._patch({ updatedAt: data.createdAt }),
			this.emit(Events.MessageUpdate, temp);
			return;
		default:
			console.warn('unrecognized action', data);
			return
		}
		let message = new Message(data, data.dialogue);
		if (this.#lastMessageTimestamp.has(channelId) && message.createdTimestamp <= this.#lastMessageTimestamp.get(channelId)) return;
		this.#lastMessageTimestamp.set(channelId, message.createdTimestamp),
		data.dialogue.lastMessage = message,
		data.dialogue.lastMessageId = message.id,
		this.user.contacts.blocked.has(message.author.id) && (message.author.blocked = true),
		this.emit(Events.MessageCreate, message)
	}

	_verifyCredentials(credentials) {
		return new Promise((resolve, reject) => {
			if (typeof credentials == 'object' && credentials != null) {
				this.rest.post("functions/v2:profile.login", {
					username: credentials.username ?? credentials.user ?? credentials.login,
					password: credentials.password ?? credentials.pass ?? credentials.pwd
				}, true).then(resolve).catch(reject);
			} else if (typeof credentials == 'string') {
				this.rest.constructor.request("functions/v2:profile.me", {
					body: null,
					method: 'POST'
				}, credentials).then(resolve).catch(reject)
			}
		})
	}

	async destroy() {
		this.#pingTimeout && clearTimeout(this.#pingTimeout),
		this.connectionId = null,
		this.user = null,
		this.subscriptions.clear();
		if (!this.#ws) return true;
		return new Promise((resolve, reject) => {
			this.#ws.once('close', resolve),
			this.#ws.once('error', err => arguments.length > 0 ? this.#ws.terminate() : reject(err)),
			this.#ws[this.#ws.isStale ? 'terminate' : 'close'](arguments[0] ?? 1000)
		})
	}

	async reconnect() {
		await this.destroy(1006 /* 3008 timeout */).catch(() => {
			return this.#ws.terminate()
		});
		if (!this.token) {
			throw new Error("Session token not found!");
		}
		this.emit('reconnecting'),
		!this.options.pubnub && this.#reconnectAttempts === this.options.maxReconnectAttempts - 1 && this.options.fallback && (this.options.pubnub = true);
		return this.login(this.token)
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
			let uniqueId = (Date.now() - performance.now()) + '.' + Math.random()
			  , listener;
			this.on('ack', listener = message => {
				if (message.id !== uniqueId) return;
				this.removeListener('ack', listener),
				listener = null,
				typeof cb == 'function' && cb(message),
				resolve(message)
			});
			this.sendCommand(...Array.prototype.splice.call(arguments, 2, 0, uniqueId)),
			setTimeout(() => reject(new RangeError("Request timeout")), 3e4)
		})
	}

	subscribe(channelId, { presence, withPresence } = {}) {
		presence && (channelId = channelId.replace(/-presence$/, '-presence'));
		if (this.subscriptions.has(channelId) || this.#subscriptionQueue.has(channelId)) return;
		this.#subscriptionQueue.add(channelId);
		withPresence && !presence && this.#subscriptionQueue.add(channelId + '-presence');
		this.sendCommand(Opcodes.NAVIGATE, {
			channels: Array(Array.from(this.subscriptions.values()), Array.from(this.#subscriptionQueue.values())).flat().map(channelId => ({
				channelId,
				offset: ''
			})),
			verbose: true
		})
	}

	unsubscribe(channelId, { presence, withPresence } = {}) {
		presence && (channelId = channelId.replace(/-presence$/, '-presence'));
		this.#subscriptionQueue.delete(channelId);
		!presence && withPresence && this.#subscriptionQueue.add(channelId + '-presence');
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
		})
	}

	async login(token, listener) {
		token ??= globalThis.process && process.env.ANTILAND_TOKEN;
		let data = await this._verifyCredentials(token);
		data.auth && data.auth.sessionToken && (this.token = data.auth.sessionToken);
		if (!this.token) {
			throw new Error("Invalid login info");
		}

		this.user = new ClientUser(data, { client: this }),
		this.users.cache.set(this.user.id, this.user);
		await this.#connect(async socket => {
			typeof listener == 'function' && this.once('ready', listener);
			// if blockedBy included 'all', client is in prison or .isInPrison
			this.#subscriptionQueue.add(this.user.channelId);

			const channelsWithPresence = this.options.channelsWithPresence || [];
			if (this.options.subscribe) {
				let groups = await this.groups.fetchActive({ force: true });
				for (let channelId of groups.keys()) {
					this.#subscriptionQueue.add(channelId);
					if (channelsWithPresence.includes(channelId)) {
						this.#subscriptionQueue.add(channelId + '-presence');
					}
				}
			}

			if (this.options.channels) {
				for (let channelId of this.options.channels) {
					this.#subscriptionQueue.add(channelId);
					if (channelsWithPresence.includes(channelId)) {
						this.#subscriptionQueue.add(channelId + '-presence');
					}
				}
			}

			await this.user.friends.fetch(),
			await this.user.contacts.fetchBlocked(),
			await this.user.favorites._cache(data.favorites),
			this.sendCommand(Opcodes[this.#subscriptionQueue.size > 0 ? "INIT" : "AUTH"], {
				channels: Array.from(this.#subscriptionQueue.values()).flat().map(channelId => ({
					channelId,
					offset: ''
				})),
				deactivatedChannels: [],
				sessionId: this.token,
				verbose: true
			})
		})
	}

	async preprocessMessage(data, { channelId }) {
		if (typeof data != 'object' || data === null) return null;
		// if ('body' in data) {
		// 	Object.assign(data, data.body),
		// 	delete data.body;
		// }

		// if (typeof data.header == 'object') {
		// 	Object.defineProperties(data, Object.fromEntries(Object.entries(data.header).map(([key, value]) => [key, {
		// 		value,
		// 		writable: true
		// 	}]))),
		//	delete data.header;
		// }

		data.body && data.header && (Object.assign(data, data.body, data.header),
		Object.defineProperties(data, {
			body: { enumerable: false },
			header: { enumerable: false }
		}));
		let dialogueId = (data.dialogueId || this.constructor.parseId(data.dialogue) || data.did || data.deleteChat || (channelId !== this.user.channelId && channelId)) || null
		  , dialogue = (dialogueId !== null && await this.dialogues.fetch(dialogueId).catch(err => {
			if (err.code !== 141) {
				throw err;
			}
			// this.unsubscribe(dialogueId);
			return new (channelId === this.user.channelId ? Dialogue : Group)(Object.assign({}, data, {
				id: dialogueId,
				objectId: null
			}), { client: this })
		})) || null;
		dialogue !== null && typeof data.dialogue == 'object' && dialogue._patch(data.dialogue);
		let likerId = this.constructor.assertFirst(data.likerId || this.constructor.parseId(data.liker), (data.messageSenderId && (data.senderId || this.constructor.parseId(data.sender))), id => id !== data.messageSenderId) || null
		  , liker = likerId !== null && (this.users.cache.get(likerId) || new User(User.resolve(data, 'liker'), { client: this })) || null;
		liker !== null && liker._patch(data.liker);
		let memberId = data.memberId || this.constructor.parseId(data.member) || null
		  , member = (memberId !== null && (dialogue !== null && dialogue.members.cache.get(memberId) || new Member(Member.resolve(data), dialogue))) || null;
		member !== null && typeof data.member == 'object' && member._patch(data.member);
		let messageId = (data.messageId || data.objectId || (!data.receiver && this.constructor.parseId(data.message)) || data.mid || data.id) || null;
		!data.text && messageId !== null && messageId !== data.message && (data.text = data.message);
		let message = (data.text && dialogue !== null && messageId !== null && dialogue.messages.cache.get(messageId)) || null;
		message !== null && typeof data.message == 'object' && message._patch(data.message);
		let receiverId = (data.receiverId || (messageId === null && this.constructor.parseId(data.receiver)) || (data.hasOwnProperty('whom') && (data.whom || this.user.id))) || null
		  , receiver = (receiverId !== null && this.users.cache.get(receiverId)) || null;
		receiver !== null && typeof data.receiver == 'object' && (// check for changes ,
		receiver._patch(data.receiver, /* callback for changed properties? */));
		let senderId = (data.messageSenderId || data.giftSenderId || data.senderId || this.constructor.parseId(data.sender) || data.sid || (data.hasOwnProperty('by') && (data.by || this.user.id))) || null
		  , sender = senderId !== null && (this.users.cache.get(senderId) || new User(User.resolve(data, 'sender'), { client: this })) || null;
		sender !== null && typeof data.sender == 'object' && data.sender.id !== likerId && (// check for changes ,
		sender._patch(data.sender, /* callback for changed properties? */));
		let type = (data.type && data.type.toUpperCase()) || null;
		type || (data.hasOwnProperty('blocked') && (type = MessageType[(data.blocked ? '' : 'UN') + 'BLOCKED_' + (data.hasOwnProperty('by') ? 'BY' : 'WHOM')]),
		data.hasOwnProperty('text') && (type = MessageType['MESSAGE' + (data.hasOwnProperty('update') ? ((!message || message.content !== data.text) && /^\*{5}$/.test(data.text) ? '_DELETE' : '_UPDATE') : '')]),
		data.hasOwnProperty('deleteChat') && (type = MessageType.CHANNEL_BAN_CREATE),
		data.hasOwnProperty('giftname') && (type = MessageType.GIFT_MESSAGE));
		Object.defineProperties(data, Object.assign({
			dialogue: { enumerable: false, value: dialogue, writable: dialogue !== null },
			dialogueId: { enumerable: true, value: dialogueId, writable: dialogueId !== null },
			isPrivate: { value: channelId === this.user.channelId },
			type: { enumerable: true, value: type, writable: type !== null }
		}, memberId !== null && {
			member: { enumerable: false, value: member, writable: member !== null },
			memberId: { enumerable: true, value: memberId, writable: memberId !== null }
		}, messageId !== null && Object.assign({
			message: { enumerable: false, value: message, writable: message !== null },
			messageId: { enumerable: true, value: messageId, writable: messageId !== null }
		}, type === MessageType.MESSAGE_LIKE && {
			liker: { enumerable: false, value: liker, writable: liker !== null },
			likerId: { enumerable: true, value: likerId, writable: likerId !== null }
		}), receiverId !== null && {
			receiver: { enumerable: false, value: receiver, writable: receiver !== null },
			receiverId: { enumerable: true, value: receiverId, writable: receiverId !== null },
		}, senderId !== null && {
			sender: { enumerable: false, value: sender, writable: sender !== null },
			senderId: { enumerable: true, value: senderId, writable: senderId !== null },
		}));
		// message !== null && data.text && message._patch(data);
		return data
	}

	async [Symbol.asyncDispose]() {
		await this.destroy()
	}

	_validateToken() {
		return this.rest.constructor.request("functions/v2:profile.me", {
			body: null,
			method: 'POST'
		}, token).then(data => {
			if (!data.auth || !data.auth.sessionToken) {
				throw new Error("Invalid token");
			}
			data.auth && data.auth.sessionToken && (this.token = data.auth.sessionToken);
			return data
		})
	}

	static assert(arbitrary, callback = () => !0) {
		return (callback(arbitrary) && arbitrary) ?? null
	}

	static assertAll(...args) {
		let callback = args.at(-1);
		typeof callback != 'function' && (callback = () => !0);
		args.splice(args.indexOf(callback), 1);
		return args.filter(arbitrary => this.assert(arbitrary, callback))
	}

	static assertFirst(...args) {
		let results = this.assertAll(...arguments);
		return (results.length > 0 && results[0]) ?? null
	}

	static parseId(arbitrary) {
		return arbitrary instanceof Object ? arbitrary.id : arbitrary
	}
}