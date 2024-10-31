/**
 * @typedef {object} Events
 * @property {string} ChannelBanAdd channelBanAdd
 * @property {string} ChannelBanRemove channelBanRemove
 * @property {string} ChannelCreate channelCreate
 * @property {string} ChannelDelete channelDelete
 * @property {string} ChannelMemberAdd channelMemberAdd
 * @property {string} ChannelUpdate channelUpdate
 * @property {string} ClientBlockAdd clientBlockAdd
 * @property {string} ClientBlockRemove clientBlockRemove
 * @property {string} ClientReady ready
 * @property {string} ContactBlockAdd contactBlockAdd
 * @property {string} ContactBlockRemove contactBlockRemove
 * @property {string} Debug debug
 * @property {string} Error error
 * @property {string} FriendRequestCreate friendRequestCreate
 * @property {string} GiftMessageCreate giftMessageCreate
 * @property {string} KarmaTaskCreate karmaTaskCreate
 * @property {string} KarmaTaskUpdate karmaTaskUpdate
 * @property {string} MessageCreate messageCreate
 * @property {string} MessageDelete messageDelete
 * @property {string} MessageReactionAdd messageReactionAdd
 * @property {string} MessageReportAdd message.event.reported
 * @property {string} MessageUpdate messageUpdate
 * @property {string} Notification notification
 * @property {string} Raw raw
 * @property {string} RelationshipCreate relationshipCreate
 * @property {string} RelationshipDelete relationshipDelete
 * @property {string} RelationshipUpdate relationshipUpdate
 * @property {string} SystemMessageCreate systemMessageCreate
 * @property {string} Warn warn
 */

/**
 * @type {Events}
 * @ignore
 */
export default {
	ChannelBanAdd: 'channelBanAdd',
	// ChannelBanExpire: 'channelBanExpire',
	ChannelBanRemove: 'channelBanRemove',
	ChannelCreate: 'channelCreate',
	ChannelDelete: 'channelDelete',
	ChannelMemberAdd: 'channelMemberAdd',
	// ChannelMemberRemove: 'channelMemberRemove',
	ChannelUpdate: 'channelUpdate',
	ClientBlockAdd: 'blockAdd',
	ClientBlockRemove: 'blockRemove',
	// ClientGiftAdd: 'giftAdd',
	ClientReady: 'ready',
	ContactBlockAdd: 'contactBlockAdd',
	ContactBlockRemove: 'contactBlockRemove',
	Debug: 'debug',
	Error: 'error',
	FriendRequestCreate: 'friendRequestCreate',
	// FriendRequestDelete: 'friendRequestDelete',
	GiftMessageCreate: 'giftMessageCreate',
	KarmaTaskCreate: 'karmaTaskCreate',
	KarmaTaskUpdate: 'karmaTaskUpdate',
	MessageCreate: 'messageCreate',
	MessageDelete: 'messageDelete',
	MessageReactionAdd: 'messageReactionAdd',
	MessageReportAdd: 'messageReportAdd',
	MessageUpdate: 'messageUpdate',
	NotificationCreate: 'notificationCreate',
	Raw: 'raw',
	RelationshipCreate: 'relationshipCreate', // contact add
	RelationshipDelete: 'relationshipDelete', // contact remove
	RelationshipUpdate: 'relationshipUpdate', // block?
	SystemMessageCreate: 'systemMessageCreate',
	Warn: 'warn'
}