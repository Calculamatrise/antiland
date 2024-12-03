import BaseManager from "./BaseManager.js";

export default class TaskManager extends BaseManager {
	async fetch(id, { force } = {}) {
		if (!force && this.cache.size > 0) {
			if (this.cache.has(id)) {
				return this.cache.get(id);
			} else if (!id) {
				return this.cache;
			}
		}
		return this.client.client.rest.post("functions/v2:karmaTasks.all").then(async entries => {
			for (let item of entries) {
				this.cache.set(item.id, item);
			}
			return id ? this.cache.get(id) ?? null : this.cache
		})
	}

	/**
	 * Check progress for a task
	 * @returns {Promise<object>}
	 */
	async checkProgress(taskId, { force, reset } = {}) {
		if (!force && this.cache.has(taskId)) {
			return this.cache.get(taskId)
		}
		return this.client.client.rest.post("functions/v2:karmaTasks.checkProgress", {
			taskId,
			reset
		}).then(data => {
			this.cache.set(data.id, data);
			return data
		})
	}

	update(task) {
		let temp = this.cache.get(task.id);
		if (!temp) {
			this.cache.set(task.id, task);
		} else {
			Object.assign(temp, task);
		}
		return task
	}
}