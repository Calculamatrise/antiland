import User from "./User.js";
import ClientFriendManager from "../managers/ClientFriendManager.js";
import ClientStickerManager from "../managers/ClientStickerManager.js";
import ContactManager from "../managers/ContactManager.js";
import FavoriteManager from "../managers/FavoriteManager.js";
import ClientPresenceManager from "../managers/ClientPresenceManager.js";
import TaskManager from "../managers/TaskManager.js";

export default class ClientUser extends User {
	blockedBy = new Set();
	channelId = null;
	contacts = new ContactManager(this);
	// email = null;
	favorites = new FavoriteManager(this);
	friends = new ClientFriendManager(this);
	hexAccentColor = null;
	messages = new Map(); // private message manager
	presence = new ClientPresenceManager(this);
	// settings = {}; /* add user settings, content settings,
	// security settings, minkarma, etc.?? */
	stickers = new ClientStickerManager(this);
	tasks = new TaskManager(this);
	constructor(data) {
		Object.defineProperties(super(...arguments, { skipPatch: true }), {
			referrerId: { value: null, writable: true }
		}),
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
				super._patch({ hexColor: data[key] });
				break;
			case 'blockedBy':
				// if blockedBy included 'all', client is in prison.
				this[key] = new Set(data[key]);
				break;
			case 'contentSettings':
				this[key] = Object.assign({}, this[key], data[key]);
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

	/**
	 * Fetch content settings
	 * @param {object} [options]
	 * @param {boolean} options.force
	 * @returns {Promise<object>}
	 */
	async fetchContentSettings({ force } = {}) {
		if (!force && this.contentSettings) {
			return this.contentSettings;
		}
		return this.client.rest.post("functions/v2:profile.me.contentSettings").then(res => {
			this._patch({ contentSettings: res });
			return this.contentSettings
		})
	}

	/**
	 * Fetch security settings
	 * @param {object} [options]
	 * @param {boolean} options.force
	 * @returns {Promise<object>}
	 */
	async fetchSecuritySettings({ force } = {}) {
		if (!force && this.settings) {
			return this.settings;
		}
		return this.client.rest.post("functions/v2:profile.me.security").then(res => {
			this._patch({ security: res });
			return this.security
		})
	}

	/**
	 * Fetch visitors ← COSTS KARMA
	 * @param {object} [options]
	 * @param {boolean} options.force
	 * @returns {Promise<unknown>}
	 */
	async fetchVisitors({ force } = {}) {
		return this.client.rest.post("functions/v2:profile.visitor.list").then(r => {
			console.log(r) // cache settings // this._patch;
			return r
		})
	}

	generateToken() {
		return this.client.rest.post("functions/v2:profile.authToken.create").then(r => {
			console.log(r);
			return r
		})
	}

	/**
	 * Get your human link
	 * @param {options} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<string>}
	 */
	async getHumanLink({ force } = {}) {
		if (!force && this.humanLink) {
			return this.humanLink;
		}
		return this.client.rest.post("functions/v2:profile.getHumanLink").then(({ link }) => this.humanLink = link)
	}

	/**
	 * Purchase a free super-power trial with karma
	 * @returns {Promise<unknown>}
	 */
	purchaseSuperPowers() {
		return this.client.rest.post("functions/v2:purchase.spTrial").then(r => {
			this.client.debug && console.log(r);
			this.client.emit('debug', { event: "PurchaseSPTrial", result: r });
			return r
		})
	}

	/**
	 * Set your accessories
	 * @param {Iterable} accessories
	 * @returns {Promise<ClientUser>}
	 */
	setAccessories(accessories) {
		return this.client.rest.post("functions/v2:profile.setAccessories", {
			accessories: Array.from(accessories || this.avatar.accessories)
		}).then(this._patch.bind(this))
	}

	/**
	 * Set your avatar
	 * @param {number} avatarId
	 * @returns {Promise<ClientUser>}
	 */
	setAvatar(avatarId) {
		return this.client.rest.post("functions/v2:profile.setAvatar", {
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
		return this.client.rest.post("functions/v2:profile.setGenderAndAge", {
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
		return this.client.rest.post("functions/v2:profile.setInterestAndLanguage", {
			lang: language || this.language,
			likesMale: likesMale ?? this.interests.likesMale,
			likesFemale: likesFemale ?? this.interests.likesFemale
		}).then(this._patch.bind(this))
	}

	/**
	 * Set your mood?
	 * @param {string} mood
	 * @returns {Promise<unknown>}
	 */
	setMood(mood) {
		return this.client.rest.post("functions/v2:profile.setMood", {
			mood: mood ?? this.mood
		}).then(r => {
			console.log(r)
			return r
		})
	}

	/**
	 * Set your account password
	 * @param {string} password
	 * @returns {Promise<boolean>}
	 */
	setPassword(password) {
		return this.client.rest.post("functions/v2:profile.setPassword", {
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
		return this.client.rest.post("functions/v2:profile.setSecuritySettings", {
			acceptRandoms: acceptRandoms ?? this.security.acceptRandoms,
			allowUnsafeContent: allowUnsafeContent ?? this.security.allowUnsafeContent,
			deleted: scheduledDeletion ?? this.security.scheduledDeletion,
			getRandoms: getRandoms ?? this.security.getRandoms,
			hideMates: hideMates ?? this.security.hideMates,
			karmaWallArtifacts: Array.from(karmaWallArtifacts || this.karmaWallArtifacts),
			minKarma: minKarma ?? this.security.minKarma
		}).then(this._patch.bind(this))
	}

	/**
	 * Configure your super-powers
	 * @param {object} [options]
	 * @param {boolean} [options.blessed]
	 * @param {boolean} [options.doubleKarma]
	 * @param {boolean} [options.hideVisits]
	 * @param {boolean} [options.highlightPrivates]
	 * @param {boolean} [options.showOnline]
	 * @returns {Promise<ClientUser>}
	 */
	setSuperPowers({ blessed, doubleKarma, hideVisits, highlightPrivates, showOnline } = {}) {
		return this.client.rest.post("functions/v2:profile.setSPSettings", Object.assign({}, this.superPowers, {
			blessed,
			doubleKarma,
			hideVisits,
			highlightPrivates,
			showOnline
		})).then(this._patch.bind(this))
	}

	/**
	 * Set user data
	 * @param {object} [options]
	 * @returns {Promise<ClientUser>}
	 */
	setUserData(options) {
		return this.client.rest.post("functions/v2:profile.setUserData", options).then(this._patch.bind(this))
	}

	/**
	 * Soft delete your account
	 * @returns {Promise<boolean>}
	 */
	softDelete() {
		return this.client.rest.post("functions/v2:profile.softDelete")
	}

	/**
	 * Update your data
	 * @param {object} [options]
	 * @param {string} [options.description]
	 * @param {string} [options.profileName]
	 * @returns {Promise<this>}
	 */
	update(options) {
		return this.client.rest.post("functions/v2:profile.update", Object.assign({
			aboutMe: this.description
		}, options)).then(this._patch.bind(this))
	}

	/**
	 * Update your private channel ID
	 * @param {boolean} [rollback]
	 * @returns {Promise<ClientUser>}
	 */
	updatePrivateChannel(rollback) {
		return this.client.rest.post("functions/v2:profile.updatePrivateChannel", {
			rollback: Boolean(rollback ?? this.channelId !== this.id)
		}).then(this._patch.bind(this))
	}

	/**
	 * Set a vanity URL for your profile
	 * @param {string} [vanity] defaults to login username
	 * @returns {Promise<ClientUser>}
	 */
	setHumanLink(vanity) {
		return this.client.rest.post("functions/v2:profile.setHumanLink", {
			humanLink: vanity ?? this.login
		}).then(this._patch.bind(this))
	}

	/**
	 * Unset the vanity URL for your profile
	 * @returns {Promise<unknown>}
	 */
	unsetHumanLink() {
		return this.client.rest.post("functions/v2:profile.unsetHumanLink")
	}
}