import EventEmitter from "events";
import { WebSocket } from "ws";

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
	#connectionId = null;
	#reconnectAttempts = 0;
	#clientVersion = "nodejs/0.0.0-gamma";
	#host = "ps.anti.land";
	#url = "wss://" + this.#host + "/v1/";
	#pingTimeout = null;
	#pingTimestamp = Date.now();
	#ws = null;
	_outgoing = new Set();
	channels = new Set();
	queueChannels = new Set();
	maxReconnectAttempts = 3;
	ping = 0;
	requests = new RequestHandler();

	/**
	 * @param {object} [options]
	 * @param {number} [options.maxReconnectAttempts]
	 */
	constructor(options) {
		super();
		for (let key in options) {
			switch(key.toLowerCase()) {
			case 'maxReconnectAttempts':
				this[key] = options[key] | 0;
			}
		}
		if (this.maxReconnectAttempts > 0) {
			let listener;
			this.on('error', listener = err => {
				this.#reconnectAttempts++ > this.maxReconnectAttempts && this.reconnect() || this.off('error', listener)
			})
		}
	}
	#connect(cb) {
		return new Promise((resolve, reject) => {
			let socket = new WebSocket(this.#url + "?client=" + this.#clientVersion + (this.#connectionId ? '&connectionId=' + this.#connectionId : ''));
			socket.on('close', code => this.emit('disconnect', code)),
			socket.on('error', err => (this.emit('error', err), reject(err))),
			socket.on('message', this.#handleMessage.bind(this)),
			socket.on('open', () => (typeof cb == 'function' && cb(socket), resolve(this.#ws = socket)))
		})
	}

	destroy(disconnect) {
		return new Promise((resolve, reject) => {
			this.#ws && (disconnect && (this.#connectionId = null,
			this.removeAllListeners()),
			this.#pingTimeout && clearTimeout(this.#pingTimeout),
			this.#ws.once('close', resolve),
			this.#ws.once('error', reject),
			this.#ws.terminate(),
			this.#ws = null)
		})
	}

	async reconnect() {
		this.emit('reconnecting');
		let config = await this.requests.fetchConfigBody();
		await this.destroy();
		if (!config._SessionToken) {
			throw new Error("Session token not found!");
		}
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

	#lastMessageTimestamp = new Map();
	async #handleMessage(message) {
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
			let lastMessageTimestamp = this.#lastMessageTimestamp.get(payload.channelId) ?? 0;
			// payload.messages = payload.messages.filter(msg => !msg.createdAt || msg.createdAt >= lastMessageTimestamp);
			if (payload.messages.length < 1) break;
			if (payload.channelId == this.user.channelId) {
				let blockedUserEvents = payload.messages.filter(msg => msg.hasOwnProperty('blocked'));
				payload.messages = payload.messages.filter(msg => !blockedUserEvents.includes(msg));
				for (let entry of blockedUserEvents) {
					if (entry.by) {
						let user = this.users.cache.get(entry.by) || await this.users.fetch(entry.by);
						this.user.blockedBy[entry.blocked ? 'add' : 'delete'](user.id);
						this.emit((entry.blocked ? '' : 'un') + 'blocked', user)
					} else if (entry.whom) {
						let user = this.users.cache.get(entry.whom) || await this.users.fetch(entry.whom);
						this.user.contacts.blocked[entry.blocked ? 'add' : 'delete'](user.id);
						this.emit('user' + (entry.blocked ? 'B' : 'Unb') + 'locked', user)
					}
				}

				for (let message of payload.messages) {
					if (typeof message.type == 'string') {
						// message.hasOwnProperty('dialogueId') && (message.dialogue = await this.dialogues.fetch(message.dialogueId));
						// message.hasOwnProperty('senderId') && (message.sender = await this.users.fetch(message.senderId));
						switch(message.type.toLowerCase()) {
						case 'join_notification':
							message.hasOwnProperty('dialogueId') && Object.defineProperty(message, 'dialogue', { value: await this.dialogues.fetch(message.dialogueId) });
							message.hasOwnProperty('senderId') && Object.defineProperty(message, 'sender', { value: await this.users.fetch(message.senderId) });
							this.emit('channelMemberAdd', dialogue, user);
							break;
						case 'mate.event.request':
							let entry = new FriendRequest(message, this.user.friends);
							this.user.friends.pending.incoming.set(entry.id, entry);
							this.emit('friendRequest', entry);
							break;
						case 'message_like':
							// this.emit('clientMessageLiked');
						case 'private_notification':
							message.hasOwnProperty('dialogueId') && Object.defineProperty(message, 'dialogue', { value: await this.dialogues.fetch(message.dialogueId) });
							message.hasOwnProperty('senderId') && Object.defineProperty(message, 'sender', { value: await this.users.fetch(message.senderId) });
							this.emit('notification', message);
							payload.messages.splice(payload.messages.indexOf(message), 1);
							break;
						default:
							if (message.hasOwnProperty())
							console.warn('unknown private notification', message);
							this.emit('debug', { message, type: 'UNKNOWN_MESSAGE' })
						}
					}
				}
				if (payload.messages.length < 1) break;
			}

			this.#lastMessageTimestamp.set(payload.channelId, Math.max(...payload.messages.filter(msg => msg.message && msg.senderId && msg.hasOwnProperty('createdAt')).map(msg => msg.createdAt), lastMessageTimestamp) ?? Date.now());
			this.sendCommand(Opcodes.MARK_AS_READ, {
				messages: payload.messages.map(message => ({
					channelId: payload.channelId,
					messageId: message.objectId,
					transport: 'anti',
					ts: Date.now()
				}))
			}, true);
			for (let item of payload.messages.filter(msg => !msg.type || /^(message_like|private_notification)$/i.test(msg.type))/*.filter(msg => msg.createdAt > lastMessageTimestamp)*/.reverse()) {
				let dialogueId = item.dialogue || item.dialogueId || item.deleteChat || (payload.channelId !== this.user.channelId && payload.channelId);
				let dialogue = dialogueId && this.dialogues.cache.get(dialogueId) || await this.dialogues.fetch(dialogueId).then(async dialogue => {
					/^(group|public)$/i.test(dialogue.type) && await dialogue.members.fetchActive();
					// await dialogue.members.fetch(); // fetch active members only?? // make sure type is group
					return dialogue
				}).catch(err => {
					if (this.listenerCount('error') > 0) {
						this.emit('error', err);
					} else {
						throw err
					}
				});
				if (!dialogue) {
					console.warn("Dialogue not found:", item);
					continue
				} else if (item.deleteChat) {
					this.emit('channelBanAdd', dialogue);
					continue
				}
				Object.defineProperty(item, 'dialogue', { enumerable: false, value: dialogue, writable: false });
				Object.defineProperty(item, 'dialogueId', { enumerable: true, value: dialogueId, writable: false });
				if (item.giftname || item.giftName) {
					let message = new GiftMessage(item, dialogue);
					this.emit('messageCreate', message);
					if (message.victim.id == this.user.id) {
						this.emit('giftMessageCreate', message);
					}
					continue
				} else if (item.update) {
					let message = await dialogue.messages.fetch(item.id || item.objectId);
					if (!message) continue;
					message.oldContent = message.content;
					message._patch(item);
					message.updatedAt = new Date(typeof item.createdAt == 'object' ? item.createdAt.iso : item.createdAt);
					this.emit('messageUpdate', message);
					if (/^\*{5}$/.test(message.content)) {
						this.emit('messageDelete', message);
						dialogue.messages.cache.delete(message.id);
					}
					continue
				}
				let senderId = typeof item.sender == 'object' ? item.sender.id : item.sender || item.senderId;
				let sender = this.users.cache.get(senderId) || await this.users.fetch(senderId).catch(err => {
					console.warn('sender not found???', item)
					if (this.listenerCount('error') > 0) {
						this.emit('error', err);
					} else {
						throw err
					}
				});
				Object.defineProperty(item, 'sender', { enumerable: false, value: sender, writable: false });
				Object.defineProperty(item, 'senderId', { enumerable: true, value: senderId, writable: false });
				if (/^message_like$/i.test(item.type)) {
					let admirerId = typeof item.liker == 'object' ? item.liker.id : item.liker || item.likerId;
					let admirer = this.users.cache.get(admirerId) || await this.users.fetch(admirerId);
					Object.defineProperty(item, 'admirer', { enumerable: false, value: admirer, writable: false });
					Object.defineProperty(item, 'admirerId', { enumerable: true, value: admirerId, writable: false });
					let messageId = typeof item.message == 'object' ? item.message.id : item.message || item.messageId;
					let message = dialogue.messages.cache.get(messageId) || await dialogue.messages.fetch(messageId);
					Object.defineProperty(item, 'message', { enumerable: false, value: message, writable: false });
					Object.defineProperty(item, 'messageId', { enumerable: true, value: messageId, writable: false });
					message && message._patch({ likesCount: item.likes });
					this.emit('messageReactionAdd', item);
					continue
				}
				let message = new Message(item, dialogue);
				if (this.constructor.sharedGroups.has(dialogue.id) && this.constructor.lastMessageId.get(dialogue.id) === message.id) continue;
				this.constructor.lastMessageId.set(dialogue.id, message.id);
				if (message.likes > 1 && message.createdAt > lastMessageTimestamp) continue;
				let blocked = this.user.contacts.blocked.has(message.author.id);
				blocked && (message.author.blocked = true);
				this.emit('messageCreate', message, blocked)
			}
			break;
		case Opcodes.OPEN_CHANNELS_CHANGED:
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
		case Opcodes.MARKED_AS_READ:
			this._outgoing.delete(payload.id);
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
			console.log('unrecognized opcode', data);
			this.emit('debug', { message, type: 'UNKNOWN_OPCODE' })
		}
	}

	openChannel(channelId) {
		// if (this.constructor.sharedGroups.has(channelId)) return;
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

	closeChannel(channelId) {
		this.channels.delete(channelId);
		this.queueChannels.delete(channelId);
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
		await this.#connect(async socket => {
			typeof listener == 'function' && this.once('ready', listener);
			this.user = new ClientUser(data, { client: this });
			this.users.cache.set(this.user.id, this.user);
			await this.user.friends.fetch();
			await this.user.contacts.fetchBlocked();
			for (let entry of await Promise.all(data.favorites.map(item => {
				return this.dialogues.fetch(item).then(dialogue => {
					return dialogue && (dialogue.friend || dialogue.founder);
				}).catch(err => this.users.fetch(item))
			})).then(entries => entries.filter(entry => entry))) {
				this.user.favorites.cache.set(entry.id, entry);
			}

			this.#reconnectAttempts > 0 && console.log(this.user);
			this.sendCommand(Opcodes.INIT, {
				channels: [{
					channelId: this.user.channelId,
					offset: ''
				}],
				deactivatedChannels: [],
				sessionId: token,
				verbose: true
			});
			let pingInterval = setInterval(() => {
				if (Date.now() - this.#pingTimestamp > 6e4) {
					clearInterval(pingInterval);
					this.emit('timeout');
					if (this.#reconnectAttempts++ > this.maxReconnectAttempts) {
						throw new Error("Connection timed out! Failed to reconnect. Max reconnect attempts reached.");
					}
					this.reconnect()
				}
			})
		})
	}
}