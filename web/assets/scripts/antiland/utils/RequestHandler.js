const METHODS = ['GET', 'POST'];

import AntilandAPIError from "../../../../../src/utils/AntilandAPIError.js";

export default class {
	#sessionToken = null;
	constructor() {
		for (const METHOD of METHODS) {
			if (this.hasOwnProperty(METHOD.toLowerCase())) continue;
			Object.defineProperty(this, METHOD.toLowerCase(), {
				value(url, body, requireApplicationId = typeof body == 'boolean' ? body : null) {
					return this.request(String(url), {
						body: typeof body == 'boolean' ? null : body,
						method: METHOD
					}, requireApplicationId)
				}
			})
		}
	}

	async attachToken(token) {
		return this.constructor.request("functions/v2:profile.me", {
			method: 'POST'
		}, token).then(data => {
			data.auth && data.auth.sessionToken && (this.#sessionToken = data.auth.sessionToken);
			return data
		})
	}

	fetchConfigBody() {
		return { _SessionToken: this.#sessionToken }
	}

	async request() {
		for (let i in arguments) {
			if (typeof arguments[i] == 'object' && arguments[i] !== null) {
				let headers = new Headers(arguments[i].headers);
				this.#sessionToken && headers.append('X-Parse-Session-Token', this.#sessionToken);
				Object.assign(arguments[i], { headers })
			}
		}
		return this.constructor.request(...arguments)
	}

	static config = null;
	static domain = "mobile-elb.antich.at";
	static async fetchConfig({ force } = {}) {
		if (force || !this.config) {
			this.config = Object.assign({
				appId: "fUEmHsDqbr9v73s4JBx0CwANjDJjoMcDFlrGqgY5",
				server: "https://mobile-elb.antich.at",
				version: 10001
			}, await this.request("chat/static/config.json", { // get?url=www.antiland.com/chat/static/config.json
				domain: 'www.antiland.com' // anyorigin.com
			}).then(data => {
				this.domain ||= data.parse.server;
				return Object.assign({}, data.parse, { pubnub: data.pubnub })
			}).catch(err => console.warn(err)));
		}
		return this.config
	}

	static async request(url, options = typeof url == 'object' ? url : {}, token) {
		let domain = options.domain || this.domain;
		let path = options.path || url;
		let method = String(options.method || 'GET');
		let headers = new Headers(options.headers);
		headers.append("Content-Type", "application/json; charset=utf-8");
		if (token || headers.has('X-Parse-Session-Token')) {
			let config = await this.fetchConfig();
			headers.append('X-Parse-Application-Id', config.appId);
			typeof token == 'string' && headers.append('X-Parse-Session-Token', token);
		}
		return fetch("https://" + domain + "/" + path, options = {
			headers,
			body: method.toUpperCase() != 'GET' ? JSON.stringify(Object.assign({}, {
				version: "web/chat/3.0"
			}, options.body)) : null,
			method
		}).then(r => r.json()).then(r => {
			if (r.error) {
				throw new AntilandAPIError(typeof r.error == 'object' ? r.error.message : r.error, Object.assign({
					body: options.body,
					endpoint: path,
					method: options.method
				}, typeof r.error == 'object' ? r.error : r))
			}
			return r.result ?? r
		})
	}
}