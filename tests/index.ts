import Bus from '../dist/index.es.js'

interface MyEvents {
	send?: (msg: string, op: { a: number }) => void
}

type InterfaceToType<T> = {
	[K in keyof T]: T[K]
}

const bus = new Bus<InterfaceToType<MyEvents>>({
	events: {
		send(msg: string, op: { a: number }) {
			console.log('send event:', msg, op)
		}
	},
	ctx(ctx) {
		console.log(ctx)
	}
})

bus.emit('send', 'Hello, World!', { a: 1 })
console.log('bus', bus)
