import type { Bus } from '../event.js'

export interface OnEventWarningHandler {
	(from: 'emit', ctx: { type: 'notExist'; name: string | symbol; args: any[] }): void
	(from: 'emitTry', ctx: { type: 'notExist' | 'error'; name: string | symbol; args: any[] }): void
	(from: 'emitAsync', ctx: { type: 'notExist'; name: string | symbol; args: any[] }): void
	(from: 'emitTryAsync', ctx: { type: 'notExist' | 'error'; name: string | symbol; args: any[] }): void
	(from: 'emitConcurrencyAsync', ctx: { type: 'notExist' | 'error'; name: string | symbol; args: any[] }): void
	(from: 'off', ctx: { type: 'notExist' | 'typeError'; name: string | symbol; ref: symbol | EventCallback }): void
	(from: 'offRef', ctx: { type: 'notExist' | 'typeError'; ref: symbol | EventCallback }): void
	(from: 'hasCallback', ctx: { type: 'typeError'; name: string | symbol; ref: symbol | EventCallback }): void
	(from: 'hasRef', ctx: { type: 'typeError'; ref: symbol | EventCallback }): void
}

/** 配置选项 */
export interface EventOptions<E extends EventMapOption<E>> {
	/** 事件配置对象, key 为事件名, 支持 symbol */
	events?: E
	/** 事件 map, 传递 map 实例将直接操作此 map */
	eventMap?: EventMap<E>
	/** 实例上下文, 通过该钩子可以最大限度操作 EventBus 的实例 */
	ctx?: (this: Bus<E>, ctx: EventCtx<E, EventMap<E>>) => void
	/** 当事件处理警告时(事件不存在)的处理器 */
	onWarning?: OnEventWarningHandler
}

/** 事件配置对象, key 为事件名, 支持 symbol */
export type EventMapOption<T> = {
	[K in keyof T]: EventCallback
} & {
	[k: symbol]: EventCallback
}

/** 事件回调函数 */
export interface EventCallback<Self = Bus<any>, Return = any> {
	(this: Self, ...args: any[]): Return
}

/** 根据事件名称推导对应的回调类型, 名称不属于 E 时退化为通用回调 */
export type EventCallbackOf<E extends EventMapOption<E>, K extends string | symbol> = K extends keyof E
	? (this: Bus<E>, ...args: Parameters<E[K]>) => ReturnType<E[K]>
	: EventCallback<Bus<E>>

/** 根据事件名称推导对应的参数元组, 名称未确定或不属于 E 时退化为 any[] */
export type EventArgsOf<E extends EventMapOption<E>, K extends string | symbol> = string extends K
	? any[]
	: symbol extends K
		? any[]
		: K extends keyof E
			? Parameters<E[K]>
			: any[]

export type EventMap<T = any> = Map<keyof T, EventCallbackInfo[]>

export interface EventCallbackInfo {
	once: boolean
	ref: symbol
	fn: EventCallback
}

export interface EventCtx<E extends EventMapOption<E>, EM extends EventMap> {
	/** 事件 map */
	eventMapInstance: EM
	/** 实例引用 */
	self: Bus<E>
}

/** 事件回调函数配置选项 */
export interface CallbackOptions {
	/** 是否只执行一次 */
	once?: boolean
	/** 自定义标识 */
	ref?: symbol
	/** 事件回调 */
	fn: EventCallback
}

/** 注册事件配置选项 */
export interface OnOptions {
	/** 自定义标识 */
	ref?: symbol
}
