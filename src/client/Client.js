import BaseClient from "./BaseClient.js";
import CallManager from "../managers/CallManager.js";
import DialogueManager from "../managers/DialogueManager.js";
import GroupManager from "../managers/GroupManager.js";
import StickerManager from "../managers/StickerManager.js";
import UserManager from "../managers/UserManager.js";

export default class Client extends BaseClient {
	calls = new CallManager(this);
	dialogues = new DialogueManager(this);
	groups = new GroupManager(this);
	stickers = new StickerManager(this);
	users = new UserManager(this);
}