import type Bus from '../index.js'

interface EventCallback {
	(from: 'emit', type: 'notExist' | 'execError', eventName: string | symbol, args: any[]): void
	(from: 'emitAwait', type: 'notExist' | 'execError', eventName: string | symbol, args: any[]): void
	(from: 'emitLineUp', type: 'notExist', eventName: string | symbol, args: any[]): void
	(from: 'emitLineUpCaptureErr', type: 'notExist', eventName: string | symbol, args: any[]): void
	(from: 'off', type: 'notExist', eventName: string | symbol, ref: symbol | Callback): void
}

/** 配置选项 */
export interface Options<E extends EventMapOption<E>> {
	/** 事件配置对象, key 为事件名, 支持 symbol */
	events?: E
	/** 事件 map, 传递 map 实例将直接操作此 map */
	eventMap?: EventMap<E>
	/** 实例上下文, 通过该钩子可以最大限度操作 EventBus 的实例 */
	ctx?: (this: Bus<E>, ctx: EventCtx<E, EventMap<E>>) => void
	onError?: EventCallback
	onWarning?: EventCallback
}

/** 事件配置对象, key 为事件名, 支持 symbol */
export type EventMapOption<T> = {
	[K in keyof T]: Callback
} & {
	[k: symbol]: Callback
}

/** 事件回调函数 */
export interface Callback<Self = Bus<any>, Return = any> {
	(this: Self, ...args: any[]): Return
}

export type EventMap<T = any> = Map<keyof T, CallbackInfo[]>

export interface CallbackInfo {
	once: boolean
	sign: symbol
	fn: Callback
}

export interface EventCtx<E extends EventMapOption<E>, EM extends EventMap> {
	/**
	 * @deprecated 请直接操作 eventMapInstance
	 * - 事件 map 的代理对象
	 * - 仅为向后兼容，请直接操作 eventMapInstance
	 */
	eventMap: Record<keyof E, CallbackInfo[]>
	/** 事件 map */
	eventMapInstance: EM
	/** 实例引用 */
	self: Bus<E>
	/** 设置实例属性 */
	setSelf(key: string | symbol, value: any): any
	/**
	 * @deprecated 请直接操作 eventMapInstance
	 * - 清除一个事件
	 * @param eventName 事件名称
	 */
	clear(eventName: string | symbol): void
	/**
	 * @deprecated 请直接操作 eventMapInstance
	 * - 清除一个事件
	 * @param eventName 事件名称
	 */
	clear(eventName: keyof E): void
	/**
	 * @deprecated 请直接操作 eventMapInstance
	 * - 清除一个事件
	 * @param eventName 事件名称
	 */
	clear(eventName: string | symbol): void
	/**
	 * @deprecated 请直接操作 eventMapInstance
	 * - 清除所有事件
	 */
	clearAll(): void
}

/** 事件回调函数配置选项 */
export interface CallbackOptions {
	/** 是否只执行一次 */
	once?: boolean
	/** 自定义标识 */
	sign?: symbol
	/** 事件回调 */
	fn: Callback
}

/** 注册事件配置选项 */
export interface OnOptions {
	/** 自定义标识 */
	sign?: symbol
}
