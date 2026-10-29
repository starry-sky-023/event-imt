import { describe, it, expect, vi } from 'vitest'
import { Hook } from '../index.js'
import type { OnHookWarningHandler } from '../index.js'

/** 仅用于构造函数的类型约束 */
type TestHooks = {
	test: () => void
}

type Hooks = {
	push: (value: number) => void
	set: (value: number) => void
	asyncTask: (value: number) => Promise<void> | void
}

const noopWarn: OnHookWarningHandler = () => {}
const createHook = (onWarning: OnHookWarningHandler = noopWarn) => new Hook<Hooks>({ onWarning })

describe('new Hook()', () => {
	it('should create an instance without options', () => {
		expect(() => new Hook()).not.toThrow()
	})

	it('should create an instance with options', () => {
		expect(() => {
			new Hook<TestHooks>({
				hooks: {
					test() {}
				},
				onWarning() {},
				ctx() {}
			})
		}).not.toThrow()
	})

	it('should throw when hookMap is not a Map instance', () => {
		expect(() => new Hook({ hookMap: {} as any })).toThrowError(TypeError)
	})

	it('should throw when hooks is not an object', () => {
		expect(() => new Hook({ hooks: 'test' as any })).toThrowError(TypeError)
	})

	it('should throw when a hook value is not a function', () => {
		expect(() => new Hook({ hooks: { test: 1 } as any })).toThrowError(TypeError)
	})

	it('should throw when onWarning is not a function', () => {
		expect(() => new Hook({ onWarning: 1 as any })).toThrowError(TypeError)
	})

	it('should register hooks passed by options.hooks', () => {
		const hook = new Hook<TestHooks>({
			hooks: {
				test() {}
			}
		})
		expect(hook.has('test')).toBe(true)
	})

	it('should directly operate the hookMap passed by options.hookMap', () => {
		const hookMap = new Map()
		const hook = new Hook<Hooks>({ hookMap })
		hook.register('test', () => {})
		expect(hookMap.has('test')).toBe(true)
	})

	it('should expose the context by options.ctx', () => {
		let mapInstance: Map<any, any> | undefined
		let self: unknown
		const hook = new Hook<TestHooks>({
			hooks: {
				test() {}
			},
			ctx(ctx) {
				mapInstance = ctx.hookMapInstance as Map<any, any>
				self = ctx.self
			}
		})

		expect(mapInstance?.has('test')).toBe(true)
		expect(self).toBe(hook)
		expect(hook.has('test')).toBe(true)
	})
})

describe('register() / registerOnce() / exec()', () => {
	it('should call all callbacks in registration order with args', () => {
		const hook = createHook()
		const list: number[] = []
		hook.register('push', (value) => list.push(value))
		hook.register('push', (value) => list.push(value * 2))

		hook.exec('push', { args: [1] })
		expect(list).toEqual([1, 2])
	})

	it('should bind this to the hook instance', () => {
		const hook = createHook()
		let self: unknown
		hook.register('push', function () {
			self = this
		})

		hook.exec('push', { args: [1] })
		expect(self).toBe(hook)
	})

	it('should remove a once callback after the first exec', () => {
		const hook = createHook()
		let count = 0
		hook.registerOnce('set', () => count++)

		hook.exec('set', { args: [1] })
		hook.exec('set', { args: [2] })
		expect(count).toBe(1)
	})

	it('should support a custom ref by options', () => {
		const hook = createHook()
		const ref = Symbol()
		hook.register('push', () => {}, { ref })

		expect(hook.hasCallback('push', ref)).toBe(true)
		expect(hook.unregisterRef(ref)).toBe(true)
		expect(hook.has('push')).toBe(false)
	})

	it('should throw when callback is not a function', () => {
		const hook = createHook()
		// @ts-expect-error callback must be a function
		expect(() => hook.register('push', 1)).toThrowError(TypeError)
	})

	it('should throw when options.ref is not a symbol', () => {
		const hook = createHook()
		// @ts-expect-error ref must be a symbol
		expect(() => hook.register('push', () => {}, { ref: 1 })).toThrowError(TypeError)
	})

	it('should throw immediately when a callback throws', () => {
		const hook = createHook()
		const list: number[] = []
		hook.register('push', (value) => list.push(value))
		hook.register('push', () => {
			throw new Error('boom')
		})
		hook.register('push', (value) => list.push(value * 2))

		expect(() => hook.exec('push', { args: [1] })).toThrowError('boom')
		expect(list).toEqual([1])
	})

	it('should emit warning when exec a not exist hook', () => {
		const onWarning = vi.fn()
		const hook = createHook(onWarning)

		hook.exec('set', { args: [1] })
		expect(onWarning).toHaveBeenCalledWith('exec', { type: 'notExist', name: 'set', args: [1] })
	})

	it('should throw when options is not an object', () => {
		const hook = createHook()
		// @ts-expect-error options must be a object
		expect(() => hook.exec('push', 1)).toThrowError(TypeError)
	})

	it('should throw when options.handler is not a function', () => {
		const hook = createHook()
		// @ts-expect-error handler must be a function
		expect(() => hook.exec('push', { handler: 1 })).toThrowError(TypeError)
	})

	it('should throw when options.args is not an array', () => {
		const hook = createHook()
		// @ts-expect-error args must be an array
		expect(() => hook.exec('push', { args: 1 })).toThrowError(TypeError)
	})
})

