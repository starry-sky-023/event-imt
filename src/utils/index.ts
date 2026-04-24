import type { EventImtExecuteErrorCtx, OnExecuteErrorHandler, OnWarningHandler } from '../types/index.js'

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

export function outputWarn(...data: any[]) {
	data[0] = `\x1b[33m${String(data[0])} \x1B[0m`
	log.warn(...data)
}

export class EventImtExecuteError extends Error {
	name: string = 'EventImtExecuteError'
	ctx: EventImtExecuteErrorCtx

	constructor(message: string, ctx: EventImtExecuteErrorCtx) {
		super(message)
		this.ctx = ctx
	}
}

export function defaultOutputError(
	from: Parameters<OnExecuteErrorHandler>[0],
	type: Parameters<OnExecuteErrorHandler>[1],
	eventName: Parameters<OnExecuteErrorHandler>[2],
	args: Parameters<OnExecuteErrorHandler>[3],
	error: Parameters<OnExecuteErrorHandler>[4]
) {
	throw new EventImtExecuteError(`event-imt(${from}): exec event callback failed, detail info in ctx property .`, {
		from,
		type,
		eventName,
		args,
		error
	})
}

export const defaultOutputWarn = ((from, type, eventNameOrRef, argsOfRef) => {
	if (from === 'off') {
		outputWarn(
			`event-imt(${from}): ref -> ${String(argsOfRef)} to '${String(eventNameOrRef)}' is not found, detail info in ctx property .`,
			{
				from,
				type,
				eventName: eventNameOrRef,
				argsOfRef
			}
		)
	}
	// @ts-ignore
	else if (from === 'offBySign') {
		outputWarn(`event-imt(${from}): ref -> ${String(argsOfRef)} is not found, detail info in ctx property .`, {
			from,
			type,
			eventName: eventNameOrRef,
			argsOfRef
		})
	} else {
		outputWarn(
			`event-imt(${from}): event -> '${String(eventNameOrRef)}' is not found, detail info in ctx property .`,
			{
				from,
				type,
				eventName: eventNameOrRef,
				argsOfRef
			}
		)
	}
}) as OnWarningHandler
