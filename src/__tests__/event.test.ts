import { describe, it, expect, vi } from 'vitest'
import { Bus } from '../index.js'

/** 仅用于构造函数的类型约束 */
type TestEvents = {
	test: () => void
}

type Events = {
	push: (value: number) => void
	set: (value: number) => void
	asyncTask: (value: number) => Promise<void> | void
}

const noopWarn = () => {}
const createBus = (onWarning: (...args: any[]) => void = noopWarn) => new Bus<Events>({ onWarning })

describe('new Bus()', () => {
	it('should create an instance without options', () => {
		expect(() => new Bus()).not.toThrow()
	})

	it('should create an instance with options', () => {
		expect(() => {
			new Bus<TestEvents>({
				events: {
					test() {}
				},
				onWarning() {},
				ctx() {}
			})
		}).not.toThrow()
	})

	it('should throw when eventMap is not a Map instance', () => {
		expect(() => new Bus({ eventMap: {} as any })).toThrowError(TypeError)
	})

	it('should throw when events is not an object', () => {
		expect(() => new Bus({ events: 'test' as any })).toThrowError(TypeError)
	})

	it('should throw when an event value is not a function', () => {
		expect(() => new Bus({ events: { test: 1 } as any })).toThrowError(TypeError)
	})

	it('should throw when onWarning is not a function', () => {
		expect(() => new Bus({ onWarning: 1 as any })).toThrowError(TypeError)
	})

	it('should register events passed by options.events', () => {
		const bus = new Bus<TestEvents>({
			events: {
				test() {}
			}
		})
		expect(bus.has('test')).toBe(true)
	})

	it('should directly operate the eventMap passed by options.eventMap', () => {
		const eventMap = new Map()
		const bus = new Bus<Events>({ eventMap })
		bus.on('test', () => {})
		expect(eventMap.has('test')).toBe(true)
	})

	it('should expose the context by options.ctx', () => {
		let mapInstance: Map<any, any> | undefined
		let self: unknown
		const bus = new Bus<TestEvents>({
			events: {
				test() {}
			},
			ctx(ctx) {
				mapInstance = ctx.eventMapInstance as Map<any, any>
				self = ctx.self
			}
		})

		expect(mapInstance?.has('test')).toBe(true)
		expect(self).toBe(bus)
		expect(bus.has('test')).toBe(true)
	})
})

describe('on() / once() / emit()', () => {
	it('should call all listeners in registration order with args', () => {
		const bus = createBus()
		const list: number[] = []
		bus.on('push', (value) => list.push(value))
		bus.on('push', (value) => list.push(value * 2))

		bus.emit('push', 1)
		expect(list).toEqual([1, 2])
	})

	it('should bind this to the bus instance', () => {
		const bus = createBus()
		let self: unknown
		bus.on('push', function () {
			self = this
		})

		bus.emit('push', 1)
		expect(self).toBe(bus)
	})

	it('should remove a once listener after the first emit', () => {
		const bus = createBus()
		let count = 0
		bus.once('set', () => count++)

		bus.emit('set', 1)
		bus.emit('set', 2)
		expect(count).toBe(1)
	})

	it('should support a custom ref by options', () => {
		const bus = createBus()
		const ref = Symbol()
		bus.on('push', () => {}, { ref })

		expect(bus.hasCallback('push', ref)).toBe(true)
		expect(bus.offRef(ref)).toBe(true)
		expect(bus.has('push')).toBe(false)
	})

	it('should emit warning when emitting a not exist event', () => {
		const onWarning = vi.fn()
		const bus = createBus(onWarning)

		bus.emit('set', 1)
		expect(onWarning).toHaveBeenCalledWith('emit', { type: 'notExist', name: 'set', args: [1] })
	})
})

describe('emitTry()', () => {
	it('should execute all listeners and collect errors', () => {
		const bus = createBus()
		const list: number[] = []
		bus.on('push', (value) => list.push(value))
		bus.on('push', () => {
			throw new Error('boom')
		})
		bus.on('push', (value) => list.push(value * 2))

		const errors = bus.emitTry('push', 1)
		expect(list).toEqual([1, 2])
		expect(errors).toHaveLength(1)
		expect((errors![0] as Error).message).toBe('boom')
	})

	it('should return undefined when no error occurs', () => {
		const bus = createBus()
		bus.on('push', () => {})
		expect(bus.emitTry('push', 1)).toBeUndefined()
	})

	it('should emit warning when an error occurs', () => {
		const onWarning = vi.fn()
		const bus = createBus(onWarning)
		bus.on('push', () => {
			throw new Error('boom')
		})

		bus.emitTry('push', 1)
		expect(onWarning).toHaveBeenCalledWith('emitTry', { type: 'error', name: 'push', args: [1] })
	})
})

