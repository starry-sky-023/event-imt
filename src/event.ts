import type {
	EventMapOption,
	EventOptions,
	EventCallback,
	EventCallbackOf,
	EventArgsOf,
	OnOptions,
	EventCallbackInfo,
	EventMap,
	OnEventWarningHandler
} from './types/index.js'
import { isObj, isSymbol, isFunction, isUndefined, formatName, eventDefaultOutputWarn } from './utils/index.js'

export class Bus<E extends EventMapOption<E>> {
	#eventMap: EventMap
	#outputWarn: OnEventWarningHandler

	/**
	 * 一个发布订阅模块
	 * - 通过泛型可约束事件类型, 默认支持 type 定义的类型, 若使用 interface 定义的类型, 需要配合 InterfaceToType 辅助类型进行转换
	 * @param options 配置选项
	 */
	constructor(options?: EventOptions<E>) {
		const { eventMap = new Map(), events = Object.create(null), ctx, onWarning } = options ?? {}
		if (!(eventMap instanceof Map)) {
			throw new TypeError('eventMap must be a Map instance')
		}
		this.#eventMap = eventMap

		if (!isObj(events)) {
			throw new TypeError('events must be an object')
		}

		if (!isUndefined(onWarning)) {
			if (isFunction(onWarning)) {
				this.#outputWarn = onWarning
			} else {
				throw new TypeError('options.onWarning must be a function')
			}
		} else {
			this.#outputWarn = eventDefaultOutputWarn
		}

		const eventMapKeys = Reflect.ownKeys(events)
		eventMapKeys.forEach((key) => {
			const eventOption: EventMapOption<E> = events[key]
			let callbackInfoList: EventCallbackInfo[]
			if (isFunction<EventCallback>(eventOption)) {
				callbackInfoList = [
					{
						once: false,
						fn: eventOption,
						ref: Symbol()
					}
				]
			} else {
				throw new TypeError(`options.events.${String(key)} must be a function`)
			}

			this.#eventMap.set(key, callbackInfoList)
		})

		if (ctx) {
			ctx.call(this, {
				eventMapInstance: this.#eventMap as EventMap<E>,
				self: this
			})
		}
	}

	/**
	 * 注册一个事件
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param callback 事件回调
	 * @param once 是否只执行一次
	 * @param options 配置选项
	 * @returns 事件标识
	 */
	#on(name: string | symbol, callback: EventCallback, once: boolean, options: OnOptions = {}): symbol {
		name = formatName(name)

		if (!isFunction(callback)) {
			throw new TypeError('callback must be a function')
		}

		if (!isObj(options)) {
			throw new TypeError('options must be a object')
		}

		if (!(isSymbol(options.ref) || isUndefined(options.ref))) {
			throw new TypeError('options.ref must be a symbol')
		}

		const ref: symbol = options.ref ?? Symbol()
		let callbackInfoList = this.#eventMap.get(name)
		if (!callbackInfoList) {
			callbackInfoList = []
			this.#eventMap.set(name, callbackInfoList)
		}

		callbackInfoList.push({
			once,
			fn: callback,
			ref: ref
		})

