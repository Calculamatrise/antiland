import EventEmitter from "events";

import { ActivityTypes, ArtifactTypes, ChannelFlags, Categories, ChatFilters, ChatMoods, ChatSetupFlags, Events, MessageTypes } from "../src";
import CallManager from "../src/managers/CallManager";
import DialogueManager from "../src/managers/DialogueManager";
import GroupManager from "../src/managers/GroupManager";
import StickerManager from "../src/managers/StickerManager";
import UserManager from "../src/managers/UserManager";

import ClientUser from "../src/structures/ClientUser";
import Dialogue from "../src/structures/Dialogue";
import Message from "../src/structures/Message";
import User from "../src/structures/User";
import FriendRequest from "../src/structures/FriendRequest";
import GiftMessage from "../src/structures/GiftMessage";

//#region Classes

export class Client extends EventEmitter {
	public calls: CallManager;
	public dialogues: DialogueManager;
	public groups: GroupManager;
	public stickers: StickerManager;
	public user: ClientUser;
	public users: UserManager;
	public constructor(options?: ClientOptions);
	public destroy(): this;
	public login(token: string | { username: string, password: string }): this;
	public reconnect(): this;
	public subscribe(channelId: string): undefined;
	public unsubscribe(channelId: string): undefined;

	public on<Event extends keyof ClientEvents>(event: Event, listener: (...args: ClientEvents[Event]) => void): this;
	public once<Event extends keyof ClientEvents>(event: Event, listener: (...args: ClientEvents[Event]) => void): this;
	public emit<Event extends keyof ClientEvents>(event: Event, ...args: ClientEvents[Event]): boolean;
	public off<Event extends keyof ClientEvents>(event: Event, listener: (...args: ClientEvents[Event]) => void): this;
	public removeAllListeners<Event extends keyof ClientEvents>(event?: Event): this;
}

//#endregion

//#region Typedefs

export interface ClientEvents {
	banCreate: [dialogue: Dialogue],
	blocked: [blocker: User],
	channelCreate: [dialogue: Dialogue],
	channelDelete: [dialogue: Dialogue],
	channelUpdate: [oldDialogue: Dialogue, newDialogue: Dialogue],
	debug: [data: object],
	error: [error: Error],
	friendRequestCreate: [friendRequest: FriendRequest],
	giftMessageCreate: [message: GiftMessage],
	messageCreate: [message: Message, isAuthorBlocked: boolean],
	messageDelete: [message: Message],
	messageReactionAdd: [message: Message?],
	messageUpdate: [oldMessage: Message, newMessage: Message],
	notificationCreate: [],
	ping: [ping: number],
	raw: [data: object],
	rawNotification: [data: object],
	rawPrivate: [data: object],
	ready: [],
	userBlocked: [user: User],
	warn: [data: object]
}

export interface ClientOptions {
	debug?: boolean,
	maxReconnectAttempts?: number
}

export enum ActivityTypes {
	AWAY = 'AWAY',
	IDLE = 'IDLE',
	INVISIBLE = 'INVISIBLE',
	OFFLINE = 'OFFLINE',
	ONLINE = 'ONLINE'
}

export enum ArtifactTypes {
	ROSE = 'rose',
	TEDDY = 'teddy',
	HEART = 'heart',
	DIAMOND = 'diamond',
	TEN_DIAMONDS = 'diamond10'
}

export enum Categories {
	Adult = 'adult',
	Auto = 'auto',
	Books = 'books',
	Cooking = 'cooking',
	Depression = 'depression',
	Family = 'family',
	Fashion = 'vogue'
}

export enum ChannelFlags {
	REMOVED = 1,
	SHOW_SAFE_CONTENT_ONLY = 2,
	TEEN = 4,
	HIGHLIGHT = 8,
	PUSH_ALLOWED = 16,
	PUSH_DEFAULT_ENABLED = 32,
	ANTIFLOOD_DISABLED = 64,
	WRITES_DISABLED = 128,
	VIDEOS_DISABLED = 256,
	PHOTOS_DISABLED = 512,
	SPAM_REPORT = 1024,
	UNFILTER = 2048,
	SUPPORT_CHAT = 4096,
	MOD_CHAT = 8192,
	OWN_MSG_REMOVE_ENABLED = 16384
}

