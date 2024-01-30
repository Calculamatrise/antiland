import EventEmitter from "events";
import { WebSocket } from "ws";

import RequestHandler from "../utils/RequestHandler.js";
import ClientUser from "../structures/ClientUser.js";
import FriendRequest from "../structures/FriendRequest.js";
import GiftMessage from "../structures/GiftMessage.js";
import Message from "../structures/Message.js";
// import User from "../structures/User.js";

import MessageTypes from "../utils/MessageTypes.js";
import Opcodes from "../utils/Opcodes.js";

export default class extends EventEmitter {
	static sharedGroups = new Set();
	static lastMessageId = new Map();
	#connection = null;
	#connectionId = null;
	#reconnectAttempts = 0;
	#clientVersion = "nodejs/0.0.0-alpha"; // prev: web/241228001, web/241226002
	#host = "ps.anti.land";
	#url = "wss://" + this.#host + "/v1/";
	#pingTimeout = null;
	#pingTimestamp = Date.now();
	channels = new Set();
	queueChannels = new Set();
	maxReconnectAttempts = 3;
	ping = 0;
	requests = new RequestHandler();
	#connect(token) {
		this.#connection = new WebSocket(this.#url + "?client=" + this.#clientVersion + (this.#connectionId ? '&connectionId=' + this.#connectionId : ''));
		this.#connection.addListener('message', this.#handleMessage.bind(this))
		this.#connection.addListener('open', async () => {
			this.#reconnectAttempts > 0 && console.log(this.user);
			this.sendCommand(Opcodes.INIT, {
				channels: [{
					channelId: this.user.privateChannelId,
					offset: ''
				}/*, {
					channelId: 'OnC1z8QCsB',
					offset: ''
				}, {
					channelId: '3EGYml9VYS',
					offset: ''
				}*/],
				deactivatedChannels: [],
				sessionId: token,
				verbose: true
			});
			let pingInterval = setInterval(() => {
				if (Date.now() - this.#pingTimestamp > 6e4) {
					clearInterval(pingInterval);
					if (this.#reconnectAttempts++ > this.maxReconnectAttempts) {
						throw new Error("Connection timed out! Failed to reconnect. Max reconnect attempts reached.");
					}
					this.reconnect();
				}
			})
		})
		this.#connection.addListener('error', err => {
			console.warn('Something went wrong, restarting the bot', err);
			this.reconnect();
		})
	}

	destroy(disconnect) {
		return new Promise((resolve, reject) => {
			this.#connection && (disconnect && (this.#connectionId = null,
			this.removeAllListeners()),
			this.#pingTimeout && clearTimeout(this.#pingTimeout),
			this.#connection.once('close', resolve),
			// this.#connection.close(), // noticed duplicate listeners being fired
			this.#connection.terminate(),
			this.#connection = null);
		})
	}

	async reconnect() {
		this.emit('reconnecting');
		let config = await this.requests.fetchConfigBody();
		await this.destroy();
		if (!config._SessionToken) {
			throw new Error("Session token not found!");
		}
		this.#connect(config._SessionToken);
	}

	outgoing = new Set();
	sendCommand(code, payload, uniqueId) {
		uniqueId && (uniqueId = Date.now().toString() + Math.random(),
		this.outgoing.add(uniqueId));
		return this.#connection.send(JSON.stringify(Object.assign({
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
			this.#reconnectAttempts = 0;
			this.#pingTimestamp = Date.now();
			this.sendCommand(Opcodes.PING);
			this.#connectionId = payload.connectionId;
			this.emit('ready');
			break;
		case Opcodes.MESSAGE:
			this.emit('raw', payload);
			let lastMessageTimestamp = this.#lastMessageTimestamp.get(payload.channelId) ?? 0;
			// payload.messages = payload.messages.filter(msg => !msg.createdAt || msg.createdAt >= lastMessageTimestamp);
			if (payload.messages.length < 1) break;
			if (payload.channelId == this.user.privateChannelId) {
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
						switch(message.type.toLowerCase()) {
						case 'mate.event.request':
							let entry = new FriendRequest(message, this.user.friends);
							this.user.friends.pending.incoming.set(entry.id, entry);
							this.emit('friendRequest', entry);
							break;
						case 'notification':
							this.emit('notificationCreate', message);
							break;
						}
						this.emit('rawNotification', message);
					}

					// private message received..
					this.emit('rawPrivate', message)
				}
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

			for (let item of payload.messages.filter(msg => !msg.type || msg.type == 'private_notification')/*.filter(msg => msg.createdAt > lastMessageTimestamp)*/.reverse()) {
				let dialogueId = item.dialogue || item.dialogueId || item.deleteChat || (payload.channelId !== this.user.privateChannelId && payload.channelId);
				let dialogue = this.dialogues.cache.get(dialogueId) || await this.dialogues.fetch(dialogueId).then(async dialogue => {
					// await dialogue.members.fetchActive();
					// await dialogue.members.fetch(); // fetch active members only?? // make sure type is group
					return dialogue
				});
				if (!dialogue) {
					console.warn("Dialogue not found:", item);
					continue
				} else if (item.deleteChat) {
					this.emit('banCreate', dialogue);
					// this.emit('channelUpdate', dialogue);
					continue
				}
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
					message._update(item);
					message.updatedAt = new Date(typeof item.createdAt == 'object' ? item.createdAt.iso : item.createdAt);
					this.emit('messageUpdate', message);
					if (/^\*{5}$/.test(message.content)) {
						this.emit('messageDelete', message);
						dialogue.messages.cache.delete(message.id);
					}
					continue
				}
				typeof item.sender == 'object' && (this.users.cache.has(item.sender.id) || await this.users.fetch(item.sender.id)); // fetch all group members instead up there ^^
				let message = new Message(item, dialogue);
				if (this.constructor.sharedGroups.has(dialogue.id) && this.constructor.lastMessageId.get(dialogue.id) === message.id) continue;
				this.constructor.lastMessageId.set(dialogue.id, message.id);
				if (message.likeCount > 1 && message.createdAt > lastMessageTimestamp) continue;
				let blocked = this.user.contacts.blocked.has(message.author.id);
				blocked && (message.author.blocked = true);
				this.emit('messageCreate', message, blocked)
			}

			for (let like of payload.messages.filter(msg => /^message_like$/i.test(msg.type))) {
				this.emit('messageReactionAdd', like)
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
			this.outgoing.delete(payload.id);
			break;
		case Opcodes.PONG:
			this.ping = Date.now() - this.#pingTimestamp;
			this.emit('ping', this.ping);
			// this.requests.post("functions/v2:chat.presence.ping", {
			// 	dialogueId: this.user.id
			// })
			this.#pingTimeout = setTimeout(() => {
				this.#pingTimestamp = Date.now();
				this.#connection && this.sendCommand(Opcodes.PING);
			}, 1e4 /* 6e4 */);
			break;
		default:
			console.log('unrecognized opcode', data)
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
		if (channel !== this.user.privateChannelId)
			return message && "message_like" === message.type ? MessageTypes.LIKE : "profile.emailVerified" === message.type ? MessageTypes.EMAIL_VERIFIED : void 0;
		return "join_notification" === message.type ? MessageTypes.JOIN : "private_notification" === message.type || message.update || message.giftname ? MessageTypes.PRIVATE : message.whom ? MessageTypes.BLOCKED_WHOM : message.by ? MessageTypes.BLOCKED_BY : "alipay_notification" === message.type ? MessageTypes.ALIPAY : void 0
	}

	async login(token, listener) {
		if (typeof token == 'object' && token != null) {
			token = await this.requests.post("functions/v2:profile.login", {
				username: token.username ?? token.login,
				password: token.password
			}).then(r => r.sessionToken);
			if (!token) {
				throw new Error("Invalid login info");
			}
		}

		let data = await this.requests.attachToken(token);
		if (data) {
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
		}
		typeof listener == 'function' && this.once('ready', listener);
		this.#connect(token)
	}
}