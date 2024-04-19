import Application from "./assets/scripts/Application.js";
import ContextMenuBuilder from "./assets/scripts/ContextMenuBuilder.js";

Application.applyColorScheme();
window.Application = new Application();

// Remember which channel was selected in localStorage?
// Or which nav button was selected
// Add setting to remember?

/**
 * @todo add option to filter DMs from certain sex or age groups
 */

import Client from "./assets/scripts/antiland/client/Client.js";
import ChannelFlagsBitField from "../src/utils/ChannelFlagsBitField.js";
import ChannelType from "../src/utils/ChannelType.js";
import ChatSetupFlags from "../src/utils/ChatSetupFlags.js";
import MessageType from "../src/utils/MessageType.js";

let activeDialogue = null;

const client = new Client({ debug: true, fallback: true, maxReconnectAttempts: 6 });
const authContainer = document.querySelector('.auth-container');
const chatsContainer = document.querySelector('.left-panel .chats');
for (const radio of document.querySelectorAll('input[type="radio"][name="chats"]')) {
	radio.addEventListener('change', event => {
		let allowed = event.target.id.toUpperCase().replace(/s$/i, '');
		for (const chat of chatsContainer.children) {
			chat.style[(allowed == 'ALL' || allowed === chat.dataset.type) ? 'removeProperty' : 'setProperty']('display', 'none');
		}
	});
}

