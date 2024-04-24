import Application from "./assets/scripts/Application.js";
import CacheManager from "./assets/scripts/CacheManager.js";
import ContextMenu from "./assets/scripts/ContextMenu.js";

Application.applyColorScheme();
window.Application = new Application();

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('service-worker.js');
}

let contentCache = CacheManager.create(Application.cacheKey, { persist: true });
let sessionCache = CacheManager.create(Application.cacheKey + '_temp');

// Remember which channel was selected in localStorage?
// Or which nav button was selected
// Add setting to remember?

/**
 * @todo add option to filter DMs from certain sex or age groups in settings
 */

import Client from "./assets/scripts/antiland/client/Client.js";
import ChannelFlagsBitField from "../src/utils/ChannelFlagsBitField.js";
import ChannelType from "../src/utils/ChannelType.js";
import ChatSetupFlags from "../src/utils/ChatSetupFlags.js";
import MessageWrapper from "./assets/scripts/modals/Message.js";
import MemberWrapper from "./assets/scripts/modals/Member.js";
import SuperDialog from "./assets/scripts/modals/SuperDialog.js";
import UserWrapper from "./assets/scripts/modals/User.js";

let activeDialogue = null;
let archivedChats;
let pinnedChats;

const client = new Client({ debug: true, fallback: true, maxReconnectAttempts: 6 });
const authContainer = document.querySelector('.auth-container');
const chatsContainer = document.querySelector('.panel.left-panel .chats');
for (const radio of document.querySelectorAll('input[type="radio"][name="chats"]')) {
	radio.addEventListener('change', event => {
		let allowed = event.target.id.toUpperCase().replace(/s$/i, '');
		for (const chat of chatsContainer.querySelectorAll('label')) {
			chat.style[(allowed == 'ALL' || allowed === chat.dataset.type || (allowed === 'GROUP' && chat.dataset.type === 'PUBLIC')) ? 'removeProperty' : 'setProperty']('display', 'none');
		}
	});
}

