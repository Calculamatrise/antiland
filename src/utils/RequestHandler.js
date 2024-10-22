import { METHODS } from "http";

import AntilandAPIError from "../utils/AntilandAPIError.js";

export default class {
	constructor(client) {
		Object.defineProperty(this, 'client', { value: client });
		for (const METHOD of METHODS.filter(METHOD => !this.hasOwnProperty(METHOD.toLowerCase()))) {
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

	async request() {
		for (let i in arguments) {
			if (typeof arguments[i] == 'object' && arguments[i] !== null) {
				let headers = new Headers(arguments[i].headers);
				this.client.token && headers.append('X-Parse-Session-Token', this.client.token),
				typeof arguments[i].body == 'object' && arguments[i].body !== null && Object.assign(arguments[i].body, { localization: this.client.options.localization }),
				Object.assign(arguments[i], { debug: this.client.listenerCount('debug') > 0, headers })
			}
		}
		return this.constructor.request(...arguments)
	}

	static config = null;
	static domain = "mobile-elb.antich.at";
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

	static async request(url, options = typeof url == 'object' ? url : {}, token) {
		let debug = options.debug
		  , domain = options.domain || this.domain
		  , path = options.path || url
		  , method = String(options.method || 'GET')
		  , headers = new Headers(options.headers);
		headers.append("Content-Type", "application/json; charset=utf-8");
		if (token || headers.has('X-Parse-Session-Token')) {
			let config = await this.fetchConfig();
			headers.append('X-Parse-Application-Id', config.appId);
			typeof token == 'string' && headers.append('X-Parse-Session-Token', token);
		}
		return fetch("https://" + domain + "/" + path, options = {
			headers,
			body: method.toUpperCase() != 'GET' ? JSON.stringify(Object.assign({}, {
				version: "web/chat/2.0"
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
			debug && console.log('\x1b[32m' + '[RequestHandler]', method.toUpperCase(), path + '\x1b[0m');
			return r.result ?? r
		}).catch(err => {
			debug && console.trace('\x1b[31m' + '[RequestHandler]', method.toUpperCase(), path + '\x1b[0m', '\x1b[2m' + err.code + '\x1b[0m'); // console.error('[RequestHandler]', method.toUpperCase(), path);
			throw err
		})
	}
}