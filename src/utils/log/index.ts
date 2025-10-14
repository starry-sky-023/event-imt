const log = (() => {
	if (typeof console !== 'undefined') {
		return console
	} else {
		return {
			warn(..._data: any[]) {},
			error(..._data: any[]) {}
		}
	}
})()

export function logWarn(...data: any[]) {
	data[0] = `\x1b[33m${String(data[0])} \x1B[0m`
	log.warn(...data)
}

export function logError(data: any[]) {
	throw data
}