const dialogueMembersView = document.querySelector('.members-list');
const dialogueView = document.querySelector('#dialogue');
const dialogueMetadata = dialogueView.querySelector('.metadata');
const dialogueMetadataTitle = dialogueMetadata.querySelector('.title');
const dialogueMetadataDescription = dialogueMetadata.querySelector('.description');
const dialogueMediaContainer = dialogueView.querySelector('.media-container');
const dialogueReplyContainer = dialogueView.querySelector('.reply-container');
const dialogueReplyAuthor = dialogueReplyContainer.querySelector('.author');
const dialogueReplyCancel = dialogueReplyContainer.querySelector('button');
dialogueReplyContainer.addEventListener('click', () => {
	let element = document.querySelector('message-wrapper[data-id="' + dialogueReplyContainer.dataset.mid + '"]');
	if (!element) return;
	element.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
dialogueReplyCancel.addEventListener('click', () => {
	delete dialogueReplyContainer.dataset.mid;
	dialogueReplyContainer.style.setProperty('display', 'none');
});

const dialogueMedia = dialogueView.querySelector('#media');
const dialogueText = dialogueView.querySelector('#text');
const dialogueSend = dialogueView.querySelector('#send');
const messageContainer = document.querySelector('#messages');

// check params for p -- user profile open dialog if present
let openDialogueId = Application.searchParams.get('g');
let cachedDialogues = contentCache.get('dialogues');
if (cachedDialogues) {
	for (let dialogueId in cachedDialogues) {
		let dialogue = cachedDialogues[dialogueId];
		getChatTab(dialogue, { createIfNotExists: true });
		if (dialogueId === openDialogueId) {
			showDialogue({ dialogueId, name: dialogue.name });
		}
	}
}

function getChatTab(dialogue, { createIfNotExists } = {}) {
	let chat = chatsContainer.querySelector('label[data-id="' + dialogue.id + '"]');
	if (!chat && createIfNotExists) {
		dialogue.archived && getChatArchive({ createIfNotExists: true });
		dialogue.pinned && getPinnedChats({ createIfNotExists: true });
		chat = (dialogue.archived ? archivedChats : dialogue.pinned ? pinnedChats : chatsContainer).appendChild(document.createElement('label'));
		chat.classList.add('dialogue');
		client.user && client.user.favorites.cache.has(dialogue.id) && (chat.classList.add('favorite'),
		dialogue.pinned = true);
		chat.dataset.id = dialogue.id;
		chat.dataset.type = dialogue.type;
		dialogue.archived && (chat.dataset.archived = true);
		dialogue.pinned && (chat.dataset.pinned = true);
		let radio = chat.appendChild(document.createElement('input'));
		radio.setAttribute('type', 'radio');
		radio.setAttribute('name', 'dialogue');
		radio.style.setProperty('display', 'none');
		radio.addEventListener('change', event => {
			activeDialogue = dialogue;
			openDialogue(dialogue.id);
		});
		let name = chat.appendChild(document.createElement('span'));
		dialogue.name && (name.innerText = dialogue.name);
		let lastMessage = chat.appendChild(document.createElement('span'));
		lastMessage.classList.add('last-message');
		dialogue.lastMessage && (lastMessage.innerText = (dialogue.lastMessage.author.id === client.user.id ? 'You: ' : '') + dialogue.lastMessage.content.replace(/\n+.+/g, ''));
		Object.defineProperties(chat, {
			lastMessage: { value: lastMessage, writable: true },
			name: { value: name, writable: true },
			radio: { value: radio, writable: true }
		});
	}
	return chat;
}

function updateChatTab(dialogue) {
	let chat = getChatTab(dialogue, { createIfNotExists: true });
	let cachedDialogue = cachedDialogues && cachedDialogues[dialogue.id];
	let notInChats = chat.parentElement !== chatsContainer;
	client.user && client.user.favorites.cache.has(dialogue.id) && (chat.classList.add('favorite'),
	cachedDialogue.pinned = true);
	cachedDialogue.archived && getChatArchive({ createIfNotExists: true }).appendChild(chat);
	cachedDialogue.pinned && getPinnedChats({ createIfNotExists: true }).appendChild(chat);
	!cachedDialogue.archived && !cachedDialogue.pinned && notInChats && (pinnedChats ? pinnedChats.after(chat) : archivedChats ? archivedChats.after(chat) : chatsContainer.appendChild(chat));
	chat.name.innerText = dialogue.name;
	dialogue.lastMessage && (chat.lastMessage.innerText = (dialogue.lastMessage.author.id === client.user.id ? 'You: ' : '') + dialogue.lastMessage.content.replace(/\n+.+/g, ''));
	return chat;
}

function getChatArchive({ createIfNotExists } = {}) {
	if (!archivedChats && createIfNotExists) {
		let details = document.createElement('details');
		details.classList.add('archived-chats');
		let summary = details.appendChild(document.createElement('summary'));
		summary.innerText = 'Archived Chats';
		archivedChats = details.appendChild(document.createElement('div'));
		archivedChats.classList.add('chats');
		chatsContainer.prepend(details);
	}
	return archivedChats || null;
}

function getPinnedChats({ createIfNotExists } = {}) {
	if (!pinnedChats && createIfNotExists) {
		pinnedChats = document.createElement('div');
		pinnedChats.classList.add('pinned-chats');
		pinnedChats.style.setProperty('display', 'contents');
		archivedChats ? archivedChats.after(pinnedChats) : chatsContainer.prepend(pinnedChats);
	}
	return pinnedChats || null;
}

client.on('ready', async () => {
	true /* debug */ && (window.client = client);

	localStorage.setItem('al_session', client.token);
	if (Application.searchParams.has('g')) {
		let dialogueId = Application.searchParams.get('g');
		let dialogue = await client.dialogues.fetch(dialogueId);
		showDialogue({ dialogueId: dialogue.id, name: dialogue.name });
	}

	let dialogues = await client.dialogues.fetchActive({ force: true });
	for (let dialogue of dialogues.values()) {
		updateChatTab(dialogue, { createIfNotExists: true });
	}

	contentCache.update('dialogues', Object.fromEntries(Array.from(dialogues.values()).map(({ id, name, type }) => [id, { id, name, type }])));
	for (let element of document.querySelectorAll('[data-action="insert"]')) {
		let field = element.dataset.field;
		let replace = element.dataset.replace || 'innerText';
		let target = client.user;
		if (field.includes('.')) {
			let objects = field.split('.');
			field = objects.pop();
			for (let i = 0; i < objects.length; objects.shift()) {
				target = target[objects[i]];
			}
		}

		switch(field) {
		case 'avatar':
			element[replace] = target.avatarURL();
			for (let accessory of target.avatar.accessories) {
				if (/^\D0$/.test(accessory)) continue;
				let accs = document.createElement('img');
				accs.classList.add('accessory');
				accs.dataset.type = accessory[0];
				accs.src = "https://gfx.antiland.com/accs/" + accessory;
				element.after(accs);
			}
			break;
		case 'blocked':
			element.replaceChildren(...await Promise.all(Array.from(target[field].values()).map(userId => client.users.fetch(userId, { cache: false }))).then(users => {
				return users.map(user => {
					let card = UserWrapper.createCard(user);
					let unblock = card.appendChild(document.createElement('button'));
					unblock.innerText = 'Unblock';
					unblock.addEventListener('click', async event => {
						event.target.classList.add('loading');
						let card = event.target.closest('.user-card');
						card !== null && await client.user.contacts.unblock(card.dataset.id).then(res => {
							card.remove();
						});
						event.target.classList.remove('loading');
					});
					return card;
				});
			}));
			break;
		default:
			element[replace] = target[field]
		}
	}

	authContainer.close('success');
});

client.on('messageCreate', message => createMessage(message));
client.on('giftMessageCreate', message => createMessage(Object.assign(message, { author: message.sender })));
client.on('messageDelete', message => {
	let subContainer = getMessageContainer(message.dialogueId, { createIfNotExists: true });
	let messageWrapper = subContainer.querySelector('message-wrapper[data-id="' + message.id + '"]');
	if (null === messageWrapper) return;
	messageWrapper.classList.add('deleted');
});

const authUsername = authContainer.querySelector('input[type="text"]');
const authPassword = authContainer.querySelector('input[type="password"]');
authContainer.addEventListener('close', async event => {
	switch(event.target.returnValue) {
	case 'cancel':
		return;
	case 'success':
		authUsername.value = null;
		authPassword.value = null;
		return;
	}
});

const login = authContainer.querySelector('#login');
login.addEventListener('click', async event => {
	event.target.classList.add('loading');
	await client.login({
		username: authUsername.value,
		password: authPassword.value
	}).catch(err => {
		SuperDialog.error(err.message);
	});
	event.target.classList.remove('loading');
});

const logout = document.querySelector('#logout');
logout.addEventListener('click', async event => {
	event.target.classList.add('loading');
	await client.destroy(true);
	localStorage.removeItem('al_session');
	event.target.classList.remove('loading');
	location.reload();
});

// check if user token is saved first, if yes then login
const token = localStorage.getItem('al_session');
if (token !== null) {
	client.login(token).catch(err => {
		SuperDialog.error(err.message, () => {
			location.reload();
		});
		209 === err.code && localStorage.removeItem('al_session');
	});
} else {
	authContainer.showModal();
}

function openDialogue(dialogueId) {
	let dialogue = client.dialogues.cache.get(dialogueId);
	if (!dialogue) {
		SuperDialog.error("Failed to find dialogue.");
		return;
	}
	history.pushState({ dialogueId, name: dialogue.name }, null, location.pathname + '?g=' + dialogueId);
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
	let tabRadio = chatsContainer.querySelector('label[data-id="' + dialogueId + '"] > input[type="radio"]');;
	tabRadio !== null && (tabRadio.checked = true);
	let container = getMessageContainer(dialogueId, { createIfNotExists: true });
	container.style.removeProperty('display');
	dialogueMembersView.replaceChildren();
	dialogueMetadataTitle.innerText = name;
	dialogueText.setAttribute('placeholder', 'Message ' + name);
	document.title = name + ' - ' + Application.name;
	client.dialogues.fetch(dialogueId).then(async dialogue => {
		activeDialogue = dialogue;
		if (dialogue.type !== ChannelType.PRIVATE) {
			dialogueMetadataDescription.innerText = dialogue.description;
			let members = await dialogue.members.fetch({ force: true });
			for (let member of members.values()) {
				dialogueMembersView.appendChild(MemberWrapper.createCard(member));
			}
		}

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
	let subContainer = getMessageContainer(message.dialogueId, { createIfNotExists: true });
	if (null !== subContainer.querySelector('message-wrapper[data-id="' + message.id + '"]')) return;
	let autoScroll = messageContainer.scrollHeight - messageContainer.scrollTop <= messageContainer.offsetHeight;
	let lastMessageSid = subContainer.lastElementChild && subContainer.lastElementChild.dataset.sid;
	let msg = subContainer.appendChild(MessageWrapper.create(message));
	lastMessageSid !== message.author.id && msg.setAuthor();
	(autoScroll || scrollToBottom) && messageContainer.scrollTo({
		behavior: 'instant',
		top: messageContainer.scrollHeight
	});
	msg.media && msg.media.addEventListener('load', () => {
		// autoScroll = messageContainer.scrollHeight - messageContainer.scrollTop <= messageContainer.offsetHeight;
		(autoScroll || scrollToBottom) && messageContainer.scrollTo({
			behavior: 'instant',
			top: messageContainer.scrollHeight
		});
	});
	let lastMessagePreview = document.querySelector('label[data-id="' + message.dialogueId + '"] > .last-message');
	null !== lastMessagePreview && (lastMessagePreview.innerText = message.content);
	return msg;
}

const mediaFiles = new Map();
dialogueText.addEventListener('keydown', async event => {
	switch(event.key.toLowerCase()) {
	case 'enter':
		event.shiftKey || (event.preventDefault(),
		// send media files first;
		sendMessage(),
		delete dialogueReplyContainer.dataset.mid,
		dialogueText.value = null,
		dialogueMediaContainer.replaceChildren(),
		mediaFiles.clear());
		break;
	}
});

dialogueMedia.addEventListener('change', ({ target }) => {
	handleFileInput({ files: target.files });
	target.value = null;
});
window.addEventListener('drop', event => {
	event.preventDefault();
	handleFileInput(event.dataTransfer);
});
window.addEventListener('paste', ({ clipboardData }) => handleFileInput(clipboardData));
function handleFileInput({ files }) {
	for (let file of files) {
		let uuid = crypto.randomUUID();
		let previewURL = URL.createObjectURL(file);
		let previewContainer = dialogueMediaContainer.appendChild(document.createElement('div'));
		previewContainer.classList.add('preview-container');
		previewContainer.dataset.id = uuid;
		let previewImg = previewContainer.appendChild(document.createElement('img'));
		previewImg.src = previewURL;
		let previewName = previewContainer.appendChild(document.createElement('span'));
		previewName.innerText = file.name;
		mediaFiles.set(uuid, previewURL);
	}
}

dialogueSend.addEventListener('click', sendMessage);
function sendMessage() {
	return activeDialogue.send(dialogueText.value, mediaFiles.size > 0 && { attachments: Array.from(mediaFiles.entries()).map(([name, url]) => ({ name, url })) }).catch(err => {
		SuperDialog.error(err.message);
	})
}

const settingsContainer = document.querySelector('.settings-container');
const settings = document.querySelector('#settings');
settings.addEventListener('click', event => {
	event.preventDefault();
	settingsContainer.showModal();
});

const saveSettings = settingsContainer.querySelector('button[value="save"]');
saveSettings.addEventListener('click', event => {
	event.preventDefault();
	event.target.classList.add('loading');
	// do shit
	event.target.classList.remove('loading');
	// close if success
	// settingsContainer.close();
});

window.navigation.addEventListener('navigatesuccess', () => showDialogue());
window.addEventListener('contextmenu', async event => {
	event.preventDefault();
	let userWrapper = event.target.closest('.user-card');
	if (userWrapper) {
		if (userWrapper.classList.contains('member-card')) {
			let dialogue = await client.dialogues.fetch(userWrapper.dataset.did);
			let member = await dialogue.members.fetch(userWrapper.dataset.id, { partial: true });
			let options = MemberWrapper.createContextMenuOptions(member, { client });
			ContextMenu.create(options, event);
			return;
		}

		let user = await client.users.fetch(userWrapper.dataset.id);
		let options = UserWrapper.createContextMenuOptions(user, { client });
		ContextMenu.create(options, event);
	}

	let element = event.target.closest('message-wrapper');
	if (element) {
		// event.preventDefault();
		let chatContainer = element.closest('.dialogue-chats');
		let dialogue = await client.dialogues.fetch(chatContainer.dataset.id);
		let isModerator = (dialogue.type !== ChannelType.PRIVATE && dialogue.moderators.cache.has(client.user.id)) || dialogue.founderId === client.user.id;
		if (event.target.closest('.avatar') || event.target.closest('.metadata')) {
			if (dialogue.type !== ChannelType.PRIVATE) {
				let member = await dialogue.members.fetch(element.dataset.sid, { partial: true });
				let options = MemberWrapper.createContextMenuOptions(member, { client });
				ContextMenu.create(options, event);
				return;
			}

			let member = await client.users.fetch(element.dataset.sid);
			let options = UserWrapper.createContextMenuOptions(member, { client });
			ContextMenu.create(options, event);
			return;
		}

		let message = await dialogue.messages.fetch(element.dataset.id);
		const options = [{
			disabled: !message || message.lovers.cache.has(client.user.id),
			name: 'Like',
			click: () => message.like()
		}, {
			disabled: !message || message.id === dialogueReplyContainer.dataset.mid,
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
			click() {}
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
			disabled: !message || message.deleted,
			name: 'Delete',
			styles: ['danger'],
			click: () => dialogue.messages.delete(message.id).then(res => {
				res && element.classList.add('deleted');
				// res && element.remove();
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
		ContextMenu.create(options, event);
		// ContextMenu.create(options, event).addEventListener('close', event => {
		// 	console.log(event) // use this to handle actions from Message.createContextMenuOptions();
		// }, { once: true });
		return;
	}

	let chat = event.target.closest('.dialogue');
	let type = chat !== null && chat.dataset.type;
	if (/^(group|private|public)$/i.test(type)) {
		// event.preventDefault();
		let dialogue = await client.dialogues.fetch(chat.dataset.id);
		let isFounder = dialogue.founderId === client.user.id;
		let isFavorite = client.user.favorites.cache.has(dialogue.id);
		let dialogues = contentCache.get('dialogues');
		let dialogueCache = dialogues && dialogues[dialogue.id];
		let isArchived = dialogueCache && dialogueCache.archived;
		let isPinned = dialogueCache && dialogueCache.pinned;
		const options = [{
			name: (isArchived ? 'Una' : 'A') + 'rchive',
			click: () => {
				isArchived = !dialogueCache.archived;
				dialogueCache.archived = isArchived;
				contentCache.update('dialogues', { [dialogue.id]: dialogueCache });
				updateChatTab(dialogueCache);
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
		!isArchived && (options.length > 0 && options.unshift({ type: 'hr' }),
		options.unshift({
			name: (isPinned ? 'Unp' : 'P') + 'in',
			click: () => {
				isPinned = !dialogueCache.pinned;
				dialogueCache.pinned = isPinned;
				contentCache.update('dialogues', { [dialogue.id]: dialogueCache });
				updateChatTab(dialogueCache);
			}
		}, {
			name: (isFavorite ? 'Unf' : 'F') + 'avourite',
			click: () => client.user.favorites[isFavorite ? 'remove' : 'add'](dialogue.id).then(res => {
				updateChatTab(dialogueCache);
			})
		}));
		options.length > 0 && options.push({ type: 'hr' });
		options.push({
			name: 'Copy Channel ID',
			click: () => navigator.clipboard.writeText(dialogue.id)
		});
		ContextMenu.create(options, event);
		return;
	}

	let sidebar = event.target.closest('.chats');
	if (sidebar) {
		// event.preventDefault();
		ContextMenu.create([{
			name: 'Create Channel',
			click() {
				let dialog = document.body.appendChild(document.createElement('dialog'));
				let title = dialog.appendChild(document.createElement('h4'));
				title.innerText = 'Create a channel';
				let name = dialog.appendChild(document.createElement('input'));
				name.setAttribute('placeholder', 'Name');
				dialog.appendChild(document.createElement('br'));
				let description = dialog.appendChild(document.createElement('textarea'));
				description.setAttribute('placeholder', 'Description');
				dialog.appendChild(document.createElement('hr'));
				let form = dialog.appendChild(document.createElement('form'));
				let submit = form.appendChild(document.createElement('button'));
				submit.innerText = 'Create';
				submit.addEventListener('click', event => {
					event.preventDefault();
				});
				let cancel = form.appendChild(document.createElement('button'));
				cancel.setAttribute('formmethod', 'dialog');
				cancel.innerText = 'Cancel';
				dialog.showModal();
			}
		}, {
			name: 'Create Group Chat',
			click() {
				let dialog = document.body.appendChild(document.createElement('dialog'));
				let title = dialog.appendChild(document.createElement('h4'));
				title.innerText = 'Create a group chat';
				let name = dialog.appendChild(document.createElement('input'));
				name.setAttribute('placeholder', 'Name');
				dialog.appendChild(document.createElement('br'));
				let description = dialog.appendChild(document.createElement('textarea'));
				description.setAttribute('placeholder', 'Description');
				let form = dialog.appendChild(document.createElement('form'));
				let submit = form.appendChild(document.createElement('button'));
				submit.innerText = 'Create';
				submit.addEventListener('click', event => {
					event.preventDefault();
				});
				let cancel = form.appendChild(document.createElement('button'));
				cancel.setAttribute('formmethod', 'dialog');
				cancel.innerText = 'Cancel';
				dialog.showModal();
			}
		}, {
			name: 'Create Private Chat',
			click() {
				// create dialog

			}
		}, {
			name: (contentCache.get('showArchive') ? 'Hide' : 'Show') + ' Archived Chats',
			click() {
				let showArchive = !contentCache.get('showArchive');
				contentCache.set('showArchive', showArchive);
				if (archivedChats) {
					let details = archivedChats.closest('details');
					null !== details && details.style[showArchive ? 'removeProperty' : 'setProperty']('display', 'none');
				}
			}
		}], event);
		return;
	}
});