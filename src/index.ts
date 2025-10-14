import type { EventMapOption, Options, Callback, OnOptions, CallbackInfo, EventMap } from './types/index.js'
import { isObj } from './utils/isObj/index.js'
import { isString } from './utils/isString/index.js'
import { isSymbol } from './utils/isSymbol/index.js'
import { isFunction } from './utils/isFunction/index.js'
import { isUndefined } from './utils/isUndefined/index.js'
import { logError, logWarn } from './utils/log/index.js'

export class Bus<E extends EventMapOption<E>> {
	#eventMap = Object.create(null) as EventMap<E>
	#sendError: Options<E>['onError']
	#sendWarn: Options<E>['onWarning']

	/**
	 * 一个发布订阅模块
	 * @param options 配置选项
	 */
	constructor(options?: Options<E>) {
		const { events = Object.create(null), ctx, onError, onWarning } = options ?? {}
		if (!isObj(events)) {
			throw new TypeError('events must be an object')
		}

		if (!isUndefined(onError)) {
			if (isFunction(onError)) {
				this.#sendError = onError
			} else {
				throw new TypeError('options.onError must be a function')
			}
		}

		if (!isUndefined(onWarning)) {
			if (isFunction(onWarning)) {
				this.#sendWarn = onWarning
			} else {
				throw new TypeError('options.onWarning must be a function')
			}
		}

		const eventMapKeys = Reflect.ownKeys(events)
		eventMapKeys.forEach((key) => {
			const eventOption: EventMapOption<E> = events[key]
			let callbackInfoList: CallbackInfo[]
			if (isFunction<Callback>(eventOption)) {
				callbackInfoList = [
					{
						once: false,
						fn: eventOption,
						sign: Symbol()
					}
				]
			} else {
				throw new TypeError(`options.events.${String(key)} must be a function`)
			}

			// @ts-ignore
			this.#eventMap[key] = callbackInfoList
		})

		if (ctx) {
			ctx.call(this, {
				eventMap: this.#eventMap,
				self: this,
				setSelf: (key: string | symbol, value: any) => {
					// @ts-ignore
					this[key] = value
					return this
				},
				clear: (eventName) => {
					if (!(isString(eventName) || isSymbol(eventName))) {
						throw new TypeError(`eventName must be a string or symbol`)
					}
					delete this.#eventMap[eventName]
					return this
				},
				clearAll: () => {
					const eventMapKeys = Reflect.ownKeys(this.#eventMap)
					eventMapKeys.forEach((key) => {
						delete this.#eventMap[key]
					})
					return this
				}
			})
		}
	}

	#on(eventName: string | symbol, callback: Callback, once: boolean, options: OnOptions = {}): symbol {
		if (!(isString(eventName) || isSymbol(eventName))) {
			throw new TypeError('eventName must be a string or symbol')
		}

		if (!isFunction(callback)) {
			throw new TypeError('callback must be a function')
		}

		if (!isObj(options)) {
			throw new TypeError('options must be a object')
		}

		if (!(isSymbol(options.sign) || isUndefined(options.sign))) {
			throw new TypeError('options.sign must be a symbol')
		}

		const symbol: symbol = options.sign ?? Symbol()
		if (!this.#eventMap[eventName]) {
			// @ts-ignore
			this.#eventMap[eventName] = []
		}

		this.#eventMap[eventName].push({
			once,
			fn: callback,
			sign: symbol
		})

		return symbol
	}

	/**
	 * 注册一个事件
	 * @param eventName 事件名称
	 * @param callback 事件回调
	 * @param options 配置选项
	 */
	on<K extends keyof E>(
		eventName: K,
		callback: (this: Bus<E>, ...args: Parameters<E[K]>) => ReturnType<E[K]>,
		options?: OnOptions
	): symbol
	/**
	 * 注册一个事件
	 * @param eventName 事件名称
	 * @param callback 事件回调
	 * @param options 配置选项
	 */
	on(eventName: string | symbol, callback: Callback<Bus<E>>, options?: OnOptions): symbol
	on(eventName: string | symbol, callback: Callback<Bus<E>>, options?: OnOptions): symbol {
		return this.#on(eventName, callback, false, options)
	}

	/**
	 * 注册一个一次性事件
	 * @param eventName 事件名称
	 * @param callback 事件回调
	 * @param options 配置选项
	 */
	once<K extends keyof E>(
		eventName: K,
		callback: (this: Bus<E>, ...args: Parameters<E[K]>) => ReturnType<E[K]>,
		options?: OnOptions
	): symbol
	/**
	 * 注册一个一次性事件
	 * @param eventName 事件名称
	 * @param callback 事件回调
	 * @param options 配置选项
	 */
	once(eventName: string | symbol, callback: Callback<Bus<E>>, options?: OnOptions): symbol
	once(eventName: string | symbol, callback: Callback<Bus<E>>, options?: OnOptions): symbol {
		return this.#on(eventName, callback, true, options)
	}

	/**
	 * 触发指定事件
	 * @param eventName 事件名称
	 * @param args 参数列表
	 * - 遇到异常将进行捕获, 并在事件触发完毕后抛出, 通过 onError 可进行自定义
	 */
	emit<K extends keyof E>(this: Bus<E>, eventName: K, ...args: Parameters<E[K]>): this
	/**
	 * 触发指定事件
	 * @param eventName 事件名称
	 * @param args 参数列表
	 * - 遇到异常将进行捕获, 并在事件触发完毕后抛出, 通过 onError 可进行自定义
	 */
	emit<K extends keyof E>(this: Bus<E>, eventName: string | symbol, ...args: Parameters<E[K]>): this
	emit<K extends keyof E>(this: Bus<E>, eventName: string | symbol, ...args: Parameters<E[K]>) {
		const callbackInfoArr = this.#eventMap[eventName]
		if (!callbackInfoArr) {
			if (this.#sendWarn) {
				this.#sendWarn('emit', 'notExist', eventName, args)
			} else {
				logWarn(`EventBus(warn): eventName -> '${String(eventName)}' is not exist`)
			}
			return this
		}

		const errorList: any[] = []
		for (let i = 0; i < callbackInfoArr.length; i++) {
			const { fn, once } = callbackInfoArr[i]
			try {
				fn.call(this, ...args)
			} catch (error) {
				if (this.#sendError) {
					this.#sendError('emit', 'execError', eventName, args)
				} else {
					errorList.push(error)
				}
			} finally {
				if (once) {
					callbackInfoArr.splice(i, 1)
					i--
				}
			}
		}

		if (!callbackInfoArr.length) {
			delete this.#eventMap[eventName]
		}
		if (errorList.length) {
			logError(errorList)
		}
		return this
	}

	/**
	 * 触发指定事件, 返回一个 Promise, 所有回调敲定后 resolve()
	 * @param eventName 事件名称
	 * @param args 参数列表
	 */
	emitWait<K extends keyof E>(
		this: Bus<E>,
		eventName: K,
		...args: Parameters<E[K]>
	): Promise<PromiseSettledResult<any>[]>
	/**
	 * 触发指定事件, 返回一个 Promise, 所有回调敲定后 resolve()
	 * @param eventName 事件名称
	 * @param args 参数列表
	 */
	emitWait<K extends keyof E>(
		this: Bus<E>,
		eventName: string | symbol,
		...args: Parameters<E[K]>
	): Promise<PromiseSettledResult<any>[]>
	emitWait<K extends keyof E>(this: Bus<E>, eventName: string | symbol, ...args: Parameters<E[K]>) {
		const callbackInfoArr = this.#eventMap[eventName]
		if (!callbackInfoArr) {
			if (this.#sendWarn) {
				this.#sendWarn('emitAwait', 'notExist', eventName, args)
			} else {
				logWarn(`EventBus(warn): eventName -> '${String(eventName)}' is not exist`)
			}
			return Promise.allSettled([])
		}

		const task: Promise<any>[] = []
		for (let i = 0; i < callbackInfoArr.length; i++) {
			const { fn, once } = callbackInfoArr[i]
			task.push(
				new Promise(async (resolve, reject) => {
					try {
						const result = await fn.call(this, ...args)
						resolve(result)
					} catch (error) {
						if (this.#sendError) {
							this.#sendError('emitAwait', 'execError', eventName, args)
						}
						reject(error)
					}
				})
			)

			if (once) {
				callbackInfoArr.splice(i, 1)
				i--
			}
		}

		if (!callbackInfoArr.length) {
			delete this.#eventMap[eventName]
		}
		return Promise.allSettled(task)
	}

	/**
	 * 触发指定事件, 按照注册的先后顺序排队执行
	 * - 遇到返回 Promise 的 callback 将进行等待
	 * - 遇到异常将中断执行, 并立即抛出
	 * @param eventName 事件名称
	 * @param args 参数列表
	 * @returns 回调返回值数组
	 */
	async emitLineUp<K extends keyof E>(this: Bus<E>, eventName: K, ...args: Parameters<E[K]>): Promise<any[]>
	/**
	 * 触发指定事件, 返回一个 Promise, 所有回调敲定后 resolve()
	 * @param eventName 事件名称
	 * @param args 参数列表
	 */
	async emitLineUp<K extends keyof E>(
		this: Bus<E>,
		eventName: string | symbol,
		...args: Parameters<E[K]>
	): Promise<any[]>
	async emitLineUp<K extends keyof E>(this: Bus<E>, eventName: string | symbol, ...args: Parameters<E[K]>) {
		const callbackInfoArr = this.#eventMap[eventName]
		if (!callbackInfoArr) {
			if (this.#sendWarn) {
				this.#sendWarn('emitLineUp', 'notExist', eventName, args)
			} else {
				logWarn(`EventBus(warn): eventName -> '${String(eventName)}' is not exist`)
			}
			return Promise.allSettled([])
		}

		const task: any[] = []
		try {
			for (let i = 0; i < callbackInfoArr.length; i++) {
				const { fn, once } = callbackInfoArr[i]
				if (once) {
					callbackInfoArr.splice(i, 1)
					i--
				}
				task.push(await fn.call(this, ...args))
			}
		} catch (error) {
			throw error
		} finally {
			if (!callbackInfoArr.length) {
				delete this.#eventMap[eventName]
			}
		}

		return task
	}

	/**
	 * 触发指定事件, 按照注册的先后顺序排队执行
	 * - 遇到返回 Promise 的 callback 将进行等待
	 * - 遇到异常将捕获异常, 然后执行下一个回调
	 * @param eventName 事件名称
	 * @param args 参数列表
	 * @returns 回调返回值包装后的数组
	 */
	async emitLineUpCaptureErr<K extends keyof E>(
		this: Bus<E>,
		eventName: K,
		...args: Parameters<E[K]>
	): Promise<({ status: 'fulfilled'; value: any } | { status: 'rejected'; reason: any })[]>
	/**
	 * 触发指定事件, 按照注册的先后顺序排队执行
	 * - 遇到返回 Promise 的 callback 将进行等待
	 * - 遇到异常将捕获异常, 然后执行下一个回调
	 * @param eventName 事件名称
	 * @param args 参数列表
	 * @returns 回调返回值包装后的数组
	 */
	async emitLineUpCaptureErr<K extends keyof E>(
		this: Bus<E>,
		eventName: string | symbol,
		...args: Parameters<E[K]>
	): Promise<({ status: 'fulfilled'; value: any } | { status: 'rejected'; reason: any })[]>
	async emitLineUpCaptureErr<K extends keyof E>(this: Bus<E>, eventName: string | symbol, ...args: Parameters<E[K]>) {
		const callbackInfoArr = this.#eventMap[eventName]
		if (!callbackInfoArr) {
			if (this.#sendWarn) {
				this.#sendWarn('emitAwait', 'notExist', eventName, args)
			} else {
				logWarn(`EventBus(warn): eventName -> '${String(eventName)}' is not exist`)
			}
			return Promise.allSettled([])
		}

		const task: ({ status: 'fulfilled'; value: any } | { status: 'rejected'; reason: any })[] = []
		for (let i = 0; i < callbackInfoArr.length; i++) {
			const { fn, once } = callbackInfoArr[i]

			try {
				const result = await fn.call(this, ...args)
				task.push({
					status: 'fulfilled',
					value: result
				})
			} catch (error) {
				task.push({
					status: 'rejected',
					reason: error
				})
			} finally {
				if (once) {
					callbackInfoArr.splice(i, 1)
					i--
				}
			}
		}

		if (!callbackInfoArr.length) {
			delete this.#eventMap[eventName]
		}
		return task
	}

	/**
	 * 移除指定事件中的回调
	 * @param eventName 事件名称
	 * @param ref 回调函数引用或回调标识
	 */
	off<K extends keyof E>(this: Bus<E>, eventName: K, ref: symbol | Callback): this
	/**
	 * 移除指定事件中的回调
	 * @param eventName 事件名称
	 * @param ref 回调函数引用或回调标识
	 */
	off<K extends keyof E>(this: Bus<E>, eventName: string | symbol, ref: symbol | Callback): this
	/**
	 * 移除指定事件中的回调
	 * @param eventName 事件名称
	 * @param ref 回调函数引用或回调标识
	 */
	off<K extends keyof E>(eventName: K, ref: symbol | Callback): this {
		const callbackInfoArr = this.#eventMap[eventName]
		if (!callbackInfoArr) {
			if (this.#sendWarn) {
				this.#sendWarn('off', 'notExist', eventName as string | symbol, ref)
			} else {
				logWarn(`EventBus(warn): eventName -> '${String(eventName)}' is not exist`)
			}
			return this
		}

		let refField: 'sign' | 'fn'
		if (isSymbol(ref)) {
			refField = 'sign'
		} else if (isFunction(ref)) {
			refField = 'fn'
		} else {
			throw new TypeError('ref must be a symbol or function')
		}

		for (let i = 0; i < callbackInfoArr.length; i++) {
			if (callbackInfoArr[i][refField] === ref) {
				callbackInfoArr.splice(i, 1)
				i--
			}
		}

		if (!callbackInfoArr.length) {
			delete this.#eventMap[eventName]
		}
		return this
	}

	/**
	 * 通过回调标识移除事件回调
	 * @param sign 回调标识
	 */
	offBySign(sign: symbol): this {
		if (!isSymbol(sign)) {
			throw new TypeError('sign must be a symbol')
		}

		const eventMapKeys = Reflect.ownKeys(this.#eventMap)
		eventMapKeys.forEach((key) => {
			const callbackInfoArr = this.#eventMap[key] ?? []
			for (let i = 0; i < callbackInfoArr.length; i++) {
				if (callbackInfoArr[i].sign === sign) {
					callbackInfoArr.splice(i, 1)
					i--
				}
			}

			if (!callbackInfoArr.length) {
				delete this.#eventMap[key]
			}
		})

		return this
	}

	/**
	 * 判断一个事件是否存在
	 * @param eventName 事件名称
	 */
	has<K extends keyof E>(eventName: K): boolean
	/**
	 * 判断一个事件是否存在
	 * @param eventName 事件名称
	 */
	has(eventName: string | symbol): boolean
	/**
	 * 判断一个事件是否存在
	 * @param eventName 事件名称
	 */
	has<K extends keyof E>(eventName: K): boolean {
		return !!this.#eventMap[eventName]
	}

	/**
	 * 判断事件中指定的回调是否存在
	 * @param eventName 事件名称
	 * @param ref 回调函数引用或回调标识
	 */
	hasCallback<K extends keyof E>(eventName: K, ref: symbol | Callback): boolean
	/**
	 * 判断事件中指定的回调是否存在
	 * @param eventName 事件名称
	 * @param ref 回调函数引用或回调标识
	 */
	hasCallback<K extends keyof E>(eventName: string | symbol, ref: symbol | Callback): boolean
	/**
	 * 判断事件中指定的回调是否存在
	 * @param eventName 事件名称
	 * @param ref 回调函数引用或回调标识
	 */
	hasCallback<K extends keyof E>(eventName: K, ref: symbol | Callback): boolean {
		const callbackInfoArr = this.#eventMap[eventName]
		if (!callbackInfoArr) {
			return false
		}

		let refField: 'sign' | 'fn'
		if (isSymbol(ref)) {
			refField = 'sign'
		} else if (isFunction(ref)) {
			refField = 'fn'
		} else {
			throw new TypeError('ref must be a symbol or function')
		}

		return callbackInfoArr.some((callbackInfo) => callbackInfo[refField] === ref)
	}

	/**
	 * 通过回调标识判断回调是否存在
	 * @param sign 回调标识
	 */
	hasCallbackBySign(sign: symbol): boolean {
		const eventMapKeys = Reflect.ownKeys(this.#eventMap)
		for (let i = 0; i < eventMapKeys.length; i++) {
			const callbackInfoArr = this.#eventMap[eventMapKeys[i]]
			if (callbackInfoArr.some((callbackInfo) => callbackInfo.sign === sign)) {
				return true
			}
		}
		return false
	}
}

export type * from './types/index.js'
export default Bus
