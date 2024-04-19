export default class ContextMenuBuilder {
	static contextMenu = null;
	static create(options, { clientX, clientY } = {}) {
		if (!this.contextMenu) {
			this.contextMenu = document.createElement('div');
			this.contextMenu.classList.add('context-menu');
			this.contextMenu.addEventListener('contextmenu', event => event.preventDefault());
			this.contextMenu.addEventListener('click', () => {
				this.contextMenu.remove();
				this.contextMenu = null;
			}, { once: true });
		} else {
			this.contextMenu.replaceChildren();
		}

		this.contextMenu.style.setProperty('left', clientX + 'px');
		this.contextMenu.style.setProperty('top', clientY + 'px');
		for (let option of options) {
			let type = typeof option.type == 'string' && option.type.toLowerCase() || 'button';
			let opt = this.contextMenu.appendChild(document.createElement(type));
			if (/^(b|h)r$/i.test(type)) continue;
			option.hasOwnProperty('styles') && opt.classList.add(...Array.from(option.styles));
			option.hasOwnProperty('disabled') && (opt.disabled = option.disabled);
			opt.innerText = option.name;
			typeof option.callback == 'function' && option.callback(opt);
			for (let key in option) {
				if (typeof option[key] != 'function' || opt['on' + key] === undefined) continue;
				opt.addEventListener(key, option[key]);
			}
		}

		document.body.appendChild(this.contextMenu);
		if (clientX + this.contextMenu.clientWidth > window.innerWidth) {
			this.contextMenu.style.setProperty('left', (clientX - this.contextMenu.clientWidth) + 'px');
		}

		if (clientY + this.contextMenu.clientHeight > window.innerHeight) {
			this.contextMenu.style.setProperty('top', (clientY - this.contextMenu.clientHeight) + 'px');
		}

		return this.contextMenu;
	}
}

window.addEventListener('blur', () => {
	if (!ContextMenuBuilder.contextMenu) return;
	ContextMenuBuilder.contextMenu.remove();
	ContextMenuBuilder.contextMenu = null;
});
window.addEventListener('pointerdown', event => {
	if (!ContextMenuBuilder.contextMenu || null !== event.target.closest('.context-menu')) return;
	ContextMenuBuilder.contextMenu.remove();
	ContextMenuBuilder.contextMenu = null;
});