// import DOMHelper from "../DOMHelper.js";
import UserWrapper from "./User.js";
import ChannelType from "../../../../src/utils/ChannelType.js";

export default class MemberWrapper extends UserWrapper {
	constructor(member) {
		super();
		this.dataset.did = member.dialogueId;
		this.dataset.position = member.position;
		Object.defineProperty(this, 'member', { value: member });
	}

	static create(member) {
		let temp = new this(member);
		temp.avatar = user.member.appendChild(this.createAvatarContainer());
		return temp;
	}

	static createCard(member) {
		let card = super.createCard(member.user);
		card.classList.add('member-card');
		card.dataset.did = member.dialogueId;
		card.dataset.position = member.position;
		return card;
	}

	static createContextMenuOptions(member, { client }) {
		let options = super.createContextMenuOptions(member.user, { client, member });
		let isClientModerator = (member.dialogue.type !== ChannelType.PRIVATE && member.dialogue.moderators.cache.has(client.user.id));
		if (member.id !== client.user.id) {
			let isClientFounder = member.dialogue.founderId === client.user.id;
			let isModerator = member.dialogue.moderators.cache.has(member.id);
			isClientFounder && (options.length > 0 && options.splice(options.length - 2, 0, { type: 'hr' }),
			options.splice(options.length - 2, 0, {
				name: (isModerator ? 'Remove' : 'Add') + ' Mod',
				styles: isModerator && ['danger'],
				click: () => member.dialogue.moderators[isModerator ? 'remove' : 'add'](member.id).then(info => {
					console.log(info)
				})
			}));
			(isClientFounder || isClientModerator) && (options.length > 0 && options.splice(options.length - 2, 0, { type: 'hr' }),
			options.splice(options.length - 2, 0, {
				name: 'Ban',
				styles: ['danger'],
				click: () => member.dialogue.members.ban(member.id).then(info => {
					console.log(info)
				})
			}, {
				name: 'Perma-Ban',
				styles: ['danger'],
				click: () => member.dialogue.members.ban(member.id).then(info => {
					console.log(info)
				})
			}));
		} else if (isClientModerator) {
			options.splice(options.length - 2, 0, {
				name: 'Refuse Mod',
				styles: ['danger'],
				click: () => member.dialogue.members.ban(member.id).then(info => {
					console.log(info)
				})
			});
		}
		return options;
	}
}

customElements.define('member-wrapper', MemberWrapper);