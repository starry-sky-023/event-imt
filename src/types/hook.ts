import type { Hook } from '../index.js'

export interface OnHookWarningHandler {
	(from: 'exec', ctx: { type: 'notExist'; name: string | symbol; args: any[] }): void
	(from: 'execAsync', ctx: { type: 'notExist'; name: string | symbol; args: any[] }): void
	(from: 'execConcurrencyAsync', ctx: { type: 'notExist' | 'error'; name: string | symbol; args: any[] }): void
	(from: 'unregister', ctx: { type: 'notExist' | 'typeError'; name: string | symbol; ref: symbol | HookCallback }): void
	(from: 'unregisterRef', ctx: { type: 'notExist' | 'typeError'; ref: symbol | HookCallback }): void
	(from: 'hasCallback', ctx: { type: 'typeError'; name: string | symbol; ref: symbol | HookCallback }): void
	(from: 'hasRef', ctx: { type: 'typeError'; ref: symbol | HookCallback }): void
}

/** 配置选项 */
export interface HookOptions<H extends HookMapOption<H>> {
	/** 事件配置对象, key 为事件名, 支持 symbol */
	hooks?: H
	/** 事件 map, 传递 map 实例将直接操作此 map */
	hookMap?: HookMap<H>
	/** 实例上下文, 通过该钩子可以最大限度操作 HookBus 的实例 */
	ctx?: (this: Hook<H>, ctx: HookCtx<H, HookMap<H>>) => void
	/** 当事件处理警告时(事件不存在)的处理器 */
	onWarning?: OnHookWarningHandler
}

/** 事件配置对象, key 为事件名, 支持 symbol */
export type HookMapOption<T> = {
	[K in keyof T]: HookCallback
} & {
	[k: symbol]: HookCallback
}

/** 事件回调函数 */
export interface HookCallback<Self = Hook<any>, Return = any> {
	(this: Self, ...args: any[]): Return
}

/** 根据 hook 名称推导对应的回调类型, 名称不属于 H 时退化为通用回调 */
export type HookCallbackOf<H extends HookMapOption<H>, K extends string | symbol> = K extends keyof H
	? (this: Hook<H>, ...args: Parameters<H[K]>) => ReturnType<H[K]>
	: HookCallback<Hook<H>>

/** 根据 hook 名称推导对应的参数元组, 名称未确定或不属于 H 时退化为 any[] */
export type HookArgsOf<H extends HookMapOption<H>, K extends string | symbol> = string extends K
	? any[]
	: symbol extends K
		? any[]
		: K extends keyof H
			? Parameters<H[K]>
			: any[]

export type HookMap<T = any> = Map<keyof T, HookCallbackInfo[]>

export interface HookCtx<H extends HookMapOption<H>, HM extends HookMap> {
	/** 事件 map */
	hookMapInstance: HM
	/** 实例引用 */
	self: Hook<H>
}

export interface HookCallbackInfo {
	once: boolean
	ref: symbol
	fn: HookCallback
}

/** hook 执行配置选项 */
export interface ExecOptions<H extends HookMapOption<H>, K extends string | symbol = string | symbol> {
	/** 自定义 hook 处理器, 每一个回调函数都会调用一次, 接收当前回调与执行上下文, 由处理器自行决定如何调用 */
	handler?: ExecHandler<H, K>
	/** hook 参数数组, 将传递给回调函数或处理器; 当名称为 H 的已知 hook 时约束为其参数元组 */
	args?: HookArgsOf<H, K>
}

/** 自定义 hook 处理器, 每一个回调函数都会调用一次, 接收当前回调与执行上下文, 由处理器自行决定如何调用 */
export type ExecHandler<H extends HookMapOption<H>, K extends string | symbol = string | symbol> = (
	callback: HookCallbackOf<H, K>,
	ctx: ExecCtx<H, K>
) => any

/** hook 执行上下文 */
export interface ExecCtx<H extends HookMapOption<H>, K extends string | symbol = string | symbol> {
	/** hook 名称 */
	name: K
	/** hook 参数数组 */
	args: HookArgsOf<H, K>
	/** 实例引用 */
	self: Hook<H>
}
