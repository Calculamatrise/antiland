/**
 * @typedef {object} Events
 * @property {string} Blocked blocked
 * @property {string} ChannelBanAdd channelBanAdd
 * @property {string} ChannelBanRemove channelBanRemove
 * @property {string} ChannelCreate channelCreate
 * @property {string} ChannelDelete channelDelete
 * @property {string} ChannelMemberAdd channelMemberAdd
 * @property {string} ChannelUpdate channelUpdate
 * @property {string} ClientReady ready
 * @property {string} Debug debug
 * @property {string} Error error
 * @property {string} GiftMessageCreate giftMessageCreate
 * @property {string} MessageCreate messageCreate
 * @property {string} MessageDelete messageDelete
 * @property {string} MessageReactionAdd messageReactionAdd
 * @property {string} MessageReportAdd message.event.reported
 * @property {string} MessageUpdate messageUpdate
 * @property {string} Notification notification
 * @property {string} Ping ping
 * @property {string} Raw raw
 * @property {string} Unblocked unblocked
 * @property {string} UserBlocked userBlocked
 * @property {string} UserUnblocked userUnblocked
 * @property {string} Warn warn
 */

/**
 * @type {Events}
 * @ignore
 */
export default {
	Blocked: 'blocked',
	ChannelBanAdd: 'channelBanAdd',
	ChannelBanRemove: 'channelBanRemove',
	ChannelCreate: 'channelCreate',
	ChannelDelete: 'channelDelete',
	ChannelMemberAdd: 'channelMemberAdd',
	// ChannelMemberRemove: 'channelMemberRemove',
	ChannelUpdate: 'channelUpdate',
	ClientReady: 'ready',
	Debug: 'debug',
	Error: 'error',
	FriendRequestCreate: 'friendRequestCreate',
	// FriendRequestDelete: 'friendRequestDelete',
	GiftMessageCreate: 'giftMessageCreate',
	MessageCreate: 'messageCreate',
	MessageDelete: 'messageDelete',
	MessageReactionAdd: 'messageReactionAdd',
	MessageReportAdd: 'messageReportAdd',
	MessageUpdate: 'messageUpdate',
	Notification: 'notification',
	Ping: 'ping',
	Raw: 'raw',
	Unblocked: 'unblocked',
	UserBlocked: 'userBlocked',
	UserUnblocked: 'userUnblocked',
	Warn: 'warn'
}