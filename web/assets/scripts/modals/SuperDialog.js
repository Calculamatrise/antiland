export default class SuperDialog extends HTMLDialogElement {
	actions = [];
	content = this.appendChild(document.createElement('p'));
	form = this.appendChild(document.createElement('form'));
	title = null;
	constructor() {
		super();
		this.setAttribute('is', 'super-dialog');
		this.addEventListener('close', this.remove, { once: true });
	}

	/**
	 * Add action button
	 * @param {object} data
	 * @param {string} data.name
	 * @param {Array} [data.styles]
	 * @param {string} [data.type]
	 */
	addActionButton(data) {
		let type = typeof data.type == 'string' && data.type.toLowerCase() || 'button';
		let element = this.form.appendChild(document.createElement(type));
		this.actions.push(data);
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
		typeof data.click != 'function' && element.setAttribute('formmethod', 'dialog');
		element.innerText = data.name;
		typeof data.callback == 'function' && data.callback(element);
		return element;
	}

	setTitle(title) {
		if (null === this.title) {
			this.title = document.createElement('h3');
			this.prepend(this.title);
		}
		this.title.innerText = title;
	}

	setMessage(message) {
		this.content.innerText = message;
	}

	/**
	 * Create a super dialog instance
	 * @param {string} message
	 * @param {Array} [elements]
	 * @param {object} [options]
	 * @param {string} [options.title]
	 * @returns {SuperDialog}
	 */
	static create(message, elements, { title } = {}) {
		let temp = new this();
		if (elements && typeof elements[Symbol.iterator] == 'function') {
			for (let option of elements) {
				temp.addActionButton(option);
			}
		} else {
			let close = temp.form.appendChild(document.createElement('button'));
			close.setAttribute('formmethod', 'dialog');
			close.innerText = 'Close';
		}
		typeof title == 'string' && this.setTitle();
		temp.setMessage(message);
		return document.body.appendChild(temp);
	}

	static error(err, callback) {
		let temp = this.create(err.message || err, [{
			name: 'Dismiss'
		}]);
		temp.classList.add('error');
		temp.showModal();
		typeof callback == 'function' && temp.addEventListener('close', callback, { once: true });
		return temp;
	}
}

customElements.define('super-dialog', SuperDialog, {
	extends: 'dialog'
});