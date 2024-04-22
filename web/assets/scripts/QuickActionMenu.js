export default class QuickActionMenu extends HTMLElement {
	options = [];
	constructor() {
		super();
		this.constructor.contextMenu = this;
		this.addEventListener('contextmenu', event => event.preventDefault());
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
			if (typeof data[key] == 'undefined') continue;
			if (typeof data[key] == 'function' && element['on' + key] !== undefined) {
				element.addEventListener(key, data[key]);
				continue;
			}
			switch(key) {
			case 'disabled':
				element[key] = data[key];
				break;
			case 'styles':
				if (typeof data[key][Symbol.iterator] != 'function') continue;
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

	remove() {
		if (null === this.constructor.menu) return;
		super.remove();
		this.constructor.menu = null;
	}

	static menu = null;
	static create(options, element) {
		if (!this.menu) {
			this.menu = new this();
		} else {
			this.menu.clear();
		}

		for (let option of options) {
			this.menu.addOption(option);
		}

		element.appendChild(this.menu);
		element.addEventListener('mouseleave', this.menu.remove.bind(this.menu), { once: true });
		return this.menu;
	}
}

customElements.define('quick-action-menu', QuickActionMenu);