export enum ChannelTypes {
	CHANNEL = 'CHANNEL', // readonly
	GROUP = 'GROUP',
	PRIVATE = 'PRIVATE',
	PUBLIC = 'PUBLIC'
}

export enum ChatFilters {
	DENY_ANY_OTHER_LINKS = 'DENY_ANY_OTHER_LINKS',
	DENY_PHOTO = 'DENY_PHOTO',
	DENY_SEX_TEXT_CONTENT = 'DENY_SEX_TEXT_CONTENT',
	DENY_STICKERS = 'DENY_STICKERS',
	DENY_SWEARING_TEXT_CONTENT = 'DENY_SWEARING_TEXT_CONTENT',
	DENY_TEXT = 'DENY_TEXT',
	DENY_VIDEO = 'DENY_VIDEO',
	DENY_YOUTUBE_LINKS = 'DENY_YOUTUBE_LINKS'
}

export enum ChatMoods {
	CHAT_MOOD_1 = 'cm1',
	CHAT_MOOD_2 = 'cm2',
	CHAT_MOOD_3 = 'cm3'
}

export enum ChatSetupFlags {
	ALLOW_MESSAGE_DELETE = 'OWN_MSG_REMOVE_ALLOWED',
	DENY_BON_REMOVE = 'BON_REMOVE_DISABLED'
}

export enum ChatSetupFlags {
	KARMA = 'karma',
	TOKENS = 'tokens'
}

export enum Events {
	Blocked = 'blocked',
	ChannelBanAdd = 'channelBanAdd',
	ChannelBanRemove = 'channelBanRemove',
	ChannelCreate = 'channelCreate',
	ChannelDelete = 'channelDelete',
	ChannelMemberAdd = 'channelMemberAdd',
	// ChannelMemberRemove = 'channelMemberRemove',
	ChannelUpdate = 'channelUpdate',
	ClientReady = 'ready',
	Debug = 'debug',
	Error = 'error',
	FriendRequestCreate = 'friendRequestCreate',
	// FriendRequestDelete = 'friendRequestDelete',
	GiftMessageCreate = 'giftMessageCreate',
	MessageCreate = 'messageCreate',
	MessageDelete = 'messageDelete',
	MessageReactionAdd = 'messageReactionAdd',
	MessageUpdate = 'messageUpdate',
	Ping = 'ping',
	Raw = 'raw',
	Unblocked = 'unblocked',
	UserBlocked = 'userBlocked',
	UserUnblocked = 'userUnblocked',
	Warn = 'warn'
}

export enum MessageTypes {
	ALIPAY = 'ALIPAY',
	BLOCKED_BY = 'BLOCKED_BY',
	BLOCKED_WHOM = 'BLOCKED_WHOM',
	CHANNEL_BAN_CREATE = 'CHANNEL_BAN_CREATE',
	CHANNEL_MEMBER_ADD = 'JOIN_NOTIFICATION',
	EMAIL_VERIFIED = 'EMAIL_VERIFIED',
	FRIEND_REQUEST_CREATE = 'MATE.EVENT.REQUEST',
	GIFT_MESSAGE = 'GIFT',
	JOIN = 'DIALOGUE.MEMBERS.JOINED', // 'JOIN_NOTIFICATION',
	KARMA_TASK_PROGRESS = 'KARMATASK.EVENT.PROGRESS',
	MESSAGE = 'MESSAGE',
	MESSAGE_DELETE = 'MESSAGE_DELETE',
	MESSAGE_LIKE = 'MESSAGE_LIKE',
	MESSAGE_UPDATE = 'MESSAGE_UPDATE',
	PRIVATE_MESSAGE = 'PRIVATE_MESSAGE',
	PRIVATE_NOTIFICATION = 'PRIVATE_NOTIFICATION',
	SYSTEM_MESSAGE = 'SYSTEM_MESSAGE',
	UNBLOCKED_BY = 'UNBLOCKED_BY',
	UNBLOCKED_WHOM = 'UNBLOCKED_WHOM',
	USER_BLOCKED = 'USER_BLOCKED'
}

//#endregion