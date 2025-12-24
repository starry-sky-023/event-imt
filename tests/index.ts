import Bus from '../dist/index.es.js'

const bus = new Bus({
	events: {
		send(msg: string) {
			console.log('send event:', msg)
		}
	},
	ctx(ctx) {
		console.log(ctx)
	}
})

console.log('bus', bus)
