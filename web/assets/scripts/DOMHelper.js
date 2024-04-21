export default class DOMHelper {
	/**
	 * 
	 * @param {string} tagName
	 * @param {object} [options]
	 * @param {Array<HTMLElement>} [options.children]
	 * @param {Array<string>} [options.classList]
	 * @param {object} [options.style]
	 * @param {Array<string>} [options.styles]
	 * @returns {HTMLElement}
	 */
	static create(tagName, options) {
		let element = document.createElement(tagName);
		this.update(element, options);
		return element;
	}

	static update(element, options) {
		for (let key in options) {
			switch(key) {
			case 'children':
				for (let child of options[key]) {
					element.appendChild(child);
				}
				break;
			case 'classList':
			case 'styles':
				for (let className of options[key]) {
					element.classList.add(className);
				}
				break;
			case 'data':
			case 'dataset':
				for (let id in options[key]) {
					element.dataset[id] = options[key][id];
				}
				break;
			case 'style':
				for (let prop in options[key]) {
					element.style.setProperty(prop, options[key][prop]);
				}
				break;
			default:
				element[key] = options[key];
				continue;
			}
		}
		return element;
	}
}