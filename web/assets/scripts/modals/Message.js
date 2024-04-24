// import DOMHelper from "../DOMHelper.js";
import QuickActionMenu from "../QuickActionMenu.js";
import User from "./User.js";

export default class MessageWrapper extends HTMLElement {
	attachments = [];
	author = null;
	avatar = null;
	container = null;
	content = null;
	contentContainer = null;
	media = null;
	reference = null;
	timestamp = null;
	constructor(message) {
		super();
		this.dataset.id = message.id;
		this.dataset.sid = message.author.id;
		// this.addEventListener('mouseenter', event => {
		// 	QuickActionMenu.create([{
		// 		name: '❤️'
		// 	}, {
		// 		name: '␡',
		// 		styles: ['danger']
		// 	}], this);
		// });
		Object.defineProperty(this, 'message', { value: message });
	}

	addAttachment({ url, type }) {
		if (this.attachments.find(media => media.src === url)) return;
		let media = this.contentContainer.appendChild(document.createElement(type !== 'video' ? 'img' : 'video'));
		media.classList.add('attachment');
		media.dataset.type = type;
		media.src = url;
		media.addEventListener('load', event => this.dispatchEvent(new Event(event)), { once: true });
		this.attachments.push(media);
		return media;
	}

	setAuthor(author = null) {
		if (this.avatar !== null) return;
		this.avatar = User.createAvatarContainer(this.message.author);
		this.container.prepend(this.avatar);
		let metadataContainer = document.createElement('div');
		metadataContainer.classList.add('metadata');
		this.author = metadataContainer.appendChild(document.createElement('span'));
		this.author.classList.add('author');
		this.author.innerText = this.message.author.displayName;
		this.author.after(this.timestamp);
		return this.contentContainer.prepend(metadataContainer);
	}

	setReference(message = null) {
		if (this.reference !== null) return;
		this.reference = this.appendChild(document.createElement('div'));
		this.reference.classList.add('reference-content');
		this.reference.dataset.id = this.message.referenceId;
		message !== null && message.content !== null && (this.reference.innerText = message.content) || (this.reference.dataset.partial = true,
		this.reference.innerHTML = "<i>Click to load message</i>");
		this.reference.addEventListener('click', async () => {
			if (this.reference.dataset.partial) {
				delete this.reference.dataset.partial;
				let referenceMessage = await this.message.dialogue.messages.fetch(this.reference.dataset.id, { force: true });
				referenceMessage && (this.reference.innerText = referenceMessage.content) || (this.reference.innerHTML = "<i>Failed to load message</i>");
			}
			let element = document.querySelector('message-wrapper[data-id="' + this.reference.dataset.id + '"]');
			if (!element) return;
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
		return this.prepend(this.reference);
	}

	static create(message) {
		let msg = new this(message);
		message.referenceId !== null && msg.setReference(message.reference);
		let messageContainer = msg.appendChild(document.createElement('span'));
		messageContainer.classList.add('message-container');
		msg.container = messageContainer;
		let timestamp = messageContainer.appendChild(document.createElement('span'));
		let contentContainer = messageContainer.appendChild(document.createElement('div'));
		contentContainer.classList.add('content-container');
		msg.contentContainer = contentContainer;
		timestamp.classList.add('timestamp');
		timestamp.setAttribute('title', message.createdAt.toLocaleString([], {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			hour12: false,
			minute: '2-digit'
		}));
		timestamp.innerText = message.createdAt.toLocaleTimeString([], {
			hour: '2-digit',
			hour12: false,
			minute: '2-digit'
		});
		msg.timestamp = timestamp;
		let content = contentContainer.appendChild(document.createElement('span'));
		content.classList.add('content');
		content.innerText = message.content;
		msg.content = content;
		message.media && msg.addAttachment(message.media);
		message.sticker && msg.addAttachment(message.sticker);
		message.referenceId !== null && msg.setAuthor();
		return msg;
	}

	static createContextMenuOptions(message, { client }) {
		const options = [{
			disabled: message.id === dialogueReplyContainer.dataset.mid,
			name: 'Reply',
			click() {
				dialogueReplyAuthor.innerText = message.author.displayName;
				dialogueReplyContainer.dataset.mid = message.id;
				dialogueReplyContainer.style.removeProperty('display');
			}
		}, {
			name: 'Copy Text',
			click: () => navigator.clipboard.writeText(message.content)
		}, {
			name: 'Share', // v2:chat.message.share
			click() {

			}
		}, {
			disabled: null !== element.querySelector('.translation'),
			name: 'Translate',
			click: () => message.translate().then(translation => {
				let trans = element.appendChild(document.createElement('span'));
				trans.classList.add('translation');
				trans.innerText = translation;
			})
		}];
		let canDelete = (dialogue.flags.has(ChannelFlagsBitField.Flags.OWN_MSG_REMOVE_ENABLED) || (dialogue.options && dialogue.options.setup && dialogue.options.setup.has(ChatSetupFlags.ALLOW_MESSAGE_DELETE))) && message.author.id === client.user.id;
		// add user submenu?
		// isModerator && options.push({
		// 	name: 'Ban',
		// 	styles: ['danger'],
		// 	click: () => dialogue.members.ban(message.author.id).then(info => {
		// 		console.log(info)
		// 	})
		// }, {
		// 	name: 'Perma-Ban',
		// 	styles: ['danger'],
		// 	click: () => dialogue.members.ban(message.author.id).then(info => {
		// 		console.log(info)
		// 	})
		// });
		(isModerator || canDelete) && options.push({
			name: 'Delete',
			styles: ['danger'],
			click: () => dialogue.messages.delete(message.id).then(res => {
				res && element.remove();
			})
		});
		options.push({
			name: 'Report',
			styles: ['danger'],
			click: () => {}
		});
		options.length > 0 && options.push({ type: 'hr' });
		options.push({
			name: 'Copy Message ID',
			click: () => navigator.clipboard.writeText(message.id)
		});
	}
}

customElements.define('message-wrapper', MessageWrapper);