		return ref
	}

	/**
	 * 注册一个事件
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param callback 事件回调; 当名称为 E 的已知事件时, 参数与返回值将被约束
	 * @param options 配置选项
	 * @returns 事件标识
	 */
	on<K extends string | symbol>(name: K, callback: EventCallbackOf<E, K>, options?: OnOptions): symbol
	on(name: string | symbol, callback: EventCallback<Bus<E>>, options?: OnOptions): symbol {
		return this.#on(name, callback, false, options)
	}

	/**
	 * 注册一个一次性事件
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param callback 事件回调; 当名称为 E 的已知事件时, 参数与返回值将被约束
	 * @param options 配置选项
	 * @returns 事件标识
	 */
	once<K extends string | symbol>(name: K, callback: EventCallbackOf<E, K>, options?: OnOptions): symbol
	once(name: string | symbol, callback: EventCallback<Bus<E>>, options?: OnOptions): symbol {
		return this.#on(name, callback, true, options)
	}

	/**
	 * 触发指定事件
	 * - 不收集返回值, 遇到错误立即抛出
	 * - 当回调函数被触发, 不管是否有错误, 都算作一次消费
	 * - 注意: 触发不存在的事件时将输出警告, 可通过 onWarning 钩子自定义处理
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param args 参数列表; 当名称为 E 的已知事件时约束为其参数元组
	 */
	emit<K extends string | symbol>(this: Bus<E>, name: K, ...args: EventArgsOf<E, K>): void
	emit(this: Bus<E>, name: string | symbol, ...args: any[]): void {
		name = formatName(name)
		const callbackInfoArr = this.#eventMap.get(name)
		if (!callbackInfoArr) {
			this.#outputWarn('emit', { type: 'notExist', name, args })
			return
		}

		for (let i = 0; i < callbackInfoArr.length; i++) {
			const { fn, once } = callbackInfoArr[i]
			if (once) {
				callbackInfoArr.splice(i, 1)
				i--
			}
			fn.call(this, ...args)
		}

		if (!callbackInfoArr.length) {
			this.#eventMap.delete(name)
		}
	}

	/**
	 * 触发指定事件
	 * - 不收集返回值, 遇到错误进行收集
	 * - 尝试执行所有回调, 最后返回错误数组, 没有错误则无返回值
	 * - 当回调函数被触发, 不管是否有错误, 都算作一次消费
	 * - 注意: 1. 触发不存在的事件时将输出警告 2. 当执行回调发生错误时不会抛出错误, 但会输出警告; 可通过 onWarning 钩子自定义处理
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param args 参数列表; 当名称为 E 的已知事件时约束为其参数元组
	 */
	emitTry<K extends string | symbol>(this: Bus<E>, name: K, ...args: EventArgsOf<E, K>): any[] | void
	emitTry(this: Bus<E>, name: string | symbol, ...args: any[]): any[] | void {
		name = formatName(name)
		const callbackInfoArr = this.#eventMap.get(name)
		if (!callbackInfoArr) {
			this.#outputWarn('emitTry', { type: 'notExist', name, args })
			return
		}

		const errorList: any[] = []
		for (let i = 0; i < callbackInfoArr.length; i++) {
			const { fn, once } = callbackInfoArr[i]
			if (once) {
				callbackInfoArr.splice(i, 1)
				i--
			}
			try {
				fn.call(this, ...args)
			} catch (error) {
				errorList.push(error)
			}
		}

		if (!callbackInfoArr.length) {
			this.#eventMap.delete(name)
		}
		if (errorList.length) {
			this.#outputWarn('emitTry', { type: 'error', name, args })
			return errorList
		}
	}

	/**
	 * 触发指定事件, 按照注册的先后顺序排队执行, 返回一个 Promise, 所有回调都执行完毕后 resolve()
	 * - 当回调函数被触发, 不管是否有错误, 都算作一次消费
	 * - 按照注册的先后顺序排队执行, 遇到返回 Promise 的回调将进行等待, 不收集返回值, 遇到错误立即抛出, 并返回错误, 没有错误则无返回值
	 * - 注意: 触发不存在的事件时将输出警告, 可通过 onWarning 钩子自定义处理
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param args 参数列表; 当名称为 E 的已知事件时约束为其参数元组
	 */
	emitAsync<K extends string | symbol>(this: Bus<E>, name: K, ...args: EventArgsOf<E, K>): Promise<void>
	async emitAsync(this: Bus<E>, name: string | symbol, ...args: any[]): Promise<void> {
		name = formatName(name)
		const callbackInfoArr = this.#eventMap.get(name)
		if (!callbackInfoArr) {
			this.#outputWarn('emitAsync', { type: 'notExist', name, args })
			return
		}

		for (let i = 0; i < callbackInfoArr.length; i++) {
			const { fn, once } = callbackInfoArr[i]
			if (once) {
				callbackInfoArr.splice(i, 1)
				i--
			}
			await fn.call(this, ...args)
		}

		if (!callbackInfoArr.length) {
			this.#eventMap.delete(name)
		}
	}

	/**
	 * 触发指定事件, 按照注册的先后顺序排队执行, 返回一个 Promise, 所有回调都执行完毕后 resolve()
	 * - 当回调函数被触发, 不管是否有错误, 都算作一次消费
	 * - 按照注册的先后顺序排队执行, 遇到返回 Promise 的回调将进行等待, 不收集返回值, 遇到错误进行收集, 尝试执行所有回调, 最后返回错误数组, 没有错误则无返回值
	 * - 注意: 1. 触发不存在的事件时将输出警告 2. 当执行回调发生错误时不会抛出错误, 但会输出警告; 可通过 onWarning 钩子自定义处理
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param args 参数列表; 当名称为 E 的已知事件时约束为其参数元组
	 */
	emitTryAsync<K extends string | symbol>(this: Bus<E>, name: K, ...args: EventArgsOf<E, K>): Promise<any[] | void>
	async emitTryAsync(this: Bus<E>, name: string | symbol, ...args: any[]): Promise<any[] | void> {
		name = formatName(name)
		const callbackInfoArr = this.#eventMap.get(name)
		if (!callbackInfoArr) {
			this.#outputWarn('emitTryAsync', { type: 'notExist', name, args })
			return
		}

		const errorList: any[] = []
		for (let i = 0; i < callbackInfoArr.length; i++) {
			const { fn, once } = callbackInfoArr[i]
			if (once) {
				callbackInfoArr.splice(i, 1)
				i--
			}
			try {
				await fn.call(this, ...args)
			} catch (error) {
				errorList.push(error)
			}
		}

		if (!callbackInfoArr.length) {
			this.#eventMap.delete(name)
		}

		if (errorList.length) {
			this.#outputWarn('emitTryAsync', { type: 'error', name, args })
			return errorList
		}
	}

	/**
	 * 触发指定事件, 并发执行, 遇到返回 Promise 的回调将进行等待
	 * - 当回调函数被触发, 不管是否有错误, 都算作一次消费
	 * - 并发执行, 不收集返回值, 遇到错误将收集, 并在所有回调执行完毕后返回错误数组, 没有错误则无返回值
	 * - 注意: 1. 触发不存在的事件时将输出警告 2. 当执行回调发生错误时不会抛出错误, 但会输出警告; 可通过 onWarning 钩子自定义处理
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param args 参数列表; 当名称为 E 的已知事件时约束为其参数元组
	 */
	emitConcurrencyAsync<K extends string | symbol>(this: Bus<E>, name: K, ...args: EventArgsOf<E, K>): Promise<void | any[]>
	async emitConcurrencyAsync(this: Bus<E>, name: string | symbol, ...args: any[]): Promise<void | any[]> {
		name = formatName(name)
		const callbackInfoArr = this.#eventMap.get(name)
		if (!callbackInfoArr) {
			this.#outputWarn('emitConcurrencyAsync', { type: 'notExist', name, args })
			return
		}

		const task: Promise<any>[] = []
		for (let i = 0; i < callbackInfoArr.length; i++) {
			const { fn, once } = callbackInfoArr[i]
			if (once) {
				callbackInfoArr.splice(i, 1)
				i--
			}

			try {
				task.push(Promise.resolve(fn.call(this, ...args)))
			} catch (error) {
				task.push(Promise.reject(error))
			}
		}

		if (!callbackInfoArr.length) {
			this.#eventMap.delete(name)
		}

		const errorList = (await Promise.allSettled(task))
			.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
			.map((result) => result.reason)
		if (errorList.length) {
			this.#outputWarn('emitConcurrencyAsync', { type: 'error', name, args })
			return errorList
		}
	}

	/**
	 * 移除指定事件中的回调
	 * - 移除失败时将输出警告, 返回值为 boolean, 表示是否移除成功
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false, 2. 移除不存在的回调时将输出警告 3. 移除不存在的事件时将输出警告; 可通过 onWarning 钩子自定义处理
	 * @param ref 回调函数引用或回调标识
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 */
	off<K extends keyof E>(this: Bus<E>, name: K, ref: symbol | EventCallback): boolean
	/**
	 * 移除指定事件中的回调
	 * - 移除失败时将输出警告, 返回值为 boolean, 表示是否移除成功
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false, 2. 移除不存在的回调时将输出警告 3. 移除不存在的事件时将输出警告; 可通过 onWarning 钩子自定义处理
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param ref 回调函数引用或回调标识
	 */
	off<K extends keyof E>(this: Bus<E>, name: string | symbol, ref: symbol | EventCallback): boolean
	off(name: string | symbol, ref: symbol | EventCallback): boolean {
		name = formatName(name)

		let fieldMod: 'ref' | 'fn'
		if (isSymbol(ref)) {
			fieldMod = 'ref'
		} else if (isFunction(ref)) {
			fieldMod = 'fn'
		} else {
			this.#outputWarn('off', { type: 'typeError', name, ref })
			return false
		}

		const callbackInfoArr = this.#eventMap.get(name)
		if (!callbackInfoArr) {
			this.#outputWarn('off', { type: 'notExist', name, ref })
			return false
		}

		let isExist = false
		for (let i = 0; i < callbackInfoArr.length; i++) {
			if (callbackInfoArr[i][fieldMod] === ref) {
				isExist = true
				callbackInfoArr.splice(i, 1)
				i--
			}
		}

		if (!callbackInfoArr.length) {
			this.#eventMap.delete(name)
		}

		if (!isExist) {
			this.#outputWarn('off', { type: 'notExist', name, ref })
		}
		return isExist
	}

	/**
	 * 通过回调标识移除事件回调
	 * - 移除失败时将输出警告, 返回值为 boolean, 表示是否移除成功
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false, 2. 移除不存在的回调时将输出警告 3. 移除不存在的事件时将输出警告; 可通过 onWarning 钩子自定义处理
	 * @param ref 回调标识
	 */
	offRef(ref: symbol): boolean {
		if (!isSymbol(ref)) {
			this.#outputWarn('offRef', { type: 'typeError', ref })
			return false
		}

		let isExist = false
		for (const [eventName, callbackInfoArr] of this.#eventMap.entries()) {
			for (let i = 0; i < callbackInfoArr.length; i++) {
				if (callbackInfoArr[i].ref === ref) {
					isExist = true
					callbackInfoArr.splice(i, 1)
					i--
				}

				if (!callbackInfoArr.length) {
					this.#eventMap.delete(eventName)
				}
			}
		}

		if (!isExist) {
			this.#outputWarn('offRef', { type: 'notExist', ref })
		}
		return isExist
	}

	/**
	 * 判断一个事件是否存在
	 * - 若传递 ref 参数, 则内部调用 hasCallback 判断回调是否存在
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false; 可通过 onWarning 钩子自定义处理
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 */
	has<K extends keyof E>(name: K, ref?: symbol | EventCallback): boolean
	/**
	 * 判断一个事件是否存在
	 * - 若传递 ref 参数, 则内部调用 hasCallback 判断回调是否存在
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false; 可通过 onWarning 钩子自定义处理
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 */
	has(name: string | symbol, ref?: symbol | EventCallback): boolean
	has(name: string | symbol, ...args: [symbol | EventCallback]): boolean {
		name = formatName(name)

		if (args.length) {
			const [ref] = args
			return this.hasCallback(name, ref)
		}
		return this.#eventMap.has(name)
	}

	/**
	 * 判断事件中指定的回调是否存在
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false; 可通过 onWarning 钩子自定义处理
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param ref 回调函数引用或回调标识
	 */
	hasCallback<K extends keyof E>(name: K, ref: symbol | EventCallback): boolean
	/**
	 * 判断事件中指定的回调是否存在
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false; 可通过 onWarning 钩子自定义处理
	 * @param name 事件名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param ref 回调函数引用或回调标识
	 */
	hasCallback<K extends keyof E>(name: string | symbol, ref: symbol | EventCallback): boolean
	hasCallback(name: string | symbol, ref: symbol | EventCallback): boolean {
		name = formatName(name)
		const callbackInfoArr = this.#eventMap.get(name)
		if (!callbackInfoArr) {
			return false
		}

		let fieldMod: 'ref' | 'fn'
		if (isSymbol(ref)) {
			fieldMod = 'ref'
		} else if (isFunction(ref)) {
			fieldMod = 'fn'
		} else {
			this.#outputWarn('hasCallback', { type: 'typeError', name, ref })
			return false
		}
		return callbackInfoArr.some((callbackInfo) => callbackInfo[fieldMod] === ref)
	}

	/**
	 * 通过回调标识判断回调是否存在
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false; 可通过 onWarning 钩子自定义处理
	 * @param ref 回调标识
	 */
	hasRef(ref: symbol): boolean {
		if (!isSymbol(ref)) {
			this.#outputWarn('hasRef', { type: 'typeError', ref })
			return false
		}
		for (const callbackInfoArr of this.#eventMap.values()) {
			if (callbackInfoArr.some((callbackInfo) => callbackInfo.ref === ref)) {
				return true
			}
		}
		return false
	}
}