describe('emitAsync()', () => {
	it('should await each listener in registration order', async () => {
		const bus = createBus()
		const list: number[] = []
		bus.on('asyncTask', async (value) => {
			await new Promise((resolve) => setTimeout(resolve, 10))
			list.push(value)
		})
		bus.on('asyncTask', (value) => {
			list.push(value * 2)
		})

		await bus.emitAsync('asyncTask', 1)
		expect(list).toEqual([1, 2])
	})

	it('should reject and stop remaining listeners when a listener throws', async () => {
		const bus = createBus()
		const list: number[] = []
		bus.on('asyncTask', (value) => {
			list.push(value)
		})
		bus.on('asyncTask', () => {
			throw new Error('boom')
		})
		bus.on('asyncTask', (value) => {
			list.push(value * 2)
		})

		await expect(bus.emitAsync('asyncTask', 1)).rejects.toThrowError('boom')
		expect(list).toEqual([1])
	})
})

describe('emitTryAsync()', () => {
	it('should await listeners in order and collect errors', async () => {
		const bus = createBus()
		const list: number[] = []
		bus.on('asyncTask', async (value) => {
			await new Promise((resolve) => setTimeout(resolve, 10))
			list.push(value)
		})
		bus.on('asyncTask', () => {
			throw new Error('boom')
		})
		bus.on('asyncTask', (value) => {
			list.push(value * 2)
		})

		const errors = await bus.emitTryAsync('asyncTask', 1)
		expect(list).toEqual([1, 2])
		expect(errors).toHaveLength(1)
		expect((errors![0] as Error).message).toBe('boom')
	})
})

describe('emitConcurrencyAsync()', () => {
	it('should execute listeners concurrently', async () => {
		const bus = createBus()
		const order: string[] = []
		bus.on('asyncTask', async () => {
			order.push('a:start')
			await new Promise((resolve) => setTimeout(resolve, 10))
			order.push('a:end')
		})
		bus.on('asyncTask', async () => {
			order.push('b:start')
			await new Promise((resolve) => setTimeout(resolve, 10))
			order.push('b:end')
		})

		await bus.emitConcurrencyAsync('asyncTask', 1)
		expect(order).toEqual(['a:start', 'b:start', 'a:end', 'b:end'])
	})

	it('should collect synchronous errors and keep executing listeners', async () => {
		const bus = createBus()
		const list: number[] = []
		bus.on('asyncTask', (value) => {
			list.push(value)
		})
		bus.on('asyncTask', () => {
			throw new Error('sync boom')
		})
		bus.on('asyncTask', (value) => {
			list.push(value * 2)
		})

		const errors = await bus.emitConcurrencyAsync('asyncTask', 1)
		expect(list).toEqual([1, 2])
		expect(errors).toHaveLength(1)
		expect((errors![0] as Error).message).toBe('sync boom')
	})

	it('should collect async rejections', async () => {
		const bus = createBus()
		bus.on('asyncTask', () => Promise.reject(new Error('async boom')))

		const errors = await bus.emitConcurrencyAsync('asyncTask', 1)
		expect(errors).toHaveLength(1)
		expect((errors![0] as Error).message).toBe('async boom')
	})

	it('should return undefined when no error occurs', async () => {
		const bus = createBus()
		bus.on('asyncTask', () => {})
		expect(await bus.emitConcurrencyAsync('asyncTask', 1)).toBeUndefined()
	})
})

