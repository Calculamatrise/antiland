// import DOMHelper from "../DOMHelper.js";

export default class UserWrapper extends HTMLElement {
	avatar = null;
	avatarContainer = null;
	card = null;
	userContainer = null;
	constructor(user) {
		super();
		this.dataset.id = user.id;
		Object.defineProperty(this, 'user', { value: user });
	}

	static create(user) {
		let usr = new this(user);
		usr.avatar = user.card.appendChild(this.createAvatarContainer());
		return usr;
	}

	static createCard(user, exisitng) {
		let card = document.createElement('div');
		card.classList.add('user-card');
		card.dataset.id = user.id;
		let container = card.appendChild(document.createElement('div'));
		container.classList.add('user-container')
		container.appendChild(exisitng && exisitng.avatarContainer || this.createAvatarContainer(user));
		let metadata = container.appendChild(document.createElement('div'));
		metadata.classList.add('metadata');
		let username = metadata.appendChild(document.createElement('span'));
		username.innerText = user.displayName;
		let karma = metadata.appendChild(document.createElement('span'));
		karma.classList.add('karma');
		karma.innerText = user.karma;
		return card;
	}

	static createContainer() {}
	static createAvatarContainer(user) {
		let container = document.createElement('div');
		container.classList.add('avatar-container');
		let avatar = container.appendChild(document.createElement('img'));
		avatar.classList.add('avatar');
		user.avatar && (avatar.dataset.id = user.avatar.id);
		avatar.src = user.avatarURL();
		let accessories = [];
		if (user.avatar && user.avatar.accessories) {
			for (let accessory of user.avatar.accessories) {
				if (/^\D0$/.test(accessory)) continue;
				let accs = container.appendChild(document.createElement('img'));
				accs.classList.add('accessory');
				accs.dataset.type = accessory[0];
				accs.src = "https://gfx.antiland.com/accs/" + accessory;
				accessories.push(accs);
			}
		}
		Object.defineProperty(container, 'avatar', { value: avatar });
		Object.defineProperty(avatar, 'container', { value: container });
		Object.defineProperty(avatar, 'accessories', { value: accessories });
		Object.defineProperty(container, 'accessories', { value: accessories });
		return container;
		// return DOMHelper.create('div', {
		// 	classList: ['avatar-container'],
		// 	children: [
		// 		DOMHelper.create('img', {
		// 			classList: ['avatar'],
		// 			dataset: user.avatar && {
		// 				id: user.avatar.id
		// 			},
		// 			src: user.avatarURL()
		// 		}),
		// 		...Array.from(user.avatar.accessories.values()).map(accessory => {
		// 			return DOMHelper.create('img', {
		// 				classList: ['accessory'],
		// 				dataset: {
		// 					id: accessory[0]
		// 				},
		// 				src: user.avatarURL()
		// 			})
		// 		})
		// 	]
		// })
	}

	static createContextMenuOptions(user, { client, member }) {
		const options = [];
		if (user.id !== client.user.id) {
			let hasIncomingFriendRequest = client.user.friends.pending.incoming.has(user.id);
			let hasOutgoingFriendRequest = client.user.friends.pending.outgoing.has(user.id);
			let hasPendingFriendRequest = hasIncomingFriendRequest || hasOutgoingFriendRequest;
			let paired = client.user.friends.cache.has(user.id);
			let isContact = client.user.contacts.cache.has(user.id);
			let isBlocked = client.user.contacts.blocked.has(user.id);
			options.push({
				name: 'Profile',
				click: async () => {
					let dialog = document.body.appendChild(document.createElement('dialog'));
					let card = dialog.appendChild(this.createCard(member || user));
					let request = card.appendChild(document.createElement('button'));
					// if has incoming friend request make accept
					request.innerText = (paired ? 'Remove' : hasOutgoingFriendRequest ? 'Cancel' : hasIncomingFriendRequest ? 'Accept' : 'Add') + ' Friend' + (hasPendingFriendRequest ? ' Request' : ''); // Send Friend Request
					request.addEventListener('click', async event => {
						event.target.classList.add('loading');
						hasIncomingFriendRequest = client.user.friends.pending.incoming.has(user.id);
						hasOutgoingFriendRequest = client.user.friends.pending.outgoing.has(user.id);
						hasPendingFriendRequest = hasIncomingFriendRequest || hasOutgoingFriendRequest;
						paired = client.user.friends.cache.has(user.id);
						await client.user.friends[event.target.dataset.state != 'pending' ? 'request' : 'remove'](user.id).then(res => {
							event.target.innerText = (paired ? 'Remove' : hasOutgoingFriendRequest ? 'Cancel' : hasIncomingFriendRequest ? 'Accept' : 'Add') + ' Friend' + (hasPendingFriendRequest ? ' Request' : '');
						});
						event.target.classList.remove('loading');
					});
					let friends = dialog.appendChild(document.createElement('details'));
					friends.classList.add('friends-list');
					let summary = friends.appendChild(document.createElement('summary'));
					summary.innerText = 'Friends';
					for (let friend of await user.friends.fetch().then(map => map.values())) {
						friends.appendChild(UserWrapper.createCard(friend));
					}
					let button = dialog.appendChild(document.createElement('button'));
					button.innerText = 'Close';
					button.addEventListener('click', event => {
						event.preventDefault();
						dialog.remove();
					}, { once: true });
					dialog.showModal();
				}
			}, {
				name: (isContact ? 'Remove' : 'Add') + ' Contact',
				click: () => client.user.contacts[isContact ? 'remove' : 'add'](user.id)
			}, {
				name: (paired ? 'Remove' : hasOutgoingFriendRequest ? 'Cancel' : 'Add') + ' Friend' + (hasPendingFriendRequest ? ' Request' : ''),
				click: () => client.user.friends[hasOutgoingFriendRequest ? 'cancel' : paired ? 'remove' : 'request'](user.id)
			}, {
				disabled: !paired, // check if user is friend first
				name: 'Add Friend Nickname',
				click() {
					
				}
			}, {
				name: 'Message',
				click: () => user.fetchDM({ createIfNotExists: true }).then(({ id, name }) => history.pushState({ dialogueId: id, name }, null, location.pathname + '?g=' + id))
			}, {
				name: (isBlocked ? 'Unb' : 'B') + 'lock',
				click: () => client.user.contacts[(isBlocked ? 'un' : '') + 'block'](user.id)
			}, {
				name: 'Report',
				styles: ['danger'],
				click: () => {}
			});
		}
		options.length > 0 && options.push({ type: 'hr' });
		options.push({
			name: 'Copy User ID',
			click: () => navigator.clipboard.writeText(user.id)
		});
		return options;
	}
}

customElements.define('user-wrapper', UserWrapper);