export default class ContextMenu extends HTMLElement {
	#blurListener = null;
	#pointerdownListener = null;
	options = [];
	constructor() {
		super();
		this.constructor.contextMenu = this;
		this.addEventListener('contextmenu', event => event.preventDefault());
		this.addEventListener('click', this.remove, { once: true });
		window.addEventListener('blur', this.#blurListener = this.remove.bind(this), { once: true });
		window.addEventListener('pointerdown', this.#pointerdownListener = event => {
			if (null !== event.target.closest('context-menu')) return window.addEventListener('pointerdown', this.#pointerdownListener);
			this.remove();
		}, { once: true });
	}

	/**
	 * Add options
	 * @param {object} data
	 * @param {string} data.name
	 * @param {Array} [data.styles]
	 * @param {string} [data.type]
	 */
	addOption(data) {
		let type = typeof data.type == 'string' && data.type.toLowerCase() || 'button';
		let element = this.appendChild(document.createElement(type));
		this.options.push(data);
		if (/^(b|h)r$/i.test(type)) return element;
		for (let key in data) {
			if (typeof data[key] == 'function' && element['on' + key] !== undefined) {
				element.addEventListener(key, data[key]);
				continue;
			}
			switch(key) {
			case 'disabled':
				element[key] = data[key];
				break;
			case 'styles':
				element.classList.add(...Array.from(data[key].values()));
				break;
			}
		}
		element.innerText = data.name;
		typeof data.callback == 'function' && data.callback(element);
		return element;
	}

	clear() {
		this.options.splice(0);
		this.replaceChildren();
	}

	setPosition({ clientX, clientY } = {}) {
		clientX + this.clientWidth > window.innerWidth && (clientX -= this.clientWidth);
		clientY + this.clientHeight > window.innerHeight && (clientY -= this.clientHeight);
		this.style.setProperty('left', clientX + 'px');
		this.style.setProperty('top', clientY + 'px');
		return { clientX, clientY };
	}

	remove() {
		if (null === this.constructor.contextMenu) return;
		window.removeEventListener('blur', this.#blurListener);
		window.removeEventListener('pointerdown', this.#pointerdownListener);
		super.remove();
		this.constructor.contextMenu = null;
		this.dispatchEvent(new Event("close", {
			options: this.options
		}));
	}

	static contextMenu = null;
	static create(options, event) {
		if (!this.contextMenu) {
			this.contextMenu = document.createElement('context-menu');
		} else {
			this.contextMenu.clear();
		}

		for (let option of options) {
			this.contextMenu.addOption(option);
		}

		document.body.appendChild(this.contextMenu);
		this.contextMenu.setPosition(event);
		return this.contextMenu;
	}
}

customElements.define('context-menu', ContextMenu);