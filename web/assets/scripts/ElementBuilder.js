export default class ElementBuilder {
	create(tagName, options) {
		let element = document.createElement(tagName);
		for (let key in options) {
			switch(key) {
			case 'children':
				for (let child of options[key]) {
					element.appendChild(child);
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