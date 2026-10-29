import type {
	OnOptions,
	HookMapOption,
	HookMap,
	HookOptions,
	HookCallback,
	HookCallbackInfo,
	HookCallbackOf,
	OnHookWarningHandler,
	ExecOptions,
	ExecCtx
} from './types/index.js'
import {
	isObj,
	isSymbol,
	isFunction,
	isArray,
	isUndefined,
	formatName,
	hookDefaultOutputWarn
} from './utils/index.js'
export type * from './types/index.js'

export class Hook<H extends HookMapOption<H>> {
	#hookMap: HookMap
	#outputWarn: OnHookWarningHandler

	/**
	 * 一个hook注册和执行模块
	 * - 通过泛型可约束hook类型, 默认支持 type 定义的类型, 若使用 interface 定义的类型, 需要配合 InterfaceToType 辅助类型进行转换
	 * @param options 配置选项
	 */
	constructor(options?: HookOptions<H>) {
		const { hookMap = new Map(), hooks = Object.create(null), ctx, onWarning } = options ?? {}
		if (!(hookMap instanceof Map)) {
			throw new TypeError('hookMap must be a Map instance')
		}
		this.#hookMap = hookMap

		if (!isObj(hooks)) {
			throw new TypeError('hooks must be an object')
		}

		if (!isUndefined(onWarning)) {
			if (isFunction(onWarning)) {
				this.#outputWarn = onWarning
			} else {
				throw new TypeError('options.onWarning must be a function')
			}
		} else {
			this.#outputWarn = hookDefaultOutputWarn
		}

		const hookMapKeys = Reflect.ownKeys(hooks)
		hookMapKeys.forEach((key) => {
			const hookOption: HookMapOption<H> = hooks[key]
			let callbackInfoList: HookCallbackInfo[]
			if (isFunction<HookCallback>(hookOption)) {
				callbackInfoList = [
					{
						once: false,
						fn: hookOption,
						ref: Symbol()
					}
				]
			} else {
				throw new TypeError(`options.hooks.${String(key)} must be a function`)
			}

			this.#hookMap.set(key, callbackInfoList)
		})

		if (ctx) {
			ctx.call(this, {
				hookMapInstance: this.#hookMap as HookMap<H>,
				self: this
			})
		}
	}

	/**
	 * 注册一个hook
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param callback hook回调
	 * @param once 是否只执行一次
	 * @param options 配置选项
	 * @returns hook标识
	 */
	#register(name: string | symbol, callback: HookCallback, once: boolean, options: OnOptions = {}): symbol {
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
		let callbackInfoList = this.#hookMap.get(name)
		if (!callbackInfoList) {
			callbackInfoList = []
			this.#hookMap.set(name, callbackInfoList)
		}

		callbackInfoList.push({
			once,
			fn: callback,
			ref: ref
		})