describe('exec() with handler', () => {
	it('should pass each callback and ctx to handler and let it decide invocation', () => {
		const hook = createHook()
		const list: number[] = []
		hook.register('push', (value) => list.push(value))
		hook.register('push', (value) => list.push(value * 2))

		let count = 0
		let ctxName: string | symbol = ''
		let ctxArgs: any[] = []
		let ctxSelf: unknown
		hook.exec('push', {
			args: [3],
			handler(callback, ctx) {
				count++
				ctxName = ctx.name
				ctxArgs = ctx.args
				ctxSelf = ctx.self
				callback.call(ctx.self, ...ctx.args)
			}
		})

		expect(count).toBe(2)
		expect(ctxName).toBe('push')
		expect(ctxArgs).toEqual([3])
		expect(ctxSelf).toBe(hook)
		expect(list).toEqual([3, 6])
	})

	it('should not invoke callbacks automatically when handler is provided', () => {
		const hook = createHook()
		const list: number[] = []
		hook.register('push', (value) => list.push(value))

		hook.exec('push', { args: [1], handler() {} })
		expect(list).toEqual([])
	})

	it('should not call handler and not warn when the hook not exists', () => {
		const onWarning = vi.fn()
		const hook = createHook(onWarning)
		const handler = vi.fn()

		hook.exec('set', { args: [1], handler })

		expect(handler).not.toHaveBeenCalled()
		expect(onWarning).not.toHaveBeenCalled()
	})
})

describe('execAsync()', () => {
	it('should await each callback in registration order', async () => {
		const hook = createHook()
		const list: number[] = []
		hook.register('asyncTask', async (value) => {
			await new Promise((resolve) => setTimeout(resolve, 10))
			list.push(value)
		})
		hook.register('asyncTask', (value) => {
			list.push(value * 2)
		})

		await hook.execAsync('asyncTask', { args: [1] })
		expect(list).toEqual([1, 2])
	})

	it('should reject and stop remaining callbacks when a callback throws', async () => {
		const hook = createHook()
		const list: number[] = []
		hook.register('asyncTask', (value) => {
			list.push(value)
		})
		hook.register('asyncTask', () => {
			throw new Error('boom')
		})
		hook.register('asyncTask', (value) => {
			list.push(value * 2)
		})

		await expect(hook.execAsync('asyncTask', { args: [1] })).rejects.toThrowError('boom')
		expect(list).toEqual([1])
	})

	it('should await the handler for each callback when provided', async () => {
		const hook = createHook()
		const list: number[] = []
		hook.register('asyncTask', (value) => {
			list.push(value)
		})
		hook.register('asyncTask', (value) => {
			list.push(value * 2)
		})

		let count = 0
		await hook.execAsync('asyncTask', {
			args: [1],
			async handler(callback, ctx) {
				count++
				await callback.call(ctx.self, ...ctx.args)
			}
		})
		expect(count).toBe(2)
		expect(list).toEqual([1, 2])
	})

	it('should emit warning when execAsync a not exist hook', async () => {
		const onWarning = vi.fn()
		const hook = createHook(onWarning)

		await hook.execAsync('set', { args: [1] })
		expect(onWarning).toHaveBeenCalledWith('execAsync', { type: 'notExist', name: 'set', args: [1] })
	})
})