const dialogueView = document.querySelector('#dialogue');
const dialogueMetadata = dialogueView.querySelector('.metadata');
const dialogueReplyContainer = dialogueView.querySelector('.reply-container');
const dialogueReplyAuthor = dialogueReplyContainer.querySelector('.author');
const dialogueReplyCancel = dialogueReplyContainer.querySelector('button');
dialogueReplyContainer.addEventListener('click', () => {
	let element = document.querySelector('.message[data-id="' + dialogueReplyContainer.dataset.mid + '"]');
	if (!element) return;
	element.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
dialogueReplyCancel.addEventListener('click', () => {
	delete dialogueReplyContainer.dataset.mid;
	dialogueReplyContainer.style.setProperty('display', 'none');
});

const dialogueText = dialogueView.querySelector('#text');
const messageContainer = document.querySelector('#messages');
function addChatButton(dialogue) {
	let chat = chatsContainer.querySelector('label[data-id="' + dialogue.id + '"]');
	let name = chat && chat.querySelector('span');
	let radio = chat && chat.querySelector('input[type="radio"]');
	if (!chat) {
		chat = chatsContainer.appendChild(document.createElement('label'));
		chat.classList.add('dialogue');
		chat.dataset.id = dialogue.id;
		chat.dataset.type = dialogue.type;
		radio = chat.appendChild(document.createElement('input'));
		radio.setAttribute('type', 'radio');
		radio.setAttribute('name', 'dialogue');
		radio.style.setProperty('display', 'none');
		radio.addEventListener('change', event => {
			activeDialogue = dialogue;
			openDialogue(dialogue.id);
		});
		name = chat.appendChild(document.createElement('span'));
	}
	name.innerText = dialogue.name;
	return { chat, name, radio };
}

let cache = getCache();
let openDialogueId = Application.searchParams.get('g');
if (Array.isArray(cache.dialogues)) {
	for (let dialogue of cache.dialogues) {
		let { radio } = addChatButton(dialogue);
		if (dialogue.id === openDialogueId) {
			showDialogue({ dialogueId: dialogue.id, name: dialogue.name });
			radio.checked = true;
		}
	}
}

const avatar = document.querySelector('#client-avatar');
const username = document.querySelector('#client-username');
client.on('ready', async () => {
	localStorage.setItem('al_session', client.token);
	if (Application.searchParams.has('g')) {
		let dialogueId = Application.searchParams.get('g');
		let dialogue = await client.dialogues.fetch(dialogueId);
		showDialogue({ dialogueId: dialogue.id, name: dialogue.name });
	}

	let dialogues = await client.dialogues.fetchActive({ force: true });
	for (let dialogue of dialogues.values()) {
		addChatButton(dialogue);
	}

	updateCache({
		dialogues: Array.from(dialogues.values()).map(({ id, name, type }) => ({ id, name, type }))
	});
	avatar.src = client.user.avatarURL();
	username.innerText = client.user.displayName;
	authContainer.close('success');
});

client.on('messageCreate', async message => createMessage(message));
authContainer.addEventListener('close', async event => {
	switch(event.target.returnValue) {
	case 'cancel':
		return;
	case 'success':
		uname.value = null;
		pwd.value = null;
		return;
	}
});

const login = authContainer.querySelector('#login');
login.addEventListener('click', async event => {
	if (event.target.classList.contains('loading')) return;
	event.target.classList.add('loading');
	await attemptLogin({
		username: uname.value,
		password: pwd.value
	});
	event.target.classList.remove('loading');
});

// check if user token is saved first, if yes then login
const token = localStorage.getItem('al_session');
if (token !== null) {
	attemptLogin(token).catch(err => {
		localStorage.removeItem('al_session');
	});
} else {
	authContainer.showModal();
}

function attemptLogin(payload) {
	return client.login(payload).catch(err => {
		console.log(err)
		const errmsg = errorContainer.querySelector('#errmsg');
		errmsg.innerText = err.message;
		errorContainer.addEventListener('close', () => {
			authContainer.showModal();
		}, { once: true });
		errorContainer.showModal();
		throw err;
	});
}

function openDialogue(dialogueId) {
	let dialogue = client.dialogues.cache.get(dialogueId);
	if (!dialogue) {
		showError("Failed to find dialogue.");
		return;
	}
	history.pushState({ dialogueId, name: dialogue.name }, null, '/web/?g=' + dialogueId);
	// dialogueText.setAttribute('placeholder', 'Message ' + dialogue.name);
}

function showDialogue(data) {
	const { dialogueId, name } = data || history.state;
	if (!dialogueId) return;
	dialogueMetadata.dataset.id = dialogueId;
	for (let container of messageContainer.children) {
		if (container.dataset.id === dialogueId) continue;
		container.style.setProperty('display', 'none');
	}
	let container = getMessageContainer(dialogueId, { createIfNotExists: true });
	container.style.removeProperty('display');
	dialogueMetadata.innerText = name;
	dialogueText.setAttribute('placeholder', 'Message ' + name);
	client.dialogues.fetch(dialogueId).then(async dialogue => {
		activeDialogue = dialogue;
		let lastMessageTimestamp = container.lastElementChild && new Date(container.lastElementChild.querySelector('.timestamp').getAttribute('title').replace(/\s+at\s+/, ' '));
		let messageHistory = await dialogue.messages.fetch({ force: true, since: lastMessageTimestamp }); // cache that it has been fetched
		for (let message of messageHistory.values()) {
			createMessage(message, true);
		}
	});
}

function getMessageContainer(dialogueId, { createIfNotExists } = {}) {
	let container = messageContainer.querySelector('div.dialogue-chats[data-id="' + dialogueId + '"]');
	if (container === null && createIfNotExists) {
		container = messageContainer.appendChild(document.createElement('div'));
		container.classList.add('dialogue-chats');
		container.dataset.id = dialogueId;
		container.style.setProperty('display', 'none');
	}
	return container;
}

function createMessage(message, scrollToBottom) {
	if (message.type === MessageType.GIFT_MESSAGE) message.author = message.sender;
	let subContainer = getMessageContainer(message.dialogueId, { createIfNotExists: true });
	if (null !== subContainer.querySelector('.message[data-id="' + message.id + '"]')) return;
	let autoScroll = messageContainer.scrollHeight - messageContainer.scrollTop <= messageContainer.offsetHeight;
	let lastMessageSid = subContainer.lastElementChild && subContainer.lastElementChild.dataset.sid;
	let msg = subContainer.appendChild(document.createElement('div'));
	msg.classList.add('message');
	msg.dataset.id = message.id;
	msg.dataset.sid = message.author.id;
	if (message.referenceId !== null) {
		let referenceContent = msg.appendChild(document.createElement('div'));
		referenceContent.classList.add('reference-content');
		referenceContent.dataset.id = message.referenceId;
		message.reference.content !== null && (referenceContent.innerText = message.reference.content) || (referenceContent.dataset.partial = true,
		referenceContent.innerHTML = "<i>Click to load message</i>");
		referenceContent.addEventListener('click', async () => {
			if (referenceContent.dataset.partial) {
				delete referenceContent.dataset.partial;
				let referenceMessage = await message.dialogue.messages.fetch(referenceContent.dataset.id, { force: true });
				referenceMessage && (referenceContent.innerText = referenceMessage.content) || (referenceContent.innerHTML = "<i>Failed to load message</i>");
			}
			let element = document.querySelector('.message[data-id="' + referenceContent.dataset.id + '"]');
			if (!element) return;
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	}

	let messageWrapper = msg.appendChild(document.createElement('span'));
	messageWrapper.classList.add('message-wrapper');
	let moveTimestamp = lastMessageSid === message.author.id && message.referenceId === null;
	let timestamp = moveTimestamp && messageWrapper.appendChild(document.createElement('span'));
	if (!moveTimestamp) {
		let avatar = messageWrapper.appendChild(document.createElement('img'));
		avatar.classList.add('avatar');
		avatar.src = message.author.avatarURL();
	}

	let contentContainer = messageWrapper.appendChild(document.createElement('div'));
	contentContainer.classList.add('content-container');
	if (!moveTimestamp) {
		let metadataContainer = contentContainer.appendChild(document.createElement('div'));
		metadataContainer.classList.add('metadata');
		let username = metadataContainer.appendChild(document.createElement('span'));
		username.classList.add('author');
		username.innerText = message.author.displayName;
		timestamp = metadataContainer.appendChild(document.createElement('span'));
	}

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
	let content = contentContainer.appendChild(document.createElement('span'));
	content.classList.add('content');
	content.innerText = message.content;
	(autoScroll || scrollToBottom) && messageContainer.scrollTo({
		behavior: 'instant',
		top: messageContainer.scrollHeight
	});
	if (message.media) {
		let img = contentContainer.appendChild(document.createElement('img'));
		img.classList.add('attachment');
		img.src = message.media.url;
		img.addEventListener('load', () => {
			// autoScroll = messageContainer.scrollHeight - messageContainer.scrollTop <= messageContainer.offsetHeight;
			(autoScroll || scrollToBottom) && messageContainer.scrollTo({
				behavior: 'instant',
				top: messageContainer.scrollHeight
			});
		});
	}

	// (autoScroll || scrollToBottom) && messageContainer.scrollTo({
	// 	behavior: 'instant',
	// 	top: messageContainer.scrollHeight
	// });
	// scroll to bottom?
	return msg;
}

dialogueText.addEventListener('keydown', async event => {
	switch(event.key.toLowerCase()) {
	case 'enter':
		event.shiftKey || (event.preventDefault(),
		sendMessage(dialogueText.value),
		delete dialogueReplyContainer.dataset.mid,
		dialogueText.value = null);
		break;
	}
});

// onpaste
window.addEventListener('paste', event => {
	console.log(event)
})

function sendMessage(data) {
	return activeDialogue.send(data).catch(err => {
		showError(err.message);
	})
}

// send function

const errorContainer = document.querySelector('.error-container');
const errmsg = errorContainer.querySelector('#errmsg');
function showError(message, callback) {
	errmsg.innerText = message;
	typeof callback == 'function' && errorContainer.addEventListener('close', callback, { once: true });
	errorContainer.showModal();
	return new Promise(resolve => errorContainer.addEventListener('close', resolve, { once: true }));
}

function getCache() {
	return Object.assign({}, JSON.parse(localStorage.getItem(Application.cacheKey)));
}

function updateCache(data) {
	let cache = getCache();
	localStorage.setItem(Application.cacheKey, JSON.stringify(cache.merge(data)));
}

Object.prototype.merge = function(object) {
	for (const key in object) {
		if (object.hasOwnProperty(key)) {
			if (typeof this[key] == 'object' && typeof object[key] == 'object') {
				this[key].merge(object[key]);
				continue;
			}

			this[key] = object[key];
		}
	}

	return this;
}

window.navigation.addEventListener('navigatesuccess', () => showDialogue());
window.addEventListener('contextmenu', async event => {
	event.preventDefault();
	let element = event.target.closest('.message');
	if (element) {
		// event.preventDefault();
		let chatContainer = element.closest('.dialogue-chats');
		let dialogue = await client.dialogues.fetch(chatContainer.dataset.id);
		let isModerator = (dialogue.type !== ChannelType.PRIVATE && dialogue.moderators.cache.has(client.user.id)) || dialogue.founderId === client.user.id;
		if (event.target.closest('.avatar') || event.target.closest('.metadata')) {
			let user = await client.users.fetch(element.dataset.sid);
			const options = [];
			if (user.id !== client.user.id) {
				let hasOutgoingFriendRequest = client.user.friends.pending.outgoing.has(user.id);
				let paired = client.user.friends.cache.has(user.id);
				let isContact = client.user.contacts.cache.has(user.id);
				options.push({
					name: (isContact ? 'Remove' : 'Add') + ' Contact',
					click: () => client.user.contacts[isContact ? 'remove' : 'add'](user.id)
				}, {
					name: (paired ? 'Remove' : hasOutgoingFriendRequest ? 'Cancel' : 'Add') + ' Friend' + (hasOutgoingFriendRequest ? ' Request' : ''),
					click: () => client.user.friends[hasOutgoingFriendRequest ? 'cancel' : paired ? 'remove' : 'request'](user.id)
				}, {
					disabled: !paired, // check if user is friend first
					name: 'Add Friend Nickname',
					click() {
						
					}
				}, {
					name: 'Message',
					click: () => user.fetchDM({ createIfNotExists: true }).then(({ id }) => openDialogue(id))
				}, {
					name: 'Block',
					click() {
						
					}
				}, {
					name: 'Report',
					styles: ['danger'],
					click: () => {}
				});
			}
			isModerator && (options.length > 0 && options.push({ type: 'hr' }),
			options.push({
				name: 'Ban',
				styles: ['danger'],
				click: () => dialogue.members.ban(user.id).then(info => {
					console.log(info)
				})
			}, {
				name: 'Perma-Ban',
				styles: ['danger'],
				click: () => dialogue.members.ban(user.id).then(info => {
					console.log(info)
				})
			}));
			options.length > 0 && options.push({ type: 'hr' });
			options.push({
				name: 'Copy User ID',
				click: () => navigator.clipboard.writeText(user.id)
			});
			// if is client user, add "Copy Private Channel ID"
			ContextMenuBuilder.create(options, event);
			return;
		}

		let message = await dialogue.messages.fetch(element.dataset.id);
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
		})
		ContextMenuBuilder.create(options, event);
		return;
	}

	let chat = event.target.closest('.dialogue');
	let type = chat !== null && chat.dataset.type;
	if (/^(group|private)$/i.test(type)) {
		// event.preventDefault();
		let dialogue = await client.dialogues.fetch(chat.dataset.id);
		let isFounder = dialogue.founderId === client.user.id;
		const options = [{
			name: 'Favourite',
			click() {

			}
		}, { type: 'hr' }, {
			name: 'Archive',
			click() {

			}
		}, {
			name: isFounder ? 'Delete' : 'Leave',
			styles: ['danger'],
			click: () => dialogue.leave().then(res => {
				if (res) {
					let subContainer = getMessageContainer(dialogue.id);
					subContainer && subContainer.remove();
					let sidebarButton = document.querySelector('.dialogue[data-id="' + dialogue.id + '"]');
					if (sidebarButton) {
						let newOpenDialogue = sidebarButton.previousElementSibling || sidebarButton.nextElementSibling;
						newOpenDialogue && openDialogue(newOpenDialogue.dataset.id);
						sidebarButton.remove();
					}
				}
			})
		}];
		options.push({ type: 'hr' }, {
			name: 'Copy Channel ID',
			click: () => navigator.clipboard.writeText(dialogue.id)
		});
		ContextMenuBuilder.create(options, event);
		return;
	}

	let sidebar = event.target.closest('.chats');
	if (sidebar) {
		// event.preventDefault();
		ContextMenuBuilder.create([{
			name: 'Create Group Chat',
			click() {

			}
		}, {
			name: 'Create Private Chat',
			click() {
				// create dialog

			}
		}], event);
		return;
	}
});