		return ref
	}

	/**
	 * 注册一个hook
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param callback hook回调; 当名称为 H 的已知 hook 时, 参数与返回值将被约束
	 * @param options 配置选项
	 * @returns hook标识
	 */
	register<K extends string | symbol>(name: K, callback: HookCallbackOf<H, K>, options?: OnOptions): symbol
	register(name: string | symbol, callback: HookCallback<Hook<H>>, options?: OnOptions): symbol {
		return this.#register(name, callback, false, options)
	}

	/**
	 * 注册一个一次性hook
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param callback hook回调; 当名称为 H 的已知 hook 时, 参数与返回值将被约束
	 * @param options 配置选项
	 * @returns hook标识
	 */
	registerOnce<K extends string | symbol>(name: K, callback: HookCallbackOf<H, K>, options?: OnOptions): symbol
	registerOnce(name: string | symbol, callback: HookCallback<Hook<H>>, options?: OnOptions): symbol {
		return this.#register(name, callback, true, options)
	}

	/**
	 * 校验执行配置选项
	 * @param options 配置选项
	 */
	#checkExecOptions(options: ExecOptions<H>): void {
		if (!isObj(options)) {
			throw new TypeError('options must be a object')
		}

		if (!isUndefined(options.handler) && !isFunction(options.handler)) {
			throw new TypeError('options.handler must be a function')
		}

		if (!isUndefined(options.args) && !isArray(options.args)) {
			throw new TypeError('options.args must be an array')
		}
	}

	/**
	 * 取出待执行的回调函数集合, 处理一次性hook的移除
	 * - 运行时回调类型已被擦除, 此处按 hook 名称对应的回调类型返回
	 * @param name hook名称
	 * @param callbackInfoArr 回调信息列表
	 */
	#takeCallbacks<K extends string | symbol>(
		name: K,
		callbackInfoArr?: HookCallbackInfo[]
	): HookCallbackOf<H, K>[] {
		if (!callbackInfoArr) {
			return []
		}

		const callbacks: HookCallbackOf<H, K>[] = []
		for (let i = 0; i < callbackInfoArr.length; i++) {
			const { fn, once } = callbackInfoArr[i]
			if (once) {
				callbackInfoArr.splice(i, 1)
				i--
			}
			callbacks.push(fn as HookCallbackOf<H, K>)
		}

		if (!callbackInfoArr.length) {
			this.#hookMap.delete(name)
		}
		return callbacks
	}

	/**
	 * 执行hook
	 * - 不收集返回值, 遇到错误立即抛出
	 * - 当回调函数被触发, 不管是否有错误, 都算作一次消费
	 * - 传入配置对象时, 若存在 handler, 则每一个回调函数与执行上下文将交由 handler 自行决定如何调用与处理
	 * - 注意: 触发不存在的hook时将输出警告, 可通过 onWarning 钩子自定义处理
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param options 配置选项 { handler?: hook处理器, args?: hook参数数组 }
	 */
	exec<K extends string | symbol>(this: Hook<H>, name: K, options?: ExecOptions<H, K>): void
	exec(this: Hook<H>, name: string | symbol, options: ExecOptions<H> = {}): void {
		name = formatName(name)
		this.#checkExecOptions(options)
		const { handler, args = [] } = options
		const callbackInfoArr = this.#hookMap.get(name)

		if (handler) {
			const callbacks = this.#takeCallbacks(name, callbackInfoArr)
			const ctx: ExecCtx<H> = {
				name,
				args,
				self: this
			}
			for (let i = 0; i < callbacks.length; i++) {
				handler(callbacks[i], ctx)
			}
			return
		}

		if (!callbackInfoArr) {
			this.#outputWarn('exec', { type: 'notExist', name, args })
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
			this.#hookMap.delete(name)
		}
	}

	/**
	 * 执行hook, 按照注册的先后顺序排队执行, 返回一个 Promise, 所有回调都执行完毕后 resolve()
	 * - 当回调函数被触发, 不管是否有错误, 都算作一次消费
	 * - 按照注册的先后顺序排队执行, 遇到返回 Promise 的回调将进行等待, 不收集返回值, 遇到错误立即抛出, 并返回错误, 没有错误则无返回值
	 * - 传入配置对象时, 若存在 handler, 则每一个回调函数与执行上下文将交由 handler 自行决定如何调用与处理, 并等待 handler 返回的 Promise
	 * - 注意: 触发不存在的hook时将输出警告, 可通过 onWarning 钩子自定义处理
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param options 配置选项 { handler?: hook处理器, args?: hook参数数组 }
	 */
	execAsync<K extends string | symbol>(this: Hook<H>, name: K, options?: ExecOptions<H, K>): Promise<void>
	async execAsync(this: Hook<H>, name: string | symbol, options: ExecOptions<H> = {}): Promise<void> {
		name = formatName(name)
		this.#checkExecOptions(options)
		const { handler, args = [] } = options
		const callbackInfoArr = this.#hookMap.get(name)

		if (handler) {
			const callbacks = this.#takeCallbacks(name, callbackInfoArr)
			const ctx: ExecCtx<H> = {
				name,
				args,
				self: this
			}
			for (let i = 0; i < callbacks.length; i++) {
				await handler(callbacks[i], ctx)
			}
			return
		}

		if (!callbackInfoArr) {
			this.#outputWarn('execAsync', { type: 'notExist', name, args })
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
			this.#hookMap.delete(name)
		}
	}

	/**
	 * 执行hook, 并发执行, 遇到返回 Promise 的回调将进行等待
	 * - 当回调函数被触发, 不管是否有错误, 都算作一次消费
	 * - 并发执行, 不收集返回值, 遇到错误将收集, 并在所有回调执行完毕后返回错误数组, 没有错误则无返回值
	 * - 传入配置对象时, 若存在 handler, 则每一个回调函数与执行上下文将交由 handler 自行决定如何调用与处理, 并等待 handler 返回的 Promise
	 * - 注意: 1. 触发不存在的hook时将输出警告 2. 当执行回调发生错误时不会抛出错误, 但会输出警告; 可通过 onWarning 钩子自定义处理
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param options 配置选项 { handler?: hook处理器, args?: hook参数数组 }
	 */
	execConcurrencyAsync<K extends string | symbol>(
		this: Hook<H>,
		name: K,
		options?: ExecOptions<H, K>
	): Promise<void | any[]>
	async execConcurrencyAsync(
		this: Hook<H>,
		name: string | symbol,
		options: ExecOptions<H> = {}
	): Promise<void | any[]> {
		name = formatName(name)
		this.#checkExecOptions(options)
		const { handler, args = [] } = options
		const callbackInfoArr = this.#hookMap.get(name)

		if (!handler && !callbackInfoArr) {
			this.#outputWarn('execConcurrencyAsync', { type: 'notExist', name, args })
			return
		}

		const ctx: ExecCtx<H> = {
			name,
			args,
			self: this
		}
		const task: Promise<any>[] = []

		if (handler) {
			const callbacks = this.#takeCallbacks(name, callbackInfoArr)
			for (let i = 0; i < callbacks.length; i++) {
				try {
					task.push(Promise.resolve(handler(callbacks[i], ctx)))
				} catch (error) {
					task.push(Promise.reject(error))
				}
			}
		} else if (callbackInfoArr) {
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
				this.#hookMap.delete(name)
			}
		}

		const errorList = (await Promise.allSettled(task))
			.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
			.map((result) => result.reason)
		if (errorList.length) {
			this.#outputWarn('execConcurrencyAsync', { type: 'error', name, args })
			return errorList
		}
	}

	/**
	 * 注销指定hook中的回调
	 * - 移除失败时将输出警告, 返回值为 boolean, 表示是否移除成功
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false, 2. 移除不存在的回调时将输出警告 3. 移除不存在的hook时将输出警告; 可通过 onWarning 钩子自定义处理
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param ref 回调函数引用或回调标识
	 */
	unregister<K extends keyof H>(this: Hook<H>, name: K, ref: symbol | HookCallback): boolean
	/**
	 * 注销指定hook中的回调
	 * - 移除失败时将输出警告, 返回值为 boolean, 表示是否移除成功
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false, 2. 移除不存在的回调时将输出警告 3. 移除不存在的hook时将输出警告; 可通过 onWarning 钩子自定义处理
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param ref 回调函数引用或回调标识
	 */
	unregister<K extends keyof H>(this: Hook<H>, name: string | symbol, ref: symbol | HookCallback): boolean
	unregister(name: string | symbol, ref: symbol | HookCallback): boolean {
		name = formatName(name)

		let fieldMod: 'ref' | 'fn'
		if (isSymbol(ref)) {
			fieldMod = 'ref'
		} else if (isFunction(ref)) {
			fieldMod = 'fn'
		} else {
			this.#outputWarn('unregister', { type: 'typeError', name, ref })
			return false
		}

		const callbackInfoArr = this.#hookMap.get(name)
		if (!callbackInfoArr) {
			this.#outputWarn('unregister', { type: 'notExist', name, ref })
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
			this.#hookMap.delete(name)
		}

		if (!isExist) {
			this.#outputWarn('unregister', { type: 'notExist', name, ref })
		}
		return isExist
	}

	/**
	 * 通过回调标识注销hook回调
	 * - 移除失败时将输出警告, 返回值为 boolean, 表示是否移除成功
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false, 2. 移除不存在的回调时将输出警告 3. 移除不存在的hook时将输出警告; 可通过 onWarning 钩子自定义处理
	 * @param ref 回调标识
	 */
	unregisterRef(ref: symbol): boolean {
		if (!isSymbol(ref)) {
			this.#outputWarn('unregisterRef', { type: 'typeError', ref })
			return false
		}

		let isExist = false
		for (const [eventName, callbackInfoArr] of this.#hookMap.entries()) {
			for (let i = 0; i < callbackInfoArr.length; i++) {
				if (callbackInfoArr[i].ref === ref) {
					isExist = true
					callbackInfoArr.splice(i, 1)
					i--
				}

				if (!callbackInfoArr.length) {
					this.#hookMap.delete(eventName)
				}
			}
		}

		if (!isExist) {
			this.#outputWarn('unregisterRef', { type: 'notExist', ref })
		}
		return isExist
	}

	/**
	 * 判断一个hook是否存在
	 * - 若传递 ref 参数, 则内部调用 hasCallback 判断回调是否存在
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false; 可通过 onWarning 钩子自定义处理
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 */
	has<K extends keyof H>(name: K, ref?: symbol | HookCallback): boolean
	/**
	 * 判断一个hook是否存在
	 * - 若传递 ref 参数, 则内部调用 hasCallback 判断回调是否存在
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false; 可通过 onWarning 钩子自定义处理
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 */
	has(name: string | symbol, ref?: symbol | HookCallback): boolean
	has(name: string | symbol, ...args: [symbol | HookCallback]): boolean {
		name = formatName(name)

		if (args.length) {
			const [ref] = args
			return this.hasCallback(name, ref)
		}
		return this.#hookMap.has(name)
	}

	/**
	 * 判断hook中指定的回调是否存在
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false; 可通过 onWarning 钩子自定义处理
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param ref 回调函数引用或回调标识
	 */
	hasCallback<K extends keyof H>(name: K, ref: symbol | HookCallback): boolean
	/**
	 * 判断hook中指定的回调是否存在
	 * - 注意: 1. ref 类型有误时将输出错误警告, 但不会抛出错误, 返回 false; 可通过 onWarning 钩子自定义处理
	 * @param name hook名称, 支持字符串和 Symbol 类型, 否则将强制转换为字符串
	 * @param ref 回调函数引用或回调标识
	 */
	hasCallback<K extends keyof H>(name: string | symbol, ref: symbol | HookCallback): boolean
	hasCallback(name: string | symbol, ref: symbol | HookCallback): boolean {
		name = formatName(name)
		const callbackInfoArr = this.#hookMap.get(name)
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
		for (const callbackInfoArr of this.#hookMap.values()) {
			if (callbackInfoArr.some((callbackInfo) => callbackInfo.ref === ref)) {
				return true
			}
		}
		return false
	}
}
