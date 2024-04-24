const shortcuts = new Set();
shortcuts.add('g');
self.addEventListener('fetch', function (event) {
	const requestURL = new URL(event.request.url);
	if (requestURL.host !== location.host) return;
	for (let shortcut of shortcuts.values()) {
		let regex = new RegExp('(?<=/)' + shortcut + '/(\\w+)\/?$', 'i');
		if (!regex.test(event.request.referrer) && !regex.test(requestURL.pathname)) continue;
		event.preventDefault();
		if (regex.test(requestURL.pathname)) {
			requestURL.pathname = requestURL.pathname.replace(regex, id => {
				requestURL.searchParams.set(shortcut, id);
				return '';
			});
			return event.respondWith(fetch(requestURL.toString()));
		}

		if (!event.request.referrer) return;
		let referrerURL = new URL(event.request.referrer);
		if (regex.test(referrerURL)) {
			let basePathname = referrerURL.pathname.replace(regex, '');
			let shortcutPath = referrerURL.pathname.replace(basePathname, '');
			let depth = shortcutPath.match(/\//g);
			let referrerRegex = new RegExp('(?<=' + basePathname.replace(/\/$/, '') + ')/(?!' + shortcut + '/(\\w+)\/?)', 'i');
			requestURL.pathname = requestURL.pathname.replace(referrerRegex, depth.join('..'));
			requestURL.pathname = requestURL.pathname.replace(new RegExp('(?<=/)' + shortcut + '/' + (depth.length > 1 ? '(\\w+)\/?' : ''), 'i'), '');
			return event.respondWith(fetch(requestURL.toString()));
		}
	}
});