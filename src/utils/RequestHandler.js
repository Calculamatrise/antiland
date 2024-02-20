import { METHODS } from "http";

export default class {
	static config = null;
	static domain = "mobile-elb.antich.at";
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

	async fetchConfigBody() {
		return Object.assign(await this.constructor.fetchConfigBody(), this.#sessionToken && {
			_SessionToken: this.#sessionToken
		})
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

	static async fetchConfig({ force } = {}) {
		if (force || !this.config) {
			this.config = await this.request("chat/static/config.json", {
				domain: 'www.antiland.com'
			}).then(data => {
				this.domain ||= data.parse.server;
				return Object.assign({
					appId: "fUEmHsDqbr9v73s4JBx0CwANjDJjoMcDFlrGqgY5",
					server: "https://mobile-elb.antich.at",
					version: 10001
				}, data.parse, { pubnub: data.pubnub })
			})
		}
		return this.config
	}

	static async fetchConfigBody() {
		let config = await this.fetchConfig();
		return {
			_ApplicationId: config.appId,
			_ClientVersion: "js1.11.1",
			_InstallationId: "e939ca3e-3d6a-c720-b32e-8318b328a8ff",
			_method: "GET"
		}
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
		return fetch("https://" + domain + "/" + path, {
			headers,
			body: method.toUpperCase() != 'GET' ? JSON.stringify(Object.assign({}, {
				version: "web/chat/2.0"
			}, options.body)) : null,
			method
		}).then(r => r.json()).then(r => {
			if (r.error) {
				throw new Error(typeof r.error == 'object' ? r.error.message : r.error)
			}
			return r.result ?? r
		})
	}
}