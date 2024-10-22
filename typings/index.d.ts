import EventEmitter from "events";

import { ActivityType, ArtifactType, ChannelFlags, Category, ChannelType, ChatFilter, ChatMood, ChatSetupFlags, Events, MessageType } from "../src";
import CallManager from "../src/managers/CallManager";
import DialogueManager from "../src/managers/DialogueManager";
import GroupManager from "../src/managers/GroupManager";
import StickerManager from "../src/managers/StickerManager";
import UserManager from "../src/managers/UserManager";

import ClientUser from "../src/structures/ClientUser";
import Dialogue from "../src/structures/Dialogue";
import FriendRequest from "../src/structures/FriendRequest";
import GiftMessage from "../src/structures/GiftMessage";
import Message from "../src/structures/Message";
import User from "../src/structures/User";
import Member from "../src/structures/Member.js";

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
	blockAdd: [blocker: User],
	blockRemove: [blocker: User],
	channelBanAdd: [dialogue: Dialogue],
	// channelBanExpire: [dialogue: Dialogue],
	channelBanRemove: [dialogue: Dialogue],
	channelCreate: [dialogue: Dialogue],
	channelDelete: [dialogue: Dialogue],
	channelMemberAdd: [member: Member],
	channelUpdate: [oldDialogue: Dialogue, newDialogue: Dialogue],
	contactBlockAdd: [user: User],
	contactBlockRemove: [user: User],
	debug: [data: object],
	error: [error: Error],
	friendRequestCreate: [friendRequest: FriendRequest],
	// friendRequestDelete: [user: User],
	giftMessageCreate: [message: GiftMessage],
	karmaTaskCreate: [task: object],
	karmaTaskUpdate: [task: object],
	messageCreate: [message: Message, isAuthorBlocked: boolean],
	messageDelete: [message: Message],
	messageReactionAdd: [message: Message?],
	messageReportAdd: [message: Message],
	messageUpdate: [oldMessage: Message, newMessage: Message],
	notificationCreate: [data: object],
	raw: [data: object],
	ready: [],
	warn: [data: object]
}

export interface ClientOptions {
	debug?: boolean,
	fallback?: boolean,
	maxReconnectAttempts?: number,
	pubnub?: boolean,
	subscribe: boolean
}

export enum ActivityType {
	AWAY = 'AWAY',
	IDLE = 'IDLE',
	INVISIBLE = 'INVISIBLE',
	OFFLINE = 'OFFLINE',
	ONLINE = 'ONLINE'
}

export enum ArtifactType {
	ROSE = 'rose',
	TEDDY = 'teddy',
	HEART = 'heart',
	DIAMOND = 'diamond',
	TEN_DIAMONDS = 'diamond10'
}

export enum Category {
	Adult = 'adult',
	Auto = 'auto',
	Books = 'books',
	Cooking = 'cooking',
	Depression = 'depression',
	Family = 'family',
	Fashion = 'vogue',
	Flirt = 'flirt',
	Friendship = 'friendship',
	Health = 'health',
	Home = 'home',
	Humor = 'humor',
	Lifestyle = 'lifestyle',
	Love = 'love',
	Movies = 'movies',
	Photo = 'photo',
	Psychology = 'psychology',
	Rude = 'rude',
	Science = 'science',
	Sports = 'sports',
	Travel = 'travel'
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

export enum ChannelType {
	CHANNEL = 'CHANNEL', // readonly
	GROUP = 'GROUP',
	PRIVATE = 'PRIVATE',
	PUBLIC = 'PUBLIC'
}

export enum ChatFilter {
	DENY_ANY_OTHER_LINKS = 'DENY_ANY_OTHER_LINKS',
	DENY_PHOTO = 'DENY_PHOTO',
	DENY_SEX_TEXT_CONTENT = 'DENY_SEX_TEXT_CONTENT',
	DENY_STICKERS = 'DENY_STICKERS',
	DENY_SWEARING_TEXT_CONTENT = 'DENY_SWEARING_TEXT_CONTENT',
	DENY_TEXT = 'DENY_TEXT',
	DENY_VIDEO = 'DENY_VIDEO',
	DENY_YOUTUBE_LINKS = 'DENY_YOUTUBE_LINKS'
}

export enum ChatMood {
	CHAT_MOOD_1 = 'cm1',
	CHAT_MOOD_2 = 'cm2',
	CHAT_MOOD_3 = 'cm3'
}

export enum ChatSetupFlags {
	ALLOW_MESSAGE_DELETE = 'OWN_MSG_REMOVE_ALLOWED',
	DENY_BON_REMOVE = 'BON_REMOVE_DISABLED'
}

export enum CurrencyType {
	KARMA = 'karma',
	TOKENS = 'tokens'
}

export enum Events {
	ChannelBanAdd = 'channelBanAdd',
	// ChannelBanExpire = 'channelBanExpire',
	ChannelBanRemove = 'channelBanRemove',
	ChannelCreate = 'channelCreate',
	ChannelDelete = 'channelDelete',
	ChannelMemberAdd = 'channelMemberAdd',
	// ChannelMemberRemove = 'channelMemberRemove',
	ChannelUpdate = 'channelUpdate',
	ClientBlockAdd = 'blockAdd',
	ClientBlockRemove = 'blockRemove',
	// ClientGiftAdd = 'giftAdd',
	ClientReady = 'ready',
	ContactBlockAdd = 'contactBlockAdd',
	ContactBlockRemove = 'contactBlockRemove',
	Debug = 'debug',
	Error = 'error',
	FriendRequestCreate = 'friendRequestCreate',
	// FriendRequestDelete = 'friendRequestDelete',
	GiftMessageCreate = 'giftMessageCreate',
	KarmaTaskCreate = 'karmaTaskCreate',
	KarmaTaskUpdate = 'karmaTaskUpdate',
	MessageCreate = 'messageCreate',
	MessageDelete = 'messageDelete',
	MessageReactionAdd = 'messageReactionAdd',
	MessageReportAdd = 'messageReportAdd',
	MessageUpdate = 'messageUpdate',
	NotificationCreate = 'notificationCreate',
	Ping = 'ping',
	Raw = 'raw',
	RelationshipCreate = 'relationshipCreate',
	RelationshipDelete = 'relationshipDelete',
	RelationshipUpdate = 'relationshipUpdate',
	Warn = 'warn'
}

export enum MessageType {
	ALIPAY = 'alipay',
	BLOCKED_BY = 'blocked',
	BLOCKED_WHOM = 'blocked',
	CHANNEL_BAN_CREATE = 'deleteChat',
	CHANNEL_MEMBER_ADD = 'join_notification',
	EMAIL_VERIFIED = 'email_verified',
	FRIEND_REQUEST_CREATE = 'mate.event.request',
	GIFT_MESSAGE = 'giftname',
	JOIN = 'dialogue.members.joined',
	KARMA_TASK_PROGRESS = 'karmatask.event.progress',
	MESSAGE = 'message',
	MESSAGE_DELETE = 'update',
	MESSAGE_LIKE = 'message_like',
	MESSAGE_REPORT = 'message.event.reported',
	MESSAGE_UPDATE = 'update',
	PRIVATE_MESSAGE = 'private_message',
	PRIVATE_NOTIFICATION = 'private_notification',
	STICKER = 'sticker',
	SYSTEM_MESSAGE = 'giftname?',
	UNBLOCKED_BY = 'blocked',
	UNBLOCKED_WHOM = 'blocked'
}

//#endregion