describe('execConcurrencyAsync()', () => {
	it('should execute callbacks concurrently', async () => {
		const hook = createHook()
		const order: string[] = []
		hook.register('asyncTask', async () => {
			order.push('a:start')
			await new Promise((resolve) => setTimeout(resolve, 10))
			order.push('a:end')
		})
		hook.register('asyncTask', async () => {
			order.push('b:start')
			await new Promise((resolve) => setTimeout(resolve, 10))
			order.push('b:end')
		})

		await hook.execConcurrencyAsync('asyncTask', { args: [1] })
		expect(order).toEqual(['a:start', 'b:start', 'a:end', 'b:end'])
	})

	it('should collect synchronous errors and keep executing callbacks', async () => {
		const hook = createHook()
		const list: number[] = []
		hook.register('asyncTask', (value) => {
			list.push(value)
		})
		hook.register('asyncTask', () => {
			throw new Error('sync boom')
		})
		hook.register('asyncTask', (value) => {
			list.push(value * 2)
		})

		const errors = await hook.execConcurrencyAsync('asyncTask', { args: [1] })
		expect(list).toEqual([1, 2])
		expect(errors).toHaveLength(1)
		expect((errors![0] as Error).message).toBe('sync boom')
	})

	it('should collect async rejections', async () => {
		const hook = createHook()
		hook.register('asyncTask', () => Promise.reject(new Error('async boom')))

		const errors = await hook.execConcurrencyAsync('asyncTask', { args: [1] })
		expect(errors).toHaveLength(1)
		expect((errors![0] as Error).message).toBe('async boom')
	})

	it('should collect the handler rejection when provided', async () => {
		const hook = createHook()
		hook.register('asyncTask', () => {})
		hook.register('asyncTask', () => {})

		let count = 0
		const errors = await hook.execConcurrencyAsync('asyncTask', {
			args: [1],
			handler() {
				count++
				throw new Error('handler boom')
			}
		})
		expect(count).toBe(2)
		expect(errors).toHaveLength(2)
		expect((errors![0] as Error).message).toBe('handler boom')
	})

	it('should return undefined when no error occurs', async () => {
		const hook = createHook()
		hook.register('asyncTask', () => {})
		expect(await hook.execConcurrencyAsync('asyncTask', { args: [1] })).toBeUndefined()
	})

	it('should emit warning when execConcurrencyAsync a not exist hook', async () => {
		const onWarning = vi.fn()
		const hook = createHook(onWarning)

		await hook.execConcurrencyAsync('set', { args: [1] })
		expect(onWarning).toHaveBeenCalledWith('execConcurrencyAsync', { type: 'notExist', name: 'set', args: [1] })
	})

	it('should emit warning when an error occurs', async () => {
		const onWarning = vi.fn()
		const hook = createHook(onWarning)
		hook.register('asyncTask', () => {
			throw new Error('boom')
		})

		await hook.execConcurrencyAsync('asyncTask', { args: [1] })
		expect(onWarning).toHaveBeenCalledWith('execConcurrencyAsync', { type: 'error', name: 'asyncTask', args: [1] })
	})
})

describe('unregister() / unregisterRef()', () => {
	it('should remove callback by ref symbol', () => {
		const hook = createHook()
		const list: number[] = []
		const ref = hook.register('push', (value) => list.push(value))

		hook.exec('push', { args: [1] })
		expect(hook.unregister('push', ref)).toBe(true)
		hook.exec('push', { args: [2] })
		expect(list).toEqual([1])
	})

	it('should remove callback by function', () => {
		const hook = createHook()
		const list: number[] = []
		const fn = (value: number) => list.push(value)
		hook.register('push', fn)

		hook.exec('push', { args: [1] })
		expect(hook.unregister('push', fn)).toBe(true)
		hook.exec('push', { args: [2] })
		expect(list).toEqual([1])
	})

	it('should warn and return false when the hook not exist', () => {
		const onWarning = vi.fn()
		const hook = createHook(onWarning)

		expect(hook.unregister('set', Symbol())).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('unregister', { type: 'notExist', name: 'set', ref: expect.any(Symbol) })
	})

	it('should warn and return false when ref type is invalid', () => {
		const onWarning = vi.fn()
		const hook = createHook(onWarning)

		// @ts-expect-error ref must be a symbol or a function
		expect(hook.unregister('set', 1)).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('unregister', { type: 'typeError', name: 'set', ref: 1 })
	})

	it('should remove callback by ref through unregisterRef()', () => {
		const hook = createHook()
		const list: number[] = []
		const ref = hook.register('push', (value) => list.push(value))

		expect(hook.unregisterRef(ref)).toBe(true)
		hook.exec('push', { args: [1] })
		expect(list).toEqual([])
	})

	it('should warn when unregisterRef() can not find the ref', () => {
		const onWarning = vi.fn()
		const hook = createHook(onWarning)

		expect(hook.unregisterRef(Symbol())).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('unregisterRef', { type: 'notExist', ref: expect.any(Symbol) })
	})

	it('should warn when unregisterRef() ref type is invalid', () => {
		const onWarning = vi.fn()
		const hook = createHook(onWarning)

		// @ts-expect-error ref must be a symbol
		expect(hook.unregisterRef(1)).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('unregisterRef', { type: 'typeError', ref: 1 })
	})
})

