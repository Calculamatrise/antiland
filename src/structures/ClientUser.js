import User from "./User.js";
import ClientFriendManager from "../managers/ClientFriendManager.js";
import ClientStickerManager from "../managers/ClientStickerManager.js";
import ContactManager from "../managers/ContactManager.js";
import FavoriteManager from "../managers/FavoriteManager.js";
import TaskManager from "../managers/TaskManager.js";

export default class ClientUser extends User {
	accentColor = null;
	blockedBy = new Set();
	channelId = null;
	contacts = new ContactManager(this);
	favorites = new FavoriteManager(this);
	friends = new ClientFriendManager(this);
	hexAccentColor = null;
	messages = new Map(); // private message manager
	stickers = new ClientStickerManager(this);
	tasks = new TaskManager(this);
	constructor(data) {
		super(...arguments, true);
		Object.defineProperties(this, {
			referrerId: { value: null, writable: true }
		});
		this._patch(data)
	}

	_patch(data) {
		if (typeof data != 'object' || data == null) return;
		super._patch(...arguments);
		for (let key in data) {
			switch (key) {
			case 'antiTokens':
			case 'color':
				this[key] = data[key];
				break;
			case 'auth':
				if (typeof data[key] != 'object') break;
				for (let prop in data[key]) {
					switch(prop) {
					case 'email':
					case 'emailIsVerified':
					case 'username':
						this[prop] = data[key][prop];
						break;
					case 'channelId':
					case 'referrerId':
						if (this[prop] !== null) break;
						Object.defineProperty(this, prop, { value: data[key][prop], writable: false })
					}
				}
				break;
			case 'avatars':
				this.avatar ||= {};
				if (typeof data[key] == 'object') {
					for (let prop in data[key]) {
						switch (prop) {
						case 'allAccs':
							this.accessoriesOwned = new Set(data[key][prop]);
							break;
						case 'freeChange':
							this.avatar.hasFreeChange = data[key][prop];
							break;
						case 'exclusive':
						case 'regular':
							this.avatar.id ??= data[key][prop];
							this.avatar.type = prop
						}
					}
					break;
				}
				Object.assign(this.avatar, { id: data[key] });
				break;
			case 'badgeColor':
				this.hexAccentColor = data[key];
				this.accentColor = parseInt(this.hexAccentColor.replace(/^#/, ''), 16);
				break;
			case 'blockedBy':
				this[key] = new Set(data[key]);
				break;
			case 'contentSettings':
				this[key] = new Map(Object.entries(data[key]));
				break;
			// case 'favorites':
			// 	for (let item of data[key]) {}
			// 	break;
			case 'lang':
				this.language = data[key];
				// this.locale = data[key];
				break;
			case 'langs':
				this.userLanguages = new Set(data[key]);
				break;
			case 'msgCount':
				this.messageCount = data[key];
				break;
			case 'security':
				this[key] = Object.assign({}, this[key]);
				let meta = data[key];
				for (let prop in meta) {
					switch(prop) {
					case 'acceptRandoms':
					case 'allowUnsafeContent':
					case 'getRandoms':
					case 'hideMates':
					case 'minKarma':
						this[key][prop] = meta[prop];
					case 'karmaWallArtifacts': // change to this.artifacts.karmaWall // ???
						this[prop] = meta[prop];
						break;
					case 'deleted':
						this[key].scheduledDeletion = meta[prop]
					}
				}
				// this[key] = Object.assign({}, this[key], data[key]);
				// this[key] = new Map(Object.entries(data[key]));
				break;
			case 'sp':
				this.superPowers = Object.assign({}, this.superPowers, data[key])
			}
		}
		return this
	}

	async fetchContentSettings({ force } = {}) {
		if (!force && this.contentSettings) {
			return this.contentSettings;
		}
		return this.client.requests.post("functions/v2:profile.me.contentSettings").then(r => {
			console.log(r) // cache settings // this._patch;
			return r
		})
	}

	async fetchSecuritySettings({ force } = {}) {
		if (!force && this.settings) {
			return this.settings;
		}
		return this.client.requests.post("functions/v2:profile.me.security").then(r => {
			console.log(r) // cache settings // this._patch;
			return r
		})
	}

	async fetchVisitors({ force } = {}) {
		return this.client.requests.post("functions/v2:profile.visitor.list").then(r => {
			console.log(r) // cache settings // this._patch;
			return r
		})
	}

	generateToken() {
		return this.client.requests.post("functions/v2:profile.authToken.create").then(r => {
			console.log(r);
			return r
		})
	}

	async getHumanLink({ force } = {}) {
		if (force || !this.humanLink) {
			this.humanLink = await this.client.requests.post("functions/v2:profile.getHumanLink").then(r => r.link)
		}
		return this.humanLink
	}

	purchaseSuperPowers() {
		return this.client.requests.post("functions/v2:purchase.spTrial").then(r => {
			console.log(r)
			return r
		})
	}

	setAccessories(accessories) {
		return this.client.requests.post("functions/v2:profile.setAccessories", {
			accessories: Array.from(accessories || this.avatar.accessories)
		}).then(this._patch.bind(this))
	}

	setAvatar(avatarId) {
		return this.client.requests.post("functions/v2:profile.setAvatar", {
			avatar: avatarId ?? this.avatar.id
		}).then(this._patch.bind(this))
	}

	/**
	 * Set interest and language
	 * @param {object} options
	 * @param {number} [options.age]
	 * @param {string} [options.gender]
	 * @returns {Promise<this>}
	 */
	setGenderAndAge({ age, gender }) {
		return this.client.requests.post("functions/v2:profile.setGenderAndAge", {
			birthDate: age ?? this.age,
			gender: gender || this.gender
		}).then(this._patch.bind(this))
	}

	/**
	 * Set interest and language
	 * @param {object} options
	 * @param {string} [options.language]
	 * @param {boolean} [options.likesMale]
	 * @param {boolean} [options.likesFemale]
	 * @returns {Promise<this>}
	 */
	setInterestAndLanguage({ likesMale, likesFemale, language }) {
		return this.client.requests.post("functions/v2:profile.setInterestAndLanguage", {
			lang: language || this.language,
			likesMale: likesMale ?? this.interests.likesMale,
			likesFemale: likesFemale ?? this.interests.likesFemale
		}).then(this._patch.bind(this))
	}

	setMood(mood) {
		return this.client.requests.post("functions/v2:profile.setMood", {
			mood: mood ?? this.mood
		}).then(r => {
			console.log(r)
			return r
		})
	}

	setPassword(password) {
		return this.client.requests.post("functions/v2:profile.setPassword", {
			password
		})
	}

	/**
	 * Set security settings
	 * @param {object} options
	 * @param {boolean} [options.acceptRandoms]
	 * @param {boolean} [options.allowUnsafeContent]
	 * @param {boolean} [options.getRandoms]
	 * @param {boolean} [options.hideMates]
	 * @param {Iterable} [options.karmaWallArtifacts]
	 * @param {number} [options.minKarma]
	 * @param {boolean} [options.scheduledDeletion] schedule account for deletion in 30 days
	 * @returns {Promise<ClientUser>}
	 */
	setSecuritySettings({ acceptRandoms, allowUnsafeContent, getRandoms, hideMates, karmaWallArtifacts, minKarma, scheduledDeletion }) {
		return this.client.requests.post("functions/v2:profile.setSecuritySettings", {
			acceptRandoms: acceptRandoms ?? this.security.acceptRandoms,
			allowUnsafeContent: allowUnsafeContent ?? this.security.allowUnsafeContent,
			deleted: scheduledDeletion ?? this.security.scheduledDeletion,
			getRandoms: getRandoms ?? this.security.getRandoms,
			hideMates: hideMates ?? this.security.hideMates,
			karmaWallArtifacts: Array.from(karmaWallArtifacts || this.karmaWallArtifacts),
			minKarma: minKarma ?? this.security.minKarma
		}).then(this._patch.bind(this))
	}

	setSuperPowers({ blessed, doubleKarma, hideVisits, highlightPrivates, showOnline } = {}) {
		return this.client.requests.post("functions/v2:profile.setSPSettings", Object.assign({}, this.superPowers, {
			blessed,
			doubleKarma,
			hideVisits,
			highlightPrivates,
			showOnline
		})).then(this._patch.bind(this))
	}

	setUserData(options) {
		return this.client.requests.post("functions/v2:profile.setUserData", options).then(this._patch.bind(this))
	}

	/**
	 * Soft delete your account
	 * @returns {<Promise<boolean>>}
	 */
	softDelete() {
		return this.client.requests.post("functions/v2:profile.softDelete")
	}

	/**
	 * Update your data
	 * @param {object} options
	 * @param {string} options.description
	 * @param {string} options.profileName
	 * @returns {Promise<this>}
	 */
	update(options) {
		return this.client.requests.post("functions/v2:profile.update", Object.assign({
			aboutMe: this.description
		}, options)).then(this._patch.bind(this))
	}

	updatePrivateChannel(rollback) {
		return this.client.requests.post("functions/v2:profile.updatePrivateChannel", {
			rollback: Boolean(rollback)
		}).then(this._patch.bind(this))
	}

	setHumanLink(vanity) {
		return this.client.requests.post("functions/v2:profile.setHumanLink", {
			humanLink: vanity ?? this.login
		}).then(this._patch.bind(this))
	}

	unsetHumanLink() {
		return this.client.requests.post("functions/v2:profile.unsetHumanLink")
	}
}