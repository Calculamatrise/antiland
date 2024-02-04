import EventEmitter from "events";

import { ActivityTypes, ArtifactTypes, Categories, ChatFilters, ChatFlags, ChatMoods, ChatSetupFlags, Events, MessageTypes } from "../src";
import CallManager from "../src/managers/CallManager";
import DialogueManager from "../src/managers/DialogueManager";
import GroupManager from "../src/managers/GroupManager";
import StickerManager from "../src/managers/StickerManager";
import UserManager from "../src/managers/UserManager";

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
	public users: UserManager;
	public constructor(options?: ClientOptions);
	public closeChannel(channelId: string): undefined;
	public destroy(): this;
	public editMessage(messageId: string, content: string): Promise<Message?>;
	public likeMessage(messageId: string): Promise<Message?>;
	public openChannel(channelId: string): undefined;
	public sendAnySticker(dialogueId: string, stickerId: string, options: { reference: string | { id: string } }): Promise<object>;
	public sendMedia(dialogueId: string, mediaURL: string, options: { reference: string | { id: string } }): Promise<object>;
	public sendMessage(dialogueId: string, imageURL: string, options: { reference: string | { id: string } }): Promise<object>;
	public sendSticker(dialogueId: string, stickerId: string, options: { reference: string | { id: string } }): Promise<object>;
	public unsendMessage(messageId: string): Promise<boolean>;
	public login(asr: string | { username: string, password: string }): this;
	public reconnect(): this;
	public get user(): User;

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

export enum Events {
	BanCreate = 'banCreate',
	Blocked = 'blocked',
	ChannelCreate = 'channelCreate',
	ChannelDelete = 'channelDelete',
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
	NotificationCreate = 'notificationCreate',
	Ping = 'ping',
	Raw = 'raw',
	RawNotification = 'rawNotification',
	RawPrivate = 'rawPrivate',
	UserBlocked = 'userBlocked',
	Warn = 'warn'
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

export enum ChannelTypes {
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

export enum ChatFlags {
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

export enum ChatMoods {
	CHAT_MOOD_1 = 'cm1',
	CHAT_MOOD_2 = 'cm2',
	CHAT_MOOD_3 = 'cm3'
}

export enum ChatSetupFlags {
	ALLOW_MESSAGE_DELETE = 'OWN_MSG_REMOVE_ALLOWED'
}

export enum ChatSetupFlags {
	KARMA = 'karma',
	TOKENS = 'tokens'
}

export enum MessageTypes {
	MESSAGE = void 0,
	MESSAGE_UPDATE = 2,
	LIKE = 3,
	JOIN = 4,
	PRIVATE = 5,
	BLOCKED_WHOM = 6,
	BLOCKED_BY = 7,
	ALIPAY = 9,
	EMAIL_VERIFIED = 10
}

//#endregion