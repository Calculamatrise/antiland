import User from "./User.js";
import ClientFriendManager from "../managers/ClientFriendManager.js";
import ContactManager from "../managers/ContactManager.js";
import FavoriteManager from "../managers/FavoriteManager.js";
import TaskManager from "../managers/TaskManager.js";
import UserStickerManager from "../managers/UserStickerManager.js";

export default class ClientUser extends User {
	blockedBy = new Set();
	contacts = new ContactManager(this);
	favorites = new FavoriteManager(this);
	friends = new ClientFriendManager(this);
	messages = new Map(); // private message manager
	stickers = new UserStickerManager(this);
	tasks = new TaskManager(this);
	_update(data) {
		if (typeof data != 'object' || data == null) return;
		super._update(...arguments);
		for (let key in data) {
			switch (key) {
			case 'antiTokens':
			case 'country':
			case 'phone':
			case 'replyRate':
				this[key] = data[key];
				break;
			case 'auth':
				let auth = data[key];
				for (let key in auth) {
					switch(key) {
					case 'channelId':
						this.privateChannelId = auth[key];
					case 'email':
					case 'emailIsVerified':
					case 'referrerId':
					case 'username':
						this[key] = auth[key]
					}
				}
				break;
			case 'avgRating':
				this.averageRating = data[key];
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
			case 'userLangs':
				this.userLanguages = new Set(data[key]);
				break;
			case 'likesFemale':
			case 'likesMale':
				this.interests ||= {};
				this.interests[key] = data[key];
				break;
			case 'msgCount':
				this.messageCount = data[key];
				break;
			case 'pvtChannelId':
				this.privateChannelId = data[key];
				break;
			case 'security':
				this.security = Object.assign({}, this[key]);
				let meta = data[key];
				for (let key in meta) {
					switch(key) {
						case 'acceptRandoms':
						case 'allowUnsafeContent':
						case 'getRandoms':
						case 'hideMates':
						case 'minKarma':
							this.security[key] = meta[key];
						case 'karmaWallArtifacts': // change to this.artifacts.karmaWall // ???
							this[key] = meta[key];
							break;
						case 'deleted':
							this.security.isScheduledForDeletion = meta[key];
							this.isScheduledForDeletion = meta[key];
					}
				}
				// this[key] = Object.assign({}, this[key], data[key]);
				// this[key] = new Map(Object.entries(data[key]));
				break;
			case 'sp':
				this.superPowers = Object.assign({}, this.superPowers, data[key]);
				break;
			case 'stickerSets':
				this.stickerSets = data[key]; // new Set(data[key]);
				break;
			case 'lastOpen':
			case 'more':
			case 'lastChangeDate':
			// default:
				this.extra ??= {};
				Object.assign(this.extra, {
					[key]: data[key]
				})
			}
		}
		return this
	}

	async fetchContentSettings() {
		if (!force && this.contentSettings) {
			return this.contentSettings;
		}
		return this.client.requests.post("functions/v2:profile.me.contentSettings").then(r => {
			console.log(r) // cache settings // this._update;
			return r
		})
	}

	async fetchSecuritySettings({ force } = {}) {
		if (!force && this.settings) {
			return this.settings;
		}
		return this.client.requests.post("functions/v2:profile.me.security").then(r => {
			console.log(r) // cache settings // this._update;
			return r
		})
	}

	async fetchVisitors({ force } = {}) {
		return this.client.requests.post("functions/v2:profile.visitor.list").then(r => {
			console.log(r) // cache settings // this._update;
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
		}).then(r => {
			console.log(r)
			return r
		})
	}

	setAvatar(avatarId) {
		return this.client.requests.post("functions/v2:profile.setAvatar", {
			avatar: avatarId ?? this.avatar.id
		}).then(r => {
			console.log(r)
			return r
		})
	}

	/**
	 * Set interest and language
	 * @param {object} options
	 * @param {number} [options.age]
	 * @param {string} [options.gender]
	 * @returns {Promise<this>}
	 */
	setGenderAndAage({ age, gender }) {
		return this.client.requests.post("functions/v2:profile.setGenderAndAge", {
			birthDate: age ?? this.age,
			gender: gender || this.gender
		}).then(this._update.bind(this))
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
		}).then(this._update.bind(this))
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

	setSecuritySettings({ acceptRandoms, allowUnsafeContent, deleted, getRandoms, hideMates, karmaWallArtifacts, minKarma }) {
		return this.client.requests.post("functions/v2:profile.setSecuritySettings", {
			acceptRandoms: acceptRandoms ?? this.security.acceptRandoms,
			allowUnsafeContent: allowUnsafeContent ?? this.security.allowUnsafeContent,
			deleted: deleted ?? this.security.isScheduledForDeletion,
			getRandoms: getRandoms ?? this.security.getRandoms,
			hideMates: hideMates ?? this.security.hideMates,
			karmaWallArtifacts: Array.from(karmaWallArtifacts || this.karmaWallArtifacts),
			minKarma: minKarma ?? this.security.minKarma
		}).then(this._update.bind(this))
	}

	setSuperPowers({ blessed, doubleKarma, hideVisits, highlightPrivates, showOnline } = {}) {
		return this.client.requests.post("functions/v2:profile.setSPSettings", Object.assign({}, this.superPowers, {
			blessed,
			doubleKarma,
			hideVisits,
			highlightPrivates,
			showOnline
		})).then(this._update.bind(this))
	}

	setUserData(options) {
		return this.client.requests.post("functions/v2:profile.setUserData", options).then(this._update.bind(this))
	}

	update(options) {
		return this.client.requests.post("functions/v2:profile.update", Object.assign({
			aboutMe: this.description
		}, options)).then(this._update.bind(this))
	}

	updatePrivateChannel(rollback) {
		return this.client.requests.post("functions/v2:profile.updatePrivateChannel", {
			rollback: Boolean(rollback)
		}).then(this._update.bind(this))
	}

	setHumanLink(login) {
		return this.client.requests.post("functions/v2:profile.setHumanLink", {
			humanLink: login ?? this.login
		}).then(this._update.bind(this))
	}

	unsetHumanLink() {
		return this.client.requests.post("functions/v2:profile.unsetHumanLink")
	}
}