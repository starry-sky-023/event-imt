import type { OnEventWarningHandler, OnHookWarningHandler } from '../types/index.js'

/**
 * 判断一个数据是否为数组
 */
export function isArray<T = any>(data: any): data is Array<T> {
	return Array.isArray(data)
}

/**
 * 判断一个数据是否为 function
 */
export function isFunction<T = Function>(data: any): data is T {
	return typeof data === 'function'
}

/**
 * 判断一个数据是否为对象, 排除数组和函数
 */
export function isObj<T = Record<string | symbol, any>>(data: any): data is T {
	return typeof data === 'object' && data !== null && !Array.isArray(data)
}

/**
 * 判断一个数据是否为 string
 */
export function isString(data: any): data is string {
	return typeof data === 'string'
}

/**
 * 判断一个数据是否为 symbol
 */
export function isSymbol(data: any): data is symbol {
	return typeof data === 'symbol'
}

/**
 * 判断一个数据是否为 undefined
 */
export function isUndefined(data: any): data is undefined {
	return typeof data === 'undefined'
}

/**
 * 格式化事件名, 非 string/symbol 类型将强制转换为字符串
 */
export function formatName(name: string | symbol): string | symbol {
	return isString(name) || isSymbol(name) ? name : String(name)
}

const log = (() => {
	if (typeof console !== 'undefined') {
		return console
	} else {
		return {
			warn(..._data: any[]) {}
		}
	}
})()

export function outputWarn(...data: any[]) {
	data[0] = `\x1b[33m${String(data[0])} \x1B[0m`
	log.warn(...data)
}

/** 默认的警告处理器, 事件不存在或 ref 类型有误时输出警告 */
export const eventDefaultOutputWarn: OnEventWarningHandler = (from, ctx) => {
	const { type, name, ref } = ctx as { type?: string; name?: string | symbol; ref?: unknown }

	if (type === 'typeError') {
		outputWarn(
			`event(${from}): the ref${
				isUndefined(name) ? '' : ` of event -> '${String(name)}'`
			} has an invalid type, detail info in ctx property .`,
			{ from, ctx }
		)
		return
	}

	if (type === 'error') {
		outputWarn(
			`event(${from}): exec event callback of event -> '${String(name)}' failed, detail info in ctx property .`,
			{ from, ctx }
		)
		return
	}

	if (!isUndefined(ref)) {
		outputWarn(
			`event(${from}): ref -> ${String(ref)} to event '${String(name)}' is not found, detail info in ctx property .`,
			{ from, ctx }
		)
		return
	}

	outputWarn(`event(${from}): event -> '${String(name)}' is not found, detail info in ctx property .`, { from, ctx })
}

/** 默认的警告处理器, hook 不存在或 ref 类型有误时输出警告 */
export const hookDefaultOutputWarn: OnHookWarningHandler = (from, ctx) => {
	const { type, name, ref } = ctx as { type?: string; name?: string | symbol; ref?: unknown }

	if (type === 'typeError') {
		outputWarn(
			`hook(${from}): the ref${
				isUndefined(name) ? '' : ` of hook -> '${String(name)}'`
			} has an invalid type, detail info in ctx property .`,
			{ from, ctx }
		)
		return
	}

	if (type === 'error') {
		outputWarn(
			`hook(${from}): exec hook callback of hook -> '${String(name)}' failed, detail info in ctx property .`,
			{ from, ctx }
		)
		return
	}

	if (!isUndefined(ref)) {
		outputWarn(
			`hook(${from}): ref -> ${String(ref)} to hook '${String(name)}' is not found, detail info in ctx property .`,
			{ from, ctx }
		)
		return
	}

	outputWarn(`hook(${from}): hook -> '${String(name)}' is not found, detail info in ctx property .`, { from, ctx })
}
