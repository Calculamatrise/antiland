/**
 * @typedef {object} MessageType
 * @property {string} ALIPAY alipay
 * @property {string} BLOCKED_BY blocked
 * @property {string} BLOCKED_WHOM blocked
 * @property {string} CHANNEL_BAN_CREATE deleteChat
 * @property {string} CHANNEL_MEMBER_ADD dialogue.members.joined
 * @property {string} EMAIL_VERIFIED email_verified
 * @property {string} FRIEND_REQUEST_CREATE mate.event.request
 * @property {string} GIFT_MESSAGE giftname
 * @property {string} KARMA_TASK_PROGRESS karmatask.event.progress
 * @property {string} MESSAGE message
 * @property {string} MESSAGE_DELETE update
 * @property {string} MESSAGE_LIKE message_like
 * @property {string} MESSAGE_UPDATE update
 * @property {string} PRIVATE_MESSAGE text
 * @property {string} PRIVATE_NOTIFICATION private_notification
 * @property {string} PRIVATE_SCREENSHOT dialogue.presence.screenshot
 * @property {string} SYSTEM_MESSAGE giftname?
 * @property {string} UNBLOCKED_BY blocked
 * @property {string} UNBLOCKED_WHOM blocked
 */

/**
 * @type {MessageType}
 * @ignore
 */
export default {
	ALIPAY: 'ALIPAY',
	BLOCKED_BY: 'BLOCKED_BY',
	BLOCKED_WHOM: 'BLOCKED_WHOM',
	CHANNEL_BAN_CREATE: 'DELETE_CHAT',
	CHANNEL_MEMBER_ADD: 'DIALOGUE.MEMBERS.JOINED',
	EMAIL_VERIFIED: 'EMAIL_VERIFIED',
	FRIEND_REQUEST_CREATE: 'MATE.EVENT.REQUEST',
	GIFT_MESSAGE: 'GIFT',
	KARMA_TASK_PROGRESS: 'KARMATASK.EVENT.PROGRESS',
	MESSAGE: 'MESSAGE',
	MESSAGE_DELETE: 'MESSAGE_DELETE',
	MESSAGE_LIKE: 'MESSAGE_LIKE',
	MESSAGE_UPDATE: 'MESSAGE_UPDATE',
	PRIVATE_MESSAGE: 'TEXT',
	PRIVATE_NOTIFICATION: 'PRIVATE_NOTIFICATION',
	PRIVATE_SCREENSHOT: 'DIALOGUE.PRESENCE.SCREENSHOT',
	SYSTEM_MESSAGE: 'SYSTEM_MESSAGE',
	UNBLOCKED_BY: 'UNBLOCKED_BY',
	UNBLOCKED_WHOM: 'UNBLOCKED_WHOM'
}