import { describe, it, expect } from 'vitest'
import Bus from '../index.js'

describe('on() and once() and emit()', () => {
	type Events = {
		push: (value: number) => void
		set(value: number): void
	}

	const event = new Bus<Events>({
		onWarning() {}
	})

	const numList: number[] = []
	event.on('push', (value) => {
		numList.push(value)
	})

	event.on('push', (value) => {
		numList.push(value)
	})

	it('should call all listeners when emit is called', () => {
		event.emit('push', 1)
		expect(numList).toEqual([1, 1])
	})

	it('should call listenner auto remove', () => {
		let r = 0
		event.once('set', (value) => {
			r = value
		})
		event.emit('set', 1)
		expect(r).toBe(1)
		event.emit('set', 2)
		expect(r).toBe(1)
	})
})

describe('off() and offBySign()', () => {
	type Events = {
		push: () => void
	}

	const event = new Bus<Events>({
		onWarning() {}
	})

	it('should remove listener by evnet name and sign', () => {
		const numList: number[] = []
		const pushSign = event.on('push', () => {
			numList.push(1)
		})
		event.emit('push')
		expect(numList).toEqual([1])
		event.off('push', pushSign)
		event.emit('push')
		expect(numList).toEqual([1])
	})

	it('should remove listener by function', () => {
		const numList: number[] = []
		const pushFn = () => {
			numList.push(1)
		}
		event.on('push', pushFn)
		event.emit('push')
		expect(numList).toEqual([1])
		event.off('push', pushFn)
		event.emit('push')
		expect(numList).toEqual([1])
	})

	it('should remove listener by sign', () => {
		const numList: number[] = []
		const pushSign = event.on('push', () => {
			numList.push(1)
		})
		event.emit('push')
		expect(numList).toEqual([1])
		event.offBySign(pushSign)
		event.emit('push')
		expect(numList).toEqual([1])
	})
})

describe('has() and hasCallback() and hasCallbackBySign()', () => {
	type Events = {
		a: () => void
		b: () => void
	}

	const event = new Bus<Events>()

	it('should return boolean by event name', () => {
		event.on('a', () => {})
		expect(event.has('a')).toBe(true)
		expect(event.has('b')).toBe(false)
	})

	it('should return boolean by callback', () => {
		const callback = () => {}
		event.on('a', callback)
		expect(event.hasCallback('a', callback)).toBe(true)
		expect(event.hasCallback('a', () => {})).toBe(false)
		expect(event.hasCallback('b', callback)).toBe(false)
	})

	it('should return boolean by sign', () => {
		const sign = event.on('a', () => {})
		expect(event.hasCallbackBySign(sign)).toBe(true)
		expect(event.hasCallbackBySign(Symbol())).toBe(false)
	})
})

describe('emitWait()', () => {
	type Events = {
		push: (value: number) => Promise<number>
	}

	const event = new Bus<Events>({ onError() {} })
	const numList: number[] = []
	it('should wait all promises to resolve', async () => {
		event.on('push', (value) => {
			numList.push(value)
			return value
		})

		event.on('push', () => {
			throw new Error('test error')
		})

		event.on('push', (value) => {
			return new Promise((resolve) => {
				setTimeout(() => {
					numList.push(value)
					resolve(value)
				}, 10)
			})
		})

		const r = await event.emitWait('push', 1)
		expect(numList).toEqual([1, 1])
		expect(r).toEqual([
			{ status: 'fulfilled', value: 1 },
			{ status: 'rejected', reason: new Error('test error') },
			{ status: 'fulfilled', value: 1 }
		] as PromiseSettledResult<number>[])
	})
})

describe('emitLineUp()', () => {
	type Events = {
		push: () => void
	}

	it('should call listeners in order', async () => {
		const event = new Bus<Events>({ onError() {} })
		const numList: number[] = []
		event.on('push', () => {
			return new Promise((resolve) => {
				setTimeout(() => {
					numList.push(1)
					resolve(1)
				}, 10)
			})
		})

		event.on('push', () => {
			numList.push(2)
		})
		await event.emitLineUp('push')
		expect(numList).toEqual([1, 2])
	})

	it('should handle errors in listeners', async () => {
		const event = new Bus<Events>({ onError() {} })
		const numList: number[] = []
		event.on('push', () => {
			numList.push(1)
		})
		event.on('push', () => {
			return new Promise((_, reject) => {
				setTimeout(() => {
					reject(new Error('test error'))
				}, 10)
			})
		})

		event.on('push', () => {
			numList.push(2)
		})

		await expect(async () => {
			await event.emitLineUp('push')
		}).rejects.toThrowError('test error')
		expect(numList).toEqual([1])
	})
})

describe('emitLineUpCaptureErr()', () => {
	type Events = {
		push: () => void
	}

	it('should call listeners in order', async () => {
		const event = new Bus<Events>({ onError() {} })
		const numList: number[] = []
		event.on('push', () => {
			return new Promise((resolve) => {
				setTimeout(() => {
					numList.push(1)
					resolve(1)
				}, 10)
			})
		})

		event.on('push', () => {
			numList.push(2)
		})
		await event.emitLineUpCaptureErr('push')
		expect(numList).toEqual([1, 2])
	})

	it('should handle errors in listeners', async () => {
		const event = new Bus<Events>({ onError() {} })
		const numList: number[] = []
		event.on('push', () => {
			numList.push(1)
			return 1
		})
		event.on('push', () => {
			return new Promise((_, reject) => {
				setTimeout(() => {
					reject(new Error('test error'))
				}, 10)
			})
		})

		event.on('push', () => {
			numList.push(2)
			return 2
		})

		const r = await event.emitLineUpCaptureErr('push')
		expect(r).toEqual([
			{ status: 'fulfilled', value: 1 },
			{ status: 'rejected', reason: new Error('test error') },
			{ status: 'fulfilled', value: 2 }
		] as ({ status: 'fulfilled'; value: number } | { status: 'rejected'; reason: any })[])
		expect(numList).toEqual([1, 2])
	})
})
