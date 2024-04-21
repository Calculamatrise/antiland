// import DOMHelper from "../DOMHelper.js";
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
		Object.defineProperty(this, 'message', { value: message });
	}

	addAttachment({ url, type }) {
		if (this.attachments.find(media => media.src === url)) return;
		let media = this.contentContainer.appendChild(document.createElement(type !== 'video' ? 'img' : 'video'));
		media.classList.add('attachment');
		media.src = url;
		media.addEventListener('load', event => this.dispatchEvent(new Event(event)), { once: true });
		this.attachments.push(media);
		return media;
	}

	addAuthor() {
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

	addReference(message = null) {
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
		message.referenceId !== null && msg.addReference(message.reference);
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
		message.referenceId !== null && msg.addAuthor();
		return msg;
	}
}

customElements.define('message-wrapper', MessageWrapper);