import ChatFlags from "./ChannelFlags.js";

export default class ChannelFlagsBitField {
	bitfield = 0;
	constructor(bits) {
		bits && (this.bitfield = bits)
	}

	/**
	 * Assert a bit
	 * @param {number|string} bit
	 * @returns {Promise<boolean>}
	 */
	has(bit) {
		typeof bit != 'number' && (bit = this.constructor.Flags[bit]);
		return (this.bitfield & bit) === bit
	}

	/**
	 * Convert channel flags to a readable list 
	 * @returns {Promise<Array<string>>}
	 */
	toArray() {
		return Object.entries(this.constructor.Flags).reduce((result, [flag, bit]) => (this.bitfield & bit) === bit ? result.concat(flag) : result, [])
	}

	static Flags = ChatFlags
}