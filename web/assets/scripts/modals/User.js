// import DOMHelper from "../DOMHelper.js";

export default class UserWrapper extends HTMLElement {
	avatar = null;
	avatarContainer = null;
	card = null;
	userContainer = null;
	constructor(user) {
		super(),
		this.dataset.id = user.id,
		Object.defineProperty(this, 'user', { value: user })
	}

	static create(user) {
		let usr = new this(user);
		usr.avatar = user.card.appendChild(this.createAvatarContainer());
		return usr;
	}

	static createCard(user, exisitng) {
		let card = document.createElement('div');
		card.classList.add('user-card'),
		card.dataset.id = user.id;
		let container = card.appendChild(document.createElement('div'));
		container.classList.add('user-container'),
		container.appendChild(exisitng && exisitng.avatarContainer || this.createAvatarContainer(user));
		let metadata = container.appendChild(document.createElement('div'));
		metadata.classList.add('metadata');
		let username = metadata.appendChild(document.createElement('span'));
		username.innerText = user.displayName;
		let karma = metadata.appendChild(document.createElement('span'));
		karma.classList.add('karma'),
		karma.innerText = user.karma;
		return card
	}

	static createContainer() {}
	static createAvatarContainer(user) {
		let container = document.createElement('div');
		container.classList.add('avatar-container');
		let avatar = container.appendChild(document.createElement('img'));
		avatar.classList.add('avatar'),
		user.avatar && (avatar.dataset.id = user.avatar.id),
		avatar.src = user.avatarURL();
		let accessories = [];
		if (user.avatar && user.avatar.accessories) {
			for (let accessory of user.avatar.accessories) {
				if (/^\D0$/.test(accessory)) continue;
				let accs = container.appendChild(document.createElement('img'));
				accs.classList.add('accessory'),
				accs.dataset.type = accessory[0],
				accs.src = "https://gfx.antiland.com/accs/" + accessory,
				accessories.push(accs);
			}
		}
		Object.defineProperty(container, 'avatar', { value: avatar }),
		Object.defineProperty(avatar, 'container', { value: container }),
		Object.defineProperty(avatar, 'accessories', { value: accessories }),
		Object.defineProperty(container, 'accessories', { value: accessories });
		return container
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

	static createContextMenuOptions(user, { client }) {
		const options = [];
		if (user.id !== client.user.id) {
			let hasIncomingFriendRequest = client.user.friends.pending.incoming.has(user.id)
			  , hasOutgoingFriendRequest = client.user.friends.pending.outgoing.has(user.id)
			  , hasPendingFriendRequest = hasIncomingFriendRequest || hasOutgoingFriendRequest
			  , paired = client.user.friends.cache.has(user.id)
			  , isContact = client.user.contacts.cache.has(user.id)
			  , isBlocked = client.user.contacts.blocked.has(user.id);
			options.push({
				name: 'Profile',
				click: () => this.showProfile(...arguments)
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
		return options
	}

	static async showProfile(user, { client, member }) {
		// show immediately
		member && await member.fetch() || await user.fetch();
		let hasIncomingFriendRequest = client.user.friends.pending.incoming.has(user.id)
		  , hasOutgoingFriendRequest = client.user.friends.pending.outgoing.has(user.id)
		  , hasPendingFriendRequest = hasIncomingFriendRequest || hasOutgoingFriendRequest
		  , paired = client.user.friends.cache.has(user.id)
		  , dialog = document.querySelector('.user-profile');
		if (null === dialog) {
			dialog = document.body.appendChild(document.createElement('dialog')),
			dialog.classList.add('user-profile');
		} else {
			dialog.replaceChildren();
		}

		let card = dialog.appendChild(this.createCard(member || user))
		  , request = card.appendChild(document.createElement('button'));
		
		// if has incoming friend request make accept
		request.innerText = (paired ? 'Remove' : hasOutgoingFriendRequest ? 'Cancel' : hasIncomingFriendRequest ? 'Accept' : 'Add') + ' Friend' + (hasPendingFriendRequest ? ' Request' : ''); // Send Friend Request
		request.addEventListener('click', async ({ target }) => {
			target.classList.add('loading');
			hasIncomingFriendRequest = client.user.friends.pending.incoming.has(user.id);
			hasOutgoingFriendRequest = client.user.friends.pending.outgoing.has(user.id);
			hasPendingFriendRequest = hasIncomingFriendRequest || hasOutgoingFriendRequest;
			paired = client.user.friends.cache.has(user.id);
			await client.user.friends[target.dataset.state != 'pending' ? 'request' : 'remove'](user.id).then(res => {
				target.innerText = (paired ? 'Remove' : hasOutgoingFriendRequest ? 'Cancel' : hasIncomingFriendRequest ? 'Accept' : 'Add') + ' Friend' + (hasPendingFriendRequest ? ' Request' : '');
			});
			target.classList.remove('loading')
		}, { passive: true });
		let friends = dialog.appendChild(document.createElement('details'));
		friends.classList.add('friends-list');
		let summary = friends.appendChild(document.createElement('summary'));
		summary.innerText = 'Friends';
		user.friends.fetch().then(list => {
			let friendData = Array.from(list.values());
			for (let friend of friendData) {
				let card = friends.appendChild(UserWrapper.createCard(friend));
				card.addEventListener('click', () => UserWrapper.showProfile(friend, { client }), { passive: true });
			}
			let mutualFriendData = friendData.filter(({ id }) => client.user.friends.cache.has(id));
			if (mutualFriendData.length > 0) {
				let mutualFriends = friends.appendChild(document.createElement('details'));
				summary = mutualFriends.appendChild(document.createElement('summary'));
				summary.innerText = 'Mutual Friends';
				for (let friend of mutualFriendData) {
					let card = mutualFriends.appendChild(UserWrapper.createCard(friend));
					card.addEventListener('click', () => UserWrapper.showProfile(friend, { client }), { passive: true })
				}
			}
		});
		let button = dialog.appendChild(document.createElement('button'));
		button.innerText = 'Close';
		button.addEventListener('click', event => {
			event.preventDefault(),
			dialog.remove()
		}, { once: true });
		dialog.showModal()
	}
}

customElements.define('user-wrapper', UserWrapper);