describe('has() / hasCallback() / hasRef()', () => {
	it('should check whether a hook exists', () => {
		const hook = createHook()
		hook.register('push', () => {})

		expect(hook.has('push')).toBe(true)
		expect(hook.has('set')).toBe(false)
	})

	it('should check whether a callback exists', () => {
		const hook = createHook()
		const fn = () => {}
		hook.register('push', fn)

		expect(hook.has('push', fn)).toBe(true)
		expect(hook.has('push', () => {})).toBe(false)
		expect(hook.hasCallback('push', fn)).toBe(true)
		expect(hook.hasCallback('set', fn)).toBe(false)
	})

	it('should check whether a ref exists', () => {
		const hook = createHook()
		const ref = hook.register('push', () => {})

		expect(hook.hasRef(ref)).toBe(true)
		expect(hook.hasRef(Symbol())).toBe(false)
	})

	it('should warn and return false when hasCallback ref type is invalid', () => {
		const onWarning = vi.fn()
		const hook = createHook(onWarning)
		hook.register('push', () => {})

		// @ts-expect-error ref must be a symbol or a function
		expect(hook.hasCallback('push', 1)).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('hasCallback', { type: 'typeError', name: 'push', ref: 1 })
	})

	it('should warn and return false when hasRef ref type is invalid', () => {
		const onWarning = vi.fn()
		const hook = createHook(onWarning)

		// @ts-expect-error ref must be a symbol
		expect(hook.hasRef(1)).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('hasRef', { type: 'typeError', ref: 1 })
	})
})

describe('default onWarning', () => {
	it('should output warn to console when the hook not exists', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const hook = new Hook<Hooks>()

		hook.exec('push', { args: [1] })
		expect(warn).toHaveBeenCalled()

		warn.mockRestore()
	})

	it('should output warn to console when the ref not exists', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const hook = new Hook<Hooks>()
		hook.register('push', () => {})

		hook.unregister('push', Symbol())
		expect(warn).toHaveBeenCalled()

		warn.mockRestore()
	})
})

describe('type constraints', () => {
	type StrictHooks = {
		send: (msg: string, op: { a: number }) => number
	}
	const createStrictHook = () => new Hook<StrictHooks>({ onWarning: noopWarn })

	it('should accept a matching callback and args', () => {
		const hook = createStrictHook()
		hook.register('send', (msg, op) => msg.length + op.a)
		hook.exec('send', { args: ['a', { a: 1 }] })
	})

	it('should error when the callback return type mismatches', () => {
		const hook = createStrictHook()
		// @ts-expect-error callback must return number
		hook.register('send', () => 'a')
	})

	it('should error when the callback parameter type mismatches', () => {
		const hook = createStrictHook()
		// @ts-expect-error first parameter must be a string
		hook.register('send', (msg: number, op: { a: number }) => msg + op.a)
	})

	it('should error when exec args mismatch', () => {
		const hook = createStrictHook()
		// @ts-expect-error args must be [msg: string, op: { a: number }]
		hook.exec('send', { args: ['a', { a: '1' }] })
	})

	it('should infer the callback and args type in handler', () => {
		const hook = createStrictHook()
		hook.register('send', (msg, op) => msg.length + op.a)

		hook.exec('send', {
			args: ['a', { a: 1 }],
			handler(callback, ctx) {
				const result: number = callback.call(ctx.self, ...ctx.args)
				expect(result).toBe(2)
				// @ts-expect-error first parameter must be a string
				callback.call(ctx.self, 1, { a: 1 })
			}
		})
	})
})
