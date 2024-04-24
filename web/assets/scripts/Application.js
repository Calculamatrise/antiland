import EventEmitter from "./EventEmitter.js";

export default class Application extends EventEmitter {
	constructor() {
		super();
	}

	#errcontainer = null;
	#errmsg = null;
	showError(message, callback) {
		this.#errcontainer ||= document.querySelector('.error-container');
		this.#errmsg ||= this.#errcontainer.querySelector('#errmsg');
		this.#errmsg.innerText = message;
		typeof callback == 'function' && this.#errcontainer.addEventListener('close', callback, { once: true });
		this.#errcontainer.showModal();
		return new Promise(resolve => this.#errcontainer.addEventListener('close', resolve, { once: true }));
	}

	static _scriptPath = "assets/scripts/";
	static _styleLink = null;
	static _stylePath = "assets/styles/";
	static accentColor = null;
	static cacheKey = 'al_session_cache';
	static colorScheme = 'auto';
	static colorSchemeOptions = ['auto', 'dark', 'light'];
	static name = 'AntiLand';
	static shortcuts = new Set('g');
	static searchParams = new URLSearchParams(location.search + Array.from(this.shortcuts.values()).reduce((params, shortcut) => {
		let match = location.pathname.match(new RegExp('(?<=/' + shortcut + '/)([^/]+)', 'gi'), '$1');
		if (match === null) return params;
		params.push(shortcut + '=' + match[0]);
		params.length === 1 && params.unshift('');
		return params;
	}, []).join('&'));
	static applyColorScheme() {
		let correspondingStylePath = this.getStylePath(this.getColorScheme());
		if (!(this._styleLink instanceof HTMLLinkElement)) {
			this._styleLink = document.head.appendChild(document.createElement('link'));
			this._styleLink.setAttribute('rel', 'stylesheet');
		}
		this._styleLink.setAttribute('href', correspondingStylePath);
	}

	static getColorScheme(preferred) {
		let colorScheme = this.colorScheme; // get cached result from localStorage
		if (!colorScheme || colorScheme === 'auto' || preferred) {
			const { matches } = window.matchMedia("(prefers-color-scheme: dark)");
			colorScheme = matches ? 'dark' : 'light';
		}
		return colorScheme;
	}

	static getStylePath(script) {
		return this._scriptPath + script + '.js';
	}

	static getStylePath(style) {
		return this._stylePath + style + '.css';
	}

	static setColorScheme(colorScheme) {
		if (!colorScheme || !this.colorSchemeOptions.includes(colorScheme)) {
			throw new RangeError(colorScheme + " is not a valid option.");
		}
		this.colorScheme = colorScheme;
		this.emit('colorSchemeUpdate', colorScheme);
		return colorScheme;
	}

	static showError(message, callback) {
		const errorContainer = document.querySelector('.error-container');
		const errmsg = errorContainer.querySelector('#errmsg');
		errmsg.innerText = message;
		typeof callback == 'function' && errorContainer.addEventListener('close', callback, { once: true });
		errorContainer.showModal();
		return new Promise(resolve => errorContainer.addEventListener('close', resolve, { once: true }));
	}
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
	const newColorScheme = event.matches ? 'dark' : 'light';
	// Check if there is a saved/cached preference
	Application.setColorScheme(newColorScheme);
});