describe('off() / offRef()', () => {
	it('should remove listener by ref symbol', () => {
		const bus = createBus()
		const list: number[] = []
		const ref = bus.on('push', (value) => list.push(value))

		bus.emit('push', 1)
		expect(bus.off('push', ref)).toBe(true)
		bus.emit('push', 2)
		expect(list).toEqual([1])
	})

	it('should remove listener by function', () => {
		const bus = createBus()
		const list: number[] = []
		const fn = (value: number) => list.push(value)
		bus.on('push', fn)

		bus.emit('push', 1)
		expect(bus.off('push', fn)).toBe(true)
		bus.emit('push', 2)
		expect(list).toEqual([1])
	})

	it('should warn and return false when the event not exist', () => {
		const onWarning = vi.fn()
		const bus = createBus(onWarning)

		expect(bus.off('set', Symbol())).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('off', { type: 'notExist', name: 'set', ref: expect.any(Symbol) })
	})

	it('should warn and return false when ref type is invalid', () => {
		const onWarning = vi.fn()
		const bus = createBus(onWarning)

		// @ts-expect-error ref must be a symbol or a function
		expect(bus.off('set', 1)).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('off', { type: 'typeError', name: 'set', ref: 1 })
	})

	it('should remove listener by ref through offRef()', () => {
		const bus = createBus()
		const list: number[] = []
		const ref = bus.on('push', (value) => list.push(value))

		expect(bus.offRef(ref)).toBe(true)
		bus.emit('push', 1)
		expect(list).toEqual([])
	})

	it('should warn when offRef() can not find the ref', () => {
		const onWarning = vi.fn()
		const bus = createBus(onWarning)

		expect(bus.offRef(Symbol())).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('offRef', { type: 'notExist', ref: expect.any(Symbol) })
	})

	it('should warn when offRef() ref type is invalid', () => {
		const onWarning = vi.fn()
		const bus = createBus(onWarning)

		// @ts-expect-error ref must be a symbol
		expect(bus.offRef(1)).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('offRef', { type: 'typeError', ref: 1 })
	})
})

describe('has() / hasCallback() / hasRef()', () => {
	it('should check whether an event exists', () => {
		const bus = createBus()
		bus.on('push', () => {})

		expect(bus.has('push')).toBe(true)
		expect(bus.has('set')).toBe(false)
	})

	it('should check whether a callback exists', () => {
		const bus = createBus()
		const fn = () => {}
		bus.on('push', fn)

		expect(bus.has('push', fn)).toBe(true)
		expect(bus.has('push', () => {})).toBe(false)
		expect(bus.hasCallback('push', fn)).toBe(true)
		expect(bus.hasCallback('set', fn)).toBe(false)
	})

	it('should check whether a ref exists', () => {
		const bus = createBus()
		const ref = bus.on('push', () => {})

		expect(bus.hasRef(ref)).toBe(true)
		expect(bus.hasRef(Symbol())).toBe(false)
	})

	it('should warn and return false when hasCallback ref type is invalid', () => {
		const onWarning = vi.fn()
		const bus = createBus(onWarning)
		bus.on('push', () => {})

		// @ts-expect-error ref must be a symbol or a function
		expect(bus.hasCallback('push', 1)).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('hasCallback', { type: 'typeError', name: 'push', ref: 1 })
	})

	it('should warn and return false when hasRef ref type is invalid', () => {
		const onWarning = vi.fn()
		const bus = createBus(onWarning)

		// @ts-expect-error ref must be a symbol
		expect(bus.hasRef(1)).toBe(false)
		expect(onWarning).toHaveBeenCalledWith('hasRef', { type: 'typeError', ref: 1 })
	})
})

describe('default onWarning', () => {
	it('should output warn to console when the event not exists', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const bus = new Bus<Events>()

		bus.emit('push', 1)
		expect(warn).toHaveBeenCalled()

		warn.mockRestore()
	})

	it('should output warn to console when the ref not exists', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const bus = new Bus<Events>()
		bus.on('push', () => {})

		bus.off('push', Symbol())
		expect(warn).toHaveBeenCalled()

		warn.mockRestore()
	})
})

describe('type constraints', () => {
	type StrictEvents = {
		send: (msg: string, op: { a: number }) => number
	}
	const createStrictBus = () => new Bus<StrictEvents>({ onWarning: noopWarn })

	it('should accept a matching callback and args', () => {
		const bus = createStrictBus()
		bus.on('send', (msg, op) => msg.length + op.a)
		bus.emit('send', 'a', { a: 1 })
	})

	it('should error when the callback return type mismatches', () => {
		const bus = createStrictBus()
		// @ts-expect-error callback must return number
		bus.on('send', () => 'a')
	})

	it('should error when the callback parameter type mismatches', () => {
		const bus = createStrictBus()
		// @ts-expect-error first parameter must be a string
		bus.on('send', (msg: number, op: { a: number }) => msg + op.a)
	})

	it('should error when emit args mismatch', () => {
		const bus = createStrictBus()
		// @ts-expect-error args must be [msg: string, op: { a: number }]
		bus.emit('send', 'a', { a: '1' })
	})

	it('should allow an unknown event name without error', () => {
		const bus = createStrictBus()
		bus.emit('unknown')
		bus.emit('unknown', 'a', { a: 1 })
	})
})
