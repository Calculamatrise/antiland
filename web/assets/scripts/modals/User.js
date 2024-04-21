// import DOMHelper from "../DOMHelper.js";

export default class UserWrapper extends HTMLElement {
	avatar = null;
	avatarContainer = null;
	card = null;
	userContainer = null;
	constructor(user) {
		super();
		this.card = this.constructor.createCard(user);
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
		let username = container.appendChild(document.createElement('span'));
		username.innerText = user.displayName;
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
		for (let accessory of user.avatar.accessories) {
			if (/^\D0$/.test(accessory)) continue;
			let accs = container.appendChild(document.createElement('img'));
			accs.classList.add('accessory');
			accs.dataset.type = accessory[0];
			accs.src = "https://gfx.antiland.com/accs/" + accessory;
			accessories.push(accs);
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
}

customElements.define('user-wrapper', UserWrapper);