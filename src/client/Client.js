import BaseClient from "./BaseClient.js";
import CallManager from "../managers/CallManager.js";
import DialogueManager from "../managers/DialogueManager.js";
import GroupManager from "../managers/GroupManager.js";
import PurchaseManager from "../managers/PurchaseManager.js";
import StickerManager from "../managers/StickerManager.js";
import UserManager from "../managers/UserManager.js";

export default class Client extends BaseClient {
	calls = new CallManager(this);
	dialogues = new DialogueManager(this);
	groups = new GroupManager(this);
	purchases = new PurchaseManager(this);
	stickers = new StickerManager(this);
	users = new UserManager(this);

	async destroy() {
		await super.destroy(),
		this.calls.cache.clear(),
		this.dialogues.cache.clear(),
		this.groups.cache.clear(),
		this.stickers.cache.clear(),
		this.users.cache.clear